/**
 * NameCaptureService — AURA Phase 3K (redesigned, name-agnostic)
 *
 * Shared name-capture logic for both the typed console and the voice loop.
 * Works correctly for ANY name — no hardcoded names, variants, or examples.
 *
 * Three recognition paths (in priority order):
 *
 *  1. SPELLING (authoritative, deterministic)
 *     - Letter-by-letter:  "K A R I M", "K-A-R-I-M", "K.A.R.I.M"
 *     - "X as in word":    "K as in kite, A as in apple..."
 *     - Phonetic letters:  "kay ay are eye em"  (only when a spell marker present)
 *     - NATO alphabet:     "kilo alpha romeo india mike" (only with spell marker)
 *     → Result: save immediately, high confidence. Spelling overrides a heard name.
 *
 *  2. HEARD name (from STT)
 *     - Typed source: trusted, save directly.
 *     - Voice source: NEVER saved silently — always confirms first.
 *       If it matches the already-stored name exactly → save (re-affirmation).
 *       If it's a near-miss of the stored name (edit distance ≤ 2) → confirm.
 *       Otherwise → confirm.
 *
 *  3. CORRECTION (model-assisted, async)
 *     Called when the user says "no, that's wrong" / "it's spelled differently"
 *     after a failed turn. Callers pass the previous heard text + conversation
 *     history to resolveCorrection(). The model interprets the correction in
 *     context and returns the intended name. This is where spelling errors that
 *     Whisper introduces (e.g. "Kareem" instead of "Karim") get fixed — by the
 *     model understanding "no, with an I not two E's", not by hardcoded rules.
 *
 * Design principles:
 *  - No hardcoded names, variants, or examples anywhere in this file.
 *  - Edit-distance check is against the STORED name only (dynamic).
 *  - The model call in resolveCorrection() is the right tool for messy correction
 *    utterances; deterministic parsing handles clean spelling.
 *  - Pure: no I/O, no API calls in analyze(). resolveCorrection() is async.
 */

export type NameCaptureKind = 'save' | 'confirm' | 'query' | 'none';
export type NameCaptureSource = 'typed' | 'voice';

export interface NameCaptureResult {
  kind: NameCaptureKind;
  name?: string;
  heard?: string;
  spelled: boolean;
  spelledOut?: string;
  confidence: 'high' | 'medium' | 'low';
  prompt?: string;
}

export interface CorrectionContext {
  /** What the STT returned (the wrong text). */
  wrongText: string;
  /** What the user is saying now (the correction utterance). */
  correctionText: string;
  /** Recent conversation turns for context. */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Name currently stored in memory (if any). */
  storedName?: string;
}

// ─── Letter maps (phonetic + NATO) ───────────────────────────────────────────
// Used only when a spelling-marker word is present in the utterance, to avoid
// turning ordinary words ("are", "you", "echo") into letters.

const PHONETIC_LETTER: Record<string, string> = {
  ay: 'A', eh: 'A',
  bee: 'B',
  see: 'C', sea: 'C', cee: 'C',
  dee: 'D',
  ee: 'E',
  ef: 'F', eff: 'F',
  gee: 'G',
  aitch: 'H', aych: 'H', haitch: 'H',
  eye: 'I',
  jay: 'J',
  kay: 'K',
  el: 'L', ell: 'L',
  em: 'M',
  en: 'N',
  oh: 'O',
  pee: 'P',
  cue: 'Q', queue: 'Q',
  ar: 'R', are: 'R',
  es: 'S', ess: 'S',
  tee: 'T',
  yoo: 'U', you: 'U',
  vee: 'V',
  ex: 'X',
  why: 'Y', wye: 'Y',
  zee: 'Z', zed: 'Z',
};

const NATO_LETTER: Record<string, string> = {
  alpha: 'A', alfa: 'A', bravo: 'B', charlie: 'C', delta: 'D', echo: 'E',
  foxtrot: 'F', golf: 'G', hotel: 'H', india: 'I', juliet: 'J', juliett: 'J',
  kilo: 'K', lima: 'L', mike: 'M', november: 'N', oscar: 'O', papa: 'P',
  quebec: 'Q', romeo: 'R', sierra: 'S', tango: 'T', uniform: 'U', victor: 'V',
  whiskey: 'W', whisky: 'W', xray: 'X', yankee: 'Y', zulu: 'Z',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function titleCaseName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z'‘’-]/g, '').trim();
  if (!cleaned) return '';
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s'‘’-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function spellOut(name: string): string {
  return name.replace(/[^A-Za-z]/g, '').toUpperCase().split('').join('-');
}

function editDistance(a: string, b: string): number {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0).map((_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

class NameCaptureServiceImpl {

  // ── Spelling parser ─────────────────────────────────────────────────────────

  parseSpelling(text: string): string | null {
    const lower = text.toLowerCase();

    // "X as in word" — always unambiguous
    const asInLetters = [...lower.matchAll(/\b([a-z])\s+as\s+in\b/g)].map(m => m[1].toUpperCase());
    if (asInLetters.length >= 2) return asInLetters.join('');

    // Phonetic/NATO only when a spell marker is present
    const hasMarker = /\b(spell(?:ed|s|t|ing)?|letter[\s-]by[\s-]letter|in\s+letters|capital letters?)\b/.test(lower);
    const markerIdx = hasMarker ? lower.search(/\b(spell(?:ed|s|t|ing)?|letter[\s-]by[\s-]letter|in\s+letters)\b/) : -1;
    const region = markerIdx >= 0 ? lower.slice(markerIdx) : lower;
    const tokens = region.split(/[\s,./-]+/).filter(Boolean);

    const letters: string[] = [];
    for (const tok of tokens) {
      const t = tok.replace(/[^a-z]/g, '');
      if (!t) continue;
      if (t.length === 1 && /[a-z]/.test(t)) { letters.push(t.toUpperCase()); continue; }
      if (hasMarker && PHONETIC_LETTER[t]) { letters.push(PHONETIC_LETTER[t]); continue; }
      if (hasMarker && NATO_LETTER[t]) { letters.push(NATO_LETTER[t]); continue; }
      if (letters.length > 0) break; // non-letter token ends the run
    }
    return letters.length >= 2 ? letters.join('') : null;
  }

  // ── Intent detectors ────────────────────────────────────────────────────────

  isNameQuery(text: string): boolean {
    return /\b(what(?:'?s| is)?\s+my\s+name|who\s+am\s+i|do\s+you\s+(?:know|remember)\s+my\s+name)\b/i.test(text);
  }

  isAffirmation(text: string): boolean {
    return /\b(yes|yeah|yep|yup|correct|right|that'?s\s+right|confirmed?|save\s+it|exactly|sure|that's\s+it|do\s+it)\b/i.test(text.trim());
  }

  isNegation(text: string): boolean {
    return /\b(no|nope|wrong|incorrect|not\s+right|that'?s\s+wrong|don'?t\s+save|that'?s\s+not|it'?s\s+not)\b/i.test(text.trim());
  }

  isCorrectionIntent(text: string): boolean {
    return /\b(actually|no[\s,]+it'?s|that'?s\s+wrong|wrong\s+spelling|not\s+quite|it'?s\s+spelled|i\s+said|i\s+meant|correct(?:ion)?[\s:]+|fix\s+that|it\s+should\s+be)\b/i.test(text);
  }

  private extractHeardName(text: string): string | null {
    const m = text.match(/\b(?:my\s+name\s+is|my\s+name'?s|call\s+me|i\s+am|i'?m|name\s+is)\s+([A-Za-z][A-Za-z'‘’-]{0,40})/i);
    return m ? m[1] : null;
  }

  private isNameSetIntent(text: string): boolean {
    return /\b(my\s+name\s+is|my\s+name'?s|call\s+me|remember\s+my\s+name|name\s+is|spell(?:ed|s|t|ing)?)\b/i.test(text);
  }

  // ── Primary analysis (sync) ────────────────────────────────────────────────

  analyze(text: string, opts: { source: NameCaptureSource; knownName?: string }): NameCaptureResult {
    const none: NameCaptureResult = { kind: 'none', spelled: false, confidence: 'low' };
    const raw = (text || '').trim();
    if (!raw) return none;

    if (this.isNameQuery(raw)) {
      return { kind: 'query', spelled: false, confidence: 'high' };
    }

    if (!this.isNameSetIntent(raw)) return none;

    const heardRaw = this.extractHeardName(raw);
    const heard = heardRaw ? titleCaseName(heardRaw) : undefined;
    const spelledUpper = this.parseSpelling(raw);

    // Spelling is authoritative — overrides whatever was heard
    if (spelledUpper) {
      const name = titleCaseName(spelledUpper);
      if (!name) return none;
      return {
        kind: 'save', name, heard, spelled: true,
        spelledOut: spellOut(name), confidence: 'high',
        prompt: `Saved — your name is ${name}, spelled ${spellOut(name)}.`,
      };
    }

    if (heard) {
      if (opts.source === 'typed') {
        return {
          kind: 'save', name: heard, heard, spelled: false, confidence: 'high',
          prompt: `Got it — your name is ${heard}.`,
        };
      }

      // Voice: exact match to stored name = safe re-affirmation
      const storedLower = opts.knownName?.trim().toLowerCase();
      if (storedLower && heard.toLowerCase() === storedLower) {
        return { kind: 'save', name: heard, heard, spelled: false, confidence: 'high', prompt: `Your name is ${heard}.` };
      }

      // Near-miss of stored name or any other voice-heard name: always confirm.
      // The user can then affirm, negate, or spell it — and if they spell it,
      // the next turn goes through parseSpelling() which is authoritative.
      const nearMiss = storedLower && editDistance(heard.toLowerCase(), storedLower) <= 2;
      return {
        kind: 'confirm', name: heard, heard, spelled: false,
        spelledOut: spellOut(heard),
        confidence: nearMiss ? 'low' : 'medium',
        prompt: `I heard "${heard}" — is that right? Say "yes" to save it, or spell it letter by letter to correct it.`,
      };
    }

    // Intent present but no name extracted yet
    return {
      kind: 'confirm', spelled: false, confidence: 'low',
      prompt: `What's your name? You can spell it letter by letter to make sure I get it right.`,
    };
  }

  // ── Model-assisted correction (async) ──────────────────────────────────────
  //
  // Called when the user indicates the previous STT output was wrong (e.g. says
  // "no, it's spelled differently" or "with an I not two E's"). Passes the
  // correction utterance + recent history to the model, which can interpret
  // ambiguous natural-language corrections ("the vowel in the middle is I not EE")
  // in a way that pure string parsing cannot.
  //
  // Returns the corrected name string, or null if the model cannot confidently
  // resolve it (in which case the caller should ask the user to spell it out).

  async resolveCorrection(ctx: CorrectionContext): Promise<string | null> {
    try {
      // Build a short, targeted system message — NOT the full personality prompt.
      // We want the model to act as a correction resolver only.
      const systemMsg = [
        'You are resolving a name spelling correction.',
        'The voice transcriber made an error. The user is correcting it.',
        'Return ONLY the corrected name as the user intends it, title-cased (e.g. "James" or "Maria-Elena").',
        'If you cannot confidently determine the correct name, reply with exactly: UNCERTAIN',
        'Do not add any other text, explanation, or punctuation.',
        ctx.storedName ? `Previously saved name: "${ctx.storedName}" (may itself be wrong).` : '',
      ].filter(Boolean).join(' ');

      const userMsg = [
        `The voice transcriber heard: "${ctx.wrongText}"`,
        `The user is now correcting it by saying: "${ctx.correctionText}"`,
      ].join('\n');

      // Lazy import to avoid circular deps
      const { invoke } = await import('@tauri-apps/api/core');
      const recentHistory = ctx.history.slice(-4); // last 2 turns context only

      const result = await invoke<string>('openai_chat_response', {
        transcript: userMsg,
        responseStyle: 'brief',
        systemPromptOverride: systemMsg,
        history: recentHistory,
      });

      const trimmed = (result || '').trim();
      if (!trimmed || trimmed === 'UNCERTAIN' || trimmed.length > 60) return null;

      // Reject if it looks like a sentence rather than a name
      if (trimmed.split(/\s+/).length > 4) return null;

      return titleCaseName(trimmed) || null;
    } catch {
      return null;
    }
  }
}

export const nameCaptureService = new NameCaptureServiceImpl();

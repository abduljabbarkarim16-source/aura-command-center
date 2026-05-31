/**
 * NameCaptureService — AURA Phase 3J QA (voice name + spelling capture)
 *
 * Turns identity utterances into a reliable name even when Whisper mishears.
 * Shared by the typed console (useConsoleConversation) and the hands-free voice
 * loop (useConversationLoop) so name capture behaves identically on both.
 *
 * Recognises:
 *  - "my name is X" / "my name's X" / "call me X" / "remember my name is X"
 *  - explicit spelling:    "K A R I M", "K-A-R-I-M", "K.A.R.I.M", "K, A, R, I, M"
 *  - phonetic letters:     "kay ay are eye em"            -> KARIM
 *  - NATO spelling:        "kilo alpha romeo india mike"  -> KARIM
 *  - "as in" spelling:     "K as in kite, A as in apple"  -> KA...
 *  - name queries:         "what is my name", "who am I"
 *
 * Safety rules (why this exists):
 *  - Spelling is AUTHORITATIVE. If the user spells it, we trust the letters even
 *    when the heard name disagrees (so a mis-heard "Kareem" never wins over a
 *    spelled "K-A-R-I-M").
 *  - A heard-only name from VOICE is never saved silently — it asks the user to
 *    confirm or spell, because Whisper routinely mishears short proper nouns.
 *  - TYPED input is trusted and saved exactly as written.
 *
 * Pure string processing. No AI model calls, no I/O.
 */

export type NameCaptureKind = 'save' | 'confirm' | 'query' | 'none';
export type NameCaptureSource = 'typed' | 'voice';

export interface NameCaptureResult {
  kind: NameCaptureKind;
  /** Normalised, title-cased name to save / confirm (e.g. "Karim"). */
  name?: string;
  /** The heard name before any spelling override (for diagnostics). */
  heard?: string;
  /** Whether the name came from explicit letter spelling. */
  spelled: boolean;
  /** Spelled-out form for read-back, e.g. "K-A-R-I-M". */
  spelledOut?: string;
  confidence: 'high' | 'medium' | 'low';
  /** Spoken/printed line for 'save' (ack) or 'confirm' (question). */
  prompt?: string;
}

// ─── Letter maps ──────────────────────────────────────────────────────────────

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

/**
 * Known risky mishearings of the documented operator name "Karim".
 * These are NOT auto-corrected (that would change meaning if the user really is
 * named one of these); instead they force a confirmation step on voice input.
 */
const KARIM_VARIANTS = new Set([
  'kareem', 'kareim', 'karim', 'kariim', 'kareme', 'kaream', 'karam',
  'carim', 'careem', 'kerim', 'khareem', 'khalim', 'kreem', 'kraim',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function titleCaseName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z'’-]/g, '').trim();
  if (!cleaned) return '';
  // Title-case each hyphen/space/apostrophe segment.
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s'’-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function spellOut(name: string): string {
  return name.replace(/[^A-Za-z]/g, '').toUpperCase().split('').join('-');
}

/** Levenshtein distance, capped — used to detect near-miss mishearings. */
function editDistance(a: string, b: string): number {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

class NameCaptureServiceImpl {
  /**
   * Extract a spelled name from explicit spelling patterns.
   * Returns UPPERCASE letters (e.g. "KARIM") or null when no spelling is found.
   */
  parseSpelling(text: string): string | null {
    const lower = text.toLowerCase();

    // Pattern A: "X as in word" — always an unambiguous spelling signal.
    const asInLetters = [...lower.matchAll(/\b([a-z])\s+as\s+in\b/g)].map(m => m[1].toUpperCase());
    if (asInLetters.length >= 2) return asInLetters.join('');

    // Only mine phonetic/NATO words when a spelling marker is present, to avoid
    // turning ordinary speech ("are you there") into letters.
    const hasMarker = /\b(spell(?:ed|s|t|ing)?|letter\s*by\s*letter|in\s+letters|capital)\b/.test(lower);

    // Tokenise the portion most likely to contain the spelling: after a marker
    // if present, otherwise the whole utterance (single-letter runs are safe).
    const markerIdx = hasMarker ? lower.search(/\b(spell(?:ed|s|t|ing)?|letter\s*by\s*letter|in\s+letters)\b/) : -1;
    const region = markerIdx >= 0 ? lower.slice(markerIdx) : lower;
    const tokens = region.split(/[\s,./-]+/).filter(Boolean);

    const letters: string[] = [];
    let broke = false;
    for (const tok of tokens) {
      const t = tok.replace(/[^a-z]/g, '');
      if (!t) continue;
      if (t.length === 1 && /[a-z]/.test(t)) { letters.push(t.toUpperCase()); continue; }
      if (hasMarker && PHONETIC_LETTER[t]) { letters.push(PHONETIC_LETTER[t]); continue; }
      if (hasMarker && NATO_LETTER[t]) { letters.push(NATO_LETTER[t]); continue; }
      // A non-letter token after we already started collecting ends the run.
      if (letters.length > 0) { broke = true; break; }
    }
    void broke;
    // Require at least 2 letters so a stray single "I" / "a" isn't treated as a name.
    return letters.length >= 2 ? letters.join('') : null;
  }

  /** Detect "what is my name" / "who am I" style queries. */
  isNameQuery(text: string): boolean {
    return /\b(what(?:'?s| is)?\s+my\s+name|who\s+am\s+i|do\s+you\s+(?:know|remember)\s+my\s+name)\b/i.test(text);
  }

  isAffirmation(text: string): boolean {
    return /\b(yes|yeah|yep|yup|correct|right|that'?s right|confirmed?|save it|exactly|sure|do it)\b/i.test(text.trim());
  }

  isNegation(text: string): boolean {
    return /\b(no|nope|wrong|incorrect|not right|that'?s wrong|don'?t)\b/i.test(text.trim());
  }

  /** Extract the heard name after "my name is" / "call me" / etc. */
  private extractHeardName(text: string): string | null {
    const m = text.match(/\b(?:my name is|my name'?s|call me|i am|i'?m|name is)\s+([A-Za-z][A-Za-z'’-]{0,40})/i);
    return m ? m[1] : null;
  }

  private isNameSetIntent(text: string): boolean {
    return /\b(my name is|my name'?s|call me|remember my name|name is|spell(?:ed|s|t|ing)?)\b/i.test(text);
  }

  private isRisky(name: string, knownName?: string): boolean {
    const n = name.toLowerCase();
    if (KARIM_VARIANTS.has(n)) return true;
    if (knownName && knownName.trim()) {
      const k = knownName.trim().toLowerCase();
      if (n !== k && editDistance(n, k) <= 2) return true; // near-miss of stored name
    }
    return false;
  }

  /**
   * Analyse an utterance for identity intent and decide how to act.
   * `knownName` is the currently-stored name (used to flag near-miss mishearings).
   */
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

    // 1) Explicit spelling is authoritative.
    if (spelledUpper) {
      const name = titleCaseName(spelledUpper);
      if (!name) return none;
      return {
        kind: 'save',
        name,
        heard,
        spelled: true,
        spelledOut: spellOut(name),
        confidence: 'high',
        prompt: `Saved — your name is ${name}, spelled ${spellOut(name)}.`,
      };
    }

    // 2) Heard-only name.
    if (heard) {
      if (opts.source === 'typed') {
        return {
          kind: 'save',
          name: heard,
          heard,
          spelled: false,
          confidence: 'high',
          prompt: `Got it — I'll remember your name is ${heard}.`,
        };
      }

      // Voice heard-only: never save silently. If it already matches the stored
      // name exactly, treat as a harmless re-affirmation; otherwise confirm/spell.
      const matchesStored = opts.knownName && heard.toLowerCase() === opts.knownName.trim().toLowerCase();
      if (matchesStored) {
        return { kind: 'save', name: heard, heard, spelled: false, confidence: 'high', prompt: `Your name is ${heard}.` };
      }
      const risky = this.isRisky(heard, opts.knownName);
      return {
        kind: 'confirm',
        name: heard,
        heard,
        spelled: false,
        spelledOut: spellOut(heard),
        confidence: risky ? 'low' : 'medium',
        prompt: `I heard "${heard}", spelled ${spellOut(heard)}. If that's right, say "yes". If not, spell it for me — for example "K A R I M".`,
      };
    }

    // Intent words present ("remember my name", "spell") but no name yet.
    return {
      kind: 'confirm',
      spelled: false,
      confidence: 'low',
      prompt: `Sure — what's your name? You can spell it letter by letter, like "K A R I M".`,
    };
  }
}

export const nameCaptureService = new NameCaptureServiceImpl();

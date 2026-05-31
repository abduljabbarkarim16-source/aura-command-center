/**
 * VoiceCleanupService — AURA Phase 3E QA3
 *
 * Lightweight post-transcription text cleanup inspired by Wispr Flow.
 * Applied per-segment before appending to the live transcript buffer.
 *
 * Operations (in order):
 *  1. Personal vocabulary substitution — correct common mishearings of AURA tech terms
 *  2. Filler word removal — strip common filler words (um, uh, repeated starts)
 *  3. Basic punctuation normalisation — collapse multiple spaces, trim
 *
 * Design principles:
 *  - Never changes meaning — only obvious noise
 *  - Replacements are exact word-boundary matches (not substring matches)
 *  - Configurable: can be disabled per-call or globally
 *  - Does NOT call any AI model — pure string processing
 */

// ─── Personal vocabulary table ────────────────────────────────────────────────
// Corrects common Whisper mishearings of AURA-domain terms.
// Keys are lowercase patterns (word-boundary matched); values are the correction.

const VOCAB_CORRECTIONS: Array<[RegExp, string]> = [
  [/\baura\b/gi,             'AURA'],
  [/\bkarim\b/g,             'Karim'],   // normalise capitalisation only; mishearings (Kareem...) are confirmed, not rewritten
  [/\bclaude\b/gi,           'Claude'],
  [/\bcodex\b/gi,            'Codex'],
  [/\btauri\b/gi,            'Tauri'],
  [/\bmake\.com\b/gi,        'Make.com'],
  [/\bgemini\b/gi,           'Gemini'],
  [/\bopenai\b/gi,           'OpenAI'],
  [/\bwhisper flow\b/gi,     'Whisper Flow'],
  [/\bwispr flow\b/gi,       'Wispr Flow'],
  [/\bwhisper\b/gi,          'Whisper'],
  [/\bvad\b/gi,              'VAD'],
  [/\bwebview2\b/gi,         'WebView2'],
  [/\bai build memory\b/gi,  'ai-build-memory'],
  [/\bagent command center\b/gi, 'agent-command-center'],
  // Common mishearings of "AURA"
  [/\bora\b/gi,  'AURA'],
  // "aurora" intentionally NOT corrected — it's a real word too
];

// ─── Filler word patterns ─────────────────────────────────────────────────────
// Matched at word boundary; case-insensitive.

const FILLER_PATTERNS: RegExp[] = [
  /\bum+\b/gi,
  /\buh+\b/gi,
  /\buh-huh\b/gi,
  /\bmm+\b/gi,
  /\bhmm+\b/gi,
  /\blike,? like\b/gi,         // doubled "like, like"
  /\byou know,? you know\b/gi, // doubled "you know"
  /\bso,? so\b/gi,             // doubled "so, so"
  /\bi mean,? i mean\b/gi,
  /\bactually,? actually\b/gi,
  /\bbasically,? basically\b/gi,
];

// ─── Service ──────────────────────────────────────────────────────────────────

class VoiceCleanupServiceImpl {
  private _fillerEnabled = true;
  private _vocabEnabled  = true;

  setFillerEnabled(v: boolean) { this._fillerEnabled = v; }
  setVocabEnabled(v: boolean)  { this._vocabEnabled  = v; }

  /**
   * Apply cleanup to a raw Whisper transcript.
   * Returns the cleaned string (may equal input if nothing was changed).
   */
  clean(raw: string): string {
    if (!raw.trim()) return raw;
    let text = raw;

    // 1. Vocabulary corrections
    if (this._vocabEnabled) {
      for (const [pattern, replacement] of VOCAB_CORRECTIONS) {
        text = text.replace(pattern, replacement);
      }
    }

    // 2. Filler removal
    if (this._fillerEnabled) {
      for (const pattern of FILLER_PATTERNS) {
        text = text.replace(pattern, '');
      }
    }

    // 3. Normalise whitespace
    text = text.replace(/\s{2,}/g, ' ').trim();

    // 4. Capitalise first letter if it was lost
    if (text.length > 0) {
      text = text[0].toUpperCase() + text.slice(1);
    }

    return text;
  }
}

export const voiceCleanupService = new VoiceCleanupServiceImpl();

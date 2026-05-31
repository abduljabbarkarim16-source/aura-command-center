/**
 * aura-personality.ts — AURA Phase 3G
 *
 * Types for AURA's configurable personality and dialect system.
 */

export type PersonalityPreset =
  | 'direct'       // Minimal words, no filler, straight to the point
  | 'warm'         // Friendly, encouraging, conversational
  | 'technical'    // Precise, uses correct terminology, detail-oriented
  | 'casual'       // Relaxed, informal, like talking to a smart friend
  | 'builder';     // Dev-focused, action-oriented, thinks in systems

export interface PersonalityConfig {
  preset:          PersonalityPreset;
  /** Free-text override — if set, replaces the preset's base description */
  customPrompt:    string;
  /** User's preferred name for AURA to use */
  userName:        string;
  /** How AURA refers to itself (default: "AURA") */
  auraName:        string;
  /** Memory injection: inject personal memories into context */
  injectPersonal:  boolean;
  /** Memory injection: inject task memories into context */
  injectTask:      boolean;
  /** Max memory entries to inject per request */
  maxMemoryInject: number;
}

export const PRESET_DESCRIPTIONS: Record<PersonalityPreset, string> = {
  direct:    'Reply in as few words as possible. No filler. No openers. Get straight to the answer.',
  warm:      'Be friendly and natural. Speak like a knowledgeable friend — supportive, clear, never robotic.',
  technical: 'Be precise and thorough. Use correct technical terms. Prefer accuracy over brevity.',
  casual:    'Keep it relaxed and informal. Short sentences. Natural rhythm. Like texting a smart colleague.',
  builder:   'Think in systems. Be action-oriented and decisive. Dev-focused. Prefer concrete next steps over theory.',
};

export const DEFAULT_PERSONALITY: PersonalityConfig = {
  preset:          'direct',
  customPrompt:    '',
  userName:        '',
  auraName:        'AURA',
  injectPersonal:  true,
  injectTask:      true,
  maxMemoryInject: 20, // Phase 3K+ audit: 8 was overriding AuraMemoryService MAX_INJECT=20
};

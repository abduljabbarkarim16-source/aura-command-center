/**
 * AuraPersonalityService — AURA Phase 3G
 *
 * Manages AURA's personality configuration and builds the dynamic system prompt
 * that combines base identity + personality preset/override + injected memories.
 *
 * Security: no secrets stored here.
 */

import type { PersonalityConfig, PersonalityPreset } from '../../types/aura-personality';
import { DEFAULT_PERSONALITY, PRESET_DESCRIPTIONS } from '../../types/aura-personality';
import { auraMemoryService } from '../memory/AuraMemoryService';

const STORAGE_KEY = 'aura.personality.config';
const MAX_CUSTOM_PROMPT_CHARS = 1_500;
const MAX_USER_NAME_CHARS = 80;

// Base identity — always present regardless of preset
const BASE_IDENTITY =
  'You are {AURA_NAME}, a voice assistant and AI operator. ' +
  'You speak directly to the user through audio. ' +
  'Never use markdown, bullet points, or formatted lists in voice responses. ' +
  'Never say "Certainly!", "Of course!", "Great question!", or similar filler openers. ' +
  'Do not claim to perform actions you have not actually performed. ' +
  'If you do not know something, say so briefly.';

// Response style suffixes (used when responseStyle is set)
export const STYLE_SUFFIX: Record<string, string> = {
  brief:    ' Reply in 1 sentence.',
  normal:   ' Aim for 2–3 sentences.',
  detailed: ' Up to 5 sentences if the topic needs it.',
};

type ConfigListener = (config: PersonalityConfig) => void;

class AuraPersonalityServiceImpl {
  private config: PersonalityConfig;
  private listeners = new Set<ConfigListener>();

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      this.config = stored
        ? { ...DEFAULT_PERSONALITY, ...(JSON.parse(stored) as Partial<PersonalityConfig>) }
        : { ...DEFAULT_PERSONALITY };
    } catch {
      this.config = { ...DEFAULT_PERSONALITY };
    }
  }

  subscribe(fn: ConfigListener): () => void {
    this.listeners.add(fn);
    fn({ ...this.config });
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = { ...this.config };
    for (const fn of this.listeners) fn(snap);
  }

  getConfig(): PersonalityConfig { return { ...this.config }; }

  update(patch: Partial<PersonalityConfig>) {
    this.config = { ...this.config, ...patch };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config)); } catch { /* ignore */ }
    this.notify();
  }

  setPreset(preset: PersonalityPreset) { this.update({ preset }); }
  setCustomPrompt(text: string)        { this.update({ customPrompt: text.trim().slice(0, MAX_CUSTOM_PROMPT_CHARS) }); }
  setUserName(name: string)            { this.update({ userName: name.trim().slice(0, MAX_USER_NAME_CHARS) }); }

  reset() {
    this.config = { ...DEFAULT_PERSONALITY };
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    this.notify();
  }

  // ── Build the full dynamic system prompt ─────────────────────────────────
  //
  // Order: base identity → personality description → user name → memories → style
  //
  // This is passed to the Rust backend so the frontend controls what AURA knows.

  buildSystemPrompt(opts: {
    responseStyle?: string;
    skipMemory?: boolean;
  } = {}): string {
    const cfg = this.config;
    const auraName = cfg.auraName || 'AURA';
    const parts: string[] = [];

    // 1. Base identity with name substitution
    parts.push(BASE_IDENTITY.replace('{AURA_NAME}', auraName));

    // 2. Personality — custom prompt overrides preset
    const customPrompt = cfg.customPrompt.trim().slice(0, MAX_CUSTOM_PROMPT_CHARS);
    const personalityDesc = customPrompt
      ? customPrompt
      : PRESET_DESCRIPTIONS[cfg.preset];
    parts.push(personalityDesc);

    // 3. User name if set
    const userName = cfg.userName.trim().slice(0, MAX_USER_NAME_CHARS);
    if (userName) {
      parts.push(`The user's name is ${JSON.stringify(userName)}. Address them by name occasionally but naturally.`);
    }

    // 4. Injected memories
    if (!opts.skipMemory) {
      const memCtx = auraMemoryService.buildContextString({
        includePersonal: cfg.injectPersonal,
        includeTask:     cfg.injectTask,
        maxEntries:      cfg.maxMemoryInject,
      });
      if (memCtx) parts.push(memCtx);
    }

    // 5. Response style suffix
    if (opts.responseStyle && STYLE_SUFFIX[opts.responseStyle]) {
      parts.push(STYLE_SUFFIX[opts.responseStyle]);
    }

    return parts.join('\n\n');
  }
}

export const auraPersonalityService = new AuraPersonalityServiceImpl();

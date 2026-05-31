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
  'You are {AURA_NAME}, a voice assistant and AI desktop operator. ' +
  'You speak directly to the user through audio. ' +
  'Never use markdown, bullet points, or formatted lists in voice responses. ' +
  'Never say "Certainly!", "Of course!", "Great question!", or similar filler openers. ' +
  'Do not claim to perform actions you have not actually performed. ' +
  'If you do not know something, say so briefly.';

// Tool awareness — injected when tool dispatch is enabled
const TOOL_AWARENESS =
  'You have access to tools you can call directly:\n' +
  '- terminal__gitStatus: get current git status\n' +
  '- terminal__gitBranch: get current git branch\n' +
  '- terminal__gitLog: show recent commits\n' +
  '- terminal__npmLint: run TypeScript type-check\n' +
  '- terminal__cargoTest: run Rust tests\n' +
  '- cli__claudeCheck: check if Claude CLI is available\n' +
  '- cli__codexCheck: check if Codex CLI is available\n' +
  '- memory__setUserName: remember the user\'s name when they tell you\n' +
  '- memory__rememberFact: save a durable fact (preference / project detail)\n' +
  '- memory__getUserProfile: recall the user\'s name/preferences (use for "what is my name?")\n' +
  '- memory__getCapabilityStatus: recall what you can and cannot do\n' +
  '- memory__summarizeThread: describe the current conversation thread\n' +
  '- capabilities__can: check whether you can do a specific capability\n' +
  '- capabilities__whyNot: explain what is missing for a capability\n' +
  '- capabilities__gapReport: list what you cannot do yet\n' +
  'When a question can be answered by running a tool, call it. ' +
  'For questions about what you can/cannot do, use the capabilities tools rather than guessing. ' +
  'When the user states a preference or their name, save it with the memory tools. ' +
  'When you run a tool, say what you are doing in plain words before reading the result.';

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
    includeToolAwareness?: boolean;
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

    // 5. Tool awareness — tell model what tools it can use
    if (opts.includeToolAwareness !== false) {
      parts.push(TOOL_AWARENESS);
    }

    // 6. Response style suffix
    if (opts.responseStyle && STYLE_SUFFIX[opts.responseStyle]) {
      parts.push(STYLE_SUFFIX[opts.responseStyle]);
    }

    return parts.join('\n\n');
  }
}

export const auraPersonalityService = new AuraPersonalityServiceImpl();

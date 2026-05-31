/**
 * AURA version constants - updated each phase.
 * Displayed in Settings and Dashboard so every build is identifiable.
 *
 * Version scheme:
 *   0.1.x  - Phase 1  (UI architecture)
 *   0.2.x  - Phase 2  (foundation, persistence, relay, command policy)
 *   0.3.x  - Phase 3  (live providers, self-build, voice)
 *   0.3.0  - Phase 3A (live connection verification)
 *   0.3.1  - Phase 3B (self-build dry run, voice foundation)
 *   0.3.2  - Phase 3C (voice conversation MVP - STT/Chat/TTS via Tauri backend)
 */

export const APP_VERSION = '0.5.1';
export const APP_PHASE   = 'Phase 3J QA';
export const APP_PHASE_LABEL = 'Visual + Voice Fix';
export const BUILD_DATE  = '2026-05-31';

/**
 * Build provenance - injected at build time by vite.config.ts `define`.
 * This is the fix for the 0.5.0-vs-0.5.0 installer ambiguity that hid the
 * Phase 3J UI: every build now carries its exact commit SHA and build time,
 * shown in Settings -> Details, so the user can confirm which build is live.
 */
declare const __APP_BUILD_SHA__: string;
declare const __APP_BUILD_BRANCH__: string;
declare const __APP_BUILD_TIME__: string;

export const BUILD_SHA    = typeof __APP_BUILD_SHA__    !== 'undefined' ? __APP_BUILD_SHA__    : 'dev';
export const BUILD_BRANCH = typeof __APP_BUILD_BRANCH__ !== 'undefined' ? __APP_BUILD_BRANCH__ : 'unknown';
export const BUILD_TIME   = typeof __APP_BUILD_TIME__   !== 'undefined' ? __APP_BUILD_TIME__   : '';

/** Full display string shown in Settings header and About chip */
export const VERSION_DISPLAY = `v${APP_VERSION} / ${APP_PHASE}`;

/**
 * Compact, copyable build marker for the Details panel.
 * e.g. "v0.5.1 · Phase 3J QA · a1b2c3d · 2026-05-31 14:22"
 */
export const BUILD_MARKER = [
  `v${APP_VERSION}`,
  APP_PHASE,
  BUILD_SHA,
  BUILD_TIME ? BUILD_TIME.slice(0, 16).replace('T', ' ') : BUILD_DATE,
].join(' · ');

/** Changelog - newest entry first */
export interface ChangelogEntry {
  version: string;
  phase:   string;
  date:    string;
  summary: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version:  '0.5.1',
    phase:    'Phase 3J QA',
    date:     '2026-05-31',
    summary:  'Visual + Voice Fix',
    highlights: [
      'Unique 0.5.1 installer + in-app build marker (version, phase, commit, build time) so the running build is identifiable',
      'Living Visual Canvas is now a premium, state-reactive work surface (idle / listening / thinking / tool / memory / done)',
      'Voice name + spelling capture: letter-by-letter and NATO spelling normalized; confirms before saving an uncertain name',
      'Transcription biased with project vocabulary (AURA, Karim, Claude, Codex, Tauri...) and a local correction dictionary',
      'Voice diagnostics in Details: raw vs cleaned text, detected intent, spelling mode, saved value, and timings',
    ],
  },
  {
    version:  '0.5.0',
    phase:    'Phase 3J',
    date:     '2026-05-31',
    summary:  'Operator UI/UX Refinement',
    highlights: [
      'Console uses one shared operator right panel instead of duplicate sidebars',
      'Operator panel tabs expose Activity, Tasks, Terminal, Logs, Memory, Capabilities, Recipes, Notifications, and Details',
      'Voice Core center is cleaner and keeps detailed status in the right panel',
      'RuntimeTask drawer, history, and canvas are more compact and task-driven',
      'Active UI labels updated away from stale mock and old-phase copy',
    ],
  },
  {
    version:  '0.5.0',
    phase:    'Phase 3H',
    date:     '2026-05-31',
    summary:  'Runtime Nervous System',
    highlights: [
      'Capability registry: can/whyNot/test/recommendUpgrade with evidence',
      'Structured user profile + session-thread continuity + compaction',
      'Live console dispatch - AURA can be tested through its own console',
      'memory.* and capabilities.* tools the model can call',
      'Agent bridges (Claude/Codex/Antigravity) with connection state',
      'Internal self-test harness, capability gap planner',
      'Permission modes (Safe Auto / Approval / Admin Bypass / Locked)',
      'Voice Core + Console UI decluttered; mock console data removed',
    ],
  },
  {
    version:  '0.4.1',
    phase:    'Phase 3F QA',
    date:     '2026-05-31',
    summary:  'Audit Hardening',
    highlights: [
      'Native command result fields aligned across Rust and TypeScript',
      'CLI timeout handling changed to owned child-process polling',
      'Tauri CSP restored and SmartScreen bypass flag removed',
      'Voice settings, personality prompt, and memory injection hardened',
      'Auto-memory is off by default and controlled by voice settings',
      'Mock-backed operator surfaces now show visible demo-data notices',
      'Strict TypeScript, Rust fmt, and clippy gates are clean',
    ],
  },
  {
    version:  '0.3.2',
    phase:    'Phase 3C',
    date:     '2026-05-29',
    summary:  'Voice Conversation MVP',
    highlights: [
      'Real microphone recording via push-to-talk (15s max)',
      'OpenAI Whisper STT -> gpt-4o-mini Chat -> OpenAI TTS - all via Tauri backend',
      'API key held in Rust; never exposed to frontend',
      'Conversation panel with history, visualizer states per turn',
      'Voice On/Off toggle in Voice Core',
      'VoiceReadinessCard with enable toggle + TTS voice selector',
    ],
  },
  {
    version:  '0.3.1',
    phase:    'Phase 3B',
    date:     '2026-05-29',
    summary:  'Self-Build Dry Run & Voice Foundation',
    highlights: [
      'SelfBuildDryRunService - controlled plan + command proposals',
      'ProviderPlanningService - live Anthropic planning call (max 64 tokens)',
      'Voice session types and VoiceSessionService',
      'OpenAIVoiceSessionService stubs (dry-run capable)',
      'VoiceTranscriptService with 7 event types',
      'Provider gate: dryRunReady flag (workspace optional for dry runs)',
    ],
  },
  {
    version:  '0.3.0',
    phase:    'Phase 3A',
    date:     '2026-05-29',
    summary:  'Live Connection Verification',
    highlights: [
      'Make.com AURA Core Event Router scenario created (ID 5226882)',
      'Anthropic smoke test: PASSED',
      'OpenAI smoke test: PASSED',
      'Gemini: quota-limited (billing enabled, credits needed)',
      'MakeConnectorService: live calls, localStorage persistence, env-based init',
      'ProviderSmokeTestService with live test UI',
    ],
  },
  {
    version:  '0.2.0',
    phase:    'Phase 2 (A-G)',
    date:     '2026-05-27',
    summary:  'Foundation & Desktop Architecture',
    highlights: [
      'Tauri desktop shell, React + TypeScript frontend',
      'Local persistence, Settings, provider registry',
      'Approval-gated reasoning relay, command policy engine',
      'Voice runtime (mock), self-build orchestrator',
      'Native execution bridge with Rust allowlist',
    ],
  },
];

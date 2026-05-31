/**
 * aura-memory.ts — AURA Phase 3G
 *
 * Types for AURA's persistent memory system.
 * Two sources: auto-extracted from conversation turns, and user-explicit saves.
 * Two categories: personal (about the user) and task (project/work decisions).
 */

export type MemoryCategory = 'personal' | 'task';
export type MemorySource   = 'auto' | 'explicit' | 'user' | 'mistake_correction';
export type MemoryStatus   = 'active'   | 'pinned' | 'archived';

export interface AuraMemory {
  id: string;
  category: MemoryCategory;
  source:   MemorySource;
  status:   MemoryStatus;
  content:  string;           // The fact itself — plain text, ≤200 chars
  context?: string;           // Optional: what conversation produced this
  createdAt: string;          // ISO timestamp
  updatedAt: string;
  usageCount: number;         // How many times injected into context
}

export interface MemoryExtractionResult {
  facts: Array<{
    category: MemoryCategory;
    content:  string;
  }>;
}

// ─── Structured user profile (Phase 3G, Milestone 3) ─────────────────────────
//
// Identity AURA remembers about the user, persisted across restarts. The
// `name` field is mirrored into AuraPersonalityService.userName so it flows
// into the system prompt automatically.

export type VoicePreference = 'fast' | 'normal' | 'detailed';
export type AutonomyPreference = 'safe-auto' | 'approval-required' | 'admin-bypass' | 'locked';

export interface UserProfile {
  name?: string;
  preferredName?: string;
  voicePreference?: VoicePreference;
  /** Free-form UI preferences, e.g. { "topChips": "hidden" } */
  uiPreferences: Record<string, string>;
  autonomyPreference?: AutonomyPreference;
  updatedAt: string;
}

// ─── Capability memory snapshot (Phase 3G, Milestone 3) ──────────────────────
//
// A persisted record of what AURA last confirmed it can/cannot do, so it
// "remembers" its capability state across restarts (not just in-session).

export interface CapabilityMemorySnapshot {
  takenAt: string;
  available: string[];
  degraded: string[];
  blocked: string[];
  planned: string[];
  untested: string[];
}

/**
 * capabilities.ts — AURA Phase 3G (Internal Agent Operating System)
 *
 * Types for AURA's self-knowledge: what it can and cannot do, with evidence.
 *
 * Design principle: a capability is only `available` when a real test has
 * confirmed it. Nothing is asserted blindly. This is what lets AURA answer
 * "Can you …?" from state instead of guessing, and lets it produce an honest
 * capability-gap report.
 */

export type CapabilityStatus =
  | 'available'   // tested and working
  | 'degraded'    // works with caveats / known limits
  | 'planned'     // intentionally not built yet
  | 'blocked'     // a prerequisite is missing (secret, login, binary, approval)
  | 'unknown';    // never tested this session

export type CapabilityCategory =
  | 'voice'
  | 'terminal'
  | 'cli'
  | 'agent'
  | 'memory'
  | 'connector'
  | 'workspace'
  | 'realtime';

export type CapabilityRisk = 'none' | 'low' | 'medium' | 'high';

/** Evidence backing a capability's current status. */
export interface CapabilityEvidence {
  /** 'pass' | 'fail' | free-text summary of the last test() run */
  lastTestResult?: string;
  /** A command/action string that last succeeded for this capability */
  lastSuccessfulCommand?: string;
  /** Most recent error string, if any */
  lastError?: string;
  /** Path (repo-relative) to docs describing this capability */
  docsPath?: string;
  /** Source file(s) implementing this capability */
  sourceFiles?: string[];
  /** ISO timestamp of the last check/test */
  lastCheckedAt?: string;
}

export interface Capability {
  id: string;                     // e.g. "terminal.gitStatus"
  name: string;                   // human label
  description: string;
  category: CapabilityCategory;
  status: CapabilityStatus;
  evidence: CapabilityEvidence;
  /** Tool ids (ToolRegistryService) this capability depends on */
  requiredTools: string[];
  /** Secret keys this capability needs (names only — never values) */
  requiredSecrets: string[];
  /** Approval gates this capability triggers, if any */
  requiredApprovals: string[];
  riskLevel: CapabilityRisk;
  /** Can test() actually exercise this, or is it observational only? */
  testable: boolean;
  /** What an operator would need to do to move this to `available` */
  upgradePlan?: string;
  notes?: string;
}

/** Result of can(id) — a compact yes/no/why answer AURA can speak. */
export interface CapabilityAnswer {
  id: string;
  can: boolean;
  status: CapabilityStatus;
  /** One-sentence natural-language explanation, safe to speak/print */
  reason: string;
}

/** Result of test(id). */
export interface CapabilityTestResult {
  id: string;
  ok: boolean;
  status: CapabilityStatus;
  detail: string;
  durationMs: number;
  ranAt: string;
}

/** An upgrade recommendation for a missing/degraded capability. */
export interface CapabilityUpgrade {
  id: string;
  title: string;
  /** What is missing right now */
  missing: string[];
  /** Concrete steps to close the gap */
  steps: string[];
  /** Rough effort signal for planning */
  effort: 'quick' | 'medium' | 'large';
}

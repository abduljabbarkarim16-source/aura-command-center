/**
 * agent-session.ts — AURA Phase 3E
 *
 * Types for external agent CLI sessions.
 * Security: no API keys, no secrets in session data.
 */

export type AgentCLI = 'claude' | 'codex';

export type AgentSessionStatus =
  | 'checking'
  | 'unavailable'
  | 'idle'
  | 'running'
  | 'completed'
  | 'error'
  | 'usage_limit';

export interface AgentSession {
  id: string;
  cli: AgentCLI;
  status: AgentSessionStatus;
  startedAt?: string;
  endedAt?: string;
  prompt?: string;
  /** Streamed stdout/stderr lines, capped at 500 */
  outputLines: string[];
  exitCode?: number;
  errorSummary?: string;
  usageLimitMessage?: string;
  /** Parsed reset time if usage limit encountered */
  usageLimitResetAt?: string;
}

export interface CLIAvailability {
  cli: AgentCLI;
  available: boolean;
  path?: string;
  checkedAt: string;
}

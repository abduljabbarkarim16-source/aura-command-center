/**
 * tools.ts — AURA Phase 3F
 *
 * Type vocabulary for the AURA internal tool registry.
 * Tools are approved actions AURA can execute (terminal commands, CLI calls).
 */

export type ToolRisk = 'low' | 'medium' | 'high';

export type ToolCategory =
  | 'terminal'    // git / npm / cargo commands
  | 'cli_agent'   // claude / codex CLI
  | 'voice'       // voice-related actions
  | 'system'      // workspace / config
  | 'memory'      // read/write AURA's persistent memory + user profile
  | 'capability'; // query/test AURA's own capability registry

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  risk: ToolRisk;
  /** Whether this tool always requires explicit user approval before running */
  requiresApproval: boolean;
  /** Stable string keys this tool accepts */
  allowedInputKeys: string[];
  /** Stable string keys that are rejected (e.g. shell metacharacters) */
  blockedInputPatterns: string[];
  timeoutMs: number;
}

export type ToolStatus = 'idle' | 'running' | 'completed' | 'error' | 'rejected';

export interface ToolExecution {
  id: string;
  toolId: string;
  status: ToolStatus;
  inputs: Record<string, string>;
  output?: string;
  errorSummary?: string;
  exitCode?: number;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  approvedBy?: 'user' | 'auto';
}

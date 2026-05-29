/**
 * AURA Command Runner Types — Milestone D
 *
 * Defines the proposal queue lifecycle: from AURA proposing a command
 * through admin approval/rejection to execution result logging.
 *
 * No command is executed without going through this lifecycle.
 * Execution itself is gated at Phase 2J+.
 */

import type { CommandRiskClass, CommandCategory } from './command-policy';

// ─── Proposal status lifecycle ────────────────────────────────────────────────

export type CommandProposalStatus =
  | 'drafted'          // Created by AURA, not yet surfaced
  | 'pending_approval' // Shown in approval tray, awaiting admin decision
  | 'approved'         // Admin approved — ready to run
  | 'rejected'         // Admin rejected — archived
  | 'ready_to_run'     // Approved + all pre-conditions met
  | 'running'          // Currently executing (Phase 2J+)
  | 'succeeded'        // Completed successfully
  | 'failed'           // Completed with error
  | 'logged'           // Archived in audit trail
  | 'cancelled';       // Withdrawn before decision

// ─── Proposed command ────────────────────────────────────────────────────────

export interface ProposedCommand {
  id: string;
  command: string;
  args: string[];
  workingDirectory: string;
  riskClass: CommandRiskClass;
  category: CommandCategory;
  reason: string;           // Why AURA is proposing this
  proposedBy: string;       // 'aura' | agent name
  proposedAt: string;       // ISO timestamp
  status: CommandProposalStatus;
  workspaceId: string;
  requiresApproval: boolean;
  canAutoRun: boolean;
  /** Estimated outcome description (dry-run explanation) */
  expectedOutcome?: string;
  /** Any file paths that would be affected */
  affectedPaths?: string[];
}

// ─── Execution result ────────────────────────────────────────────────────────

export interface CommandExecutionResult {
  proposalId: string;
  startedAt: string;
  completedAt: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  succeeded: boolean;
  summary: string;
}

// ─── Audit event ──────────────────────────────────────────────────────────────

export interface CommandAuditEvent {
  id: string;
  proposalId: string;
  timestamp: string;
  actor: 'aura' | 'admin' | 'system';
  action: string;
  details?: string;
}

// ─── Queue snapshot ──────────────────────────────────────────────────────────

export interface CommandQueueSnapshot {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  running: number;
  proposals: ProposedCommand[];
}

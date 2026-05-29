/**
 * AURA Self-Build Types — Milestone J
 *
 * Defines the orchestration vocabulary for AURA building itself.
 * Covers goal decomposition, plan creation, risk estimation,
 * validation checklists, and approval gating.
 *
 * No autonomous code execution happens here — only planning.
 * All execution is channelled through CommandProposalService.
 */

import type { CommandRiskClass } from './command-policy';

// ─── Plan status ──────────────────────────────────────────────────────────────

export type SelfBuildRunStatus =
  | 'draft'           // Plan created, not yet started
  | 'awaiting_admin'  // Presented to admin for approval
  | 'in_progress'     // Actively executing milestones
  | 'paused'          // Admin paused execution
  | 'completed'       // All milestones done
  | 'failed'          // One or more milestones failed
  | 'cancelled';      // Admin cancelled

// ─── Goal ────────────────────────────────────────────────────────────────────

export interface SelfBuildGoal {
  id: string;
  title: string;
  description: string;
  /** Who requested this — 'admin' | 'aura' | agent name */
  requestedBy: string;
  createdAt: string;
  priority: 'low' | 'medium' | 'high';
  /** Rough effort estimate: number of files, commits, or milestones */
  estimatedEffort: 'small' | 'medium' | 'large';
}

// ─── Risks ───────────────────────────────────────────────────────────────────

export interface SelfBuildRisk {
  id: string;
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigationStrategy: string;
}

// ─── Approval gate ────────────────────────────────────────────────────────────

export interface SelfBuildApprovalGate {
  id: string;
  description: string;
  riskClass: CommandRiskClass;
  requiredBefore: string; // Task or milestone ID
  resolved: boolean;
  resolvedAt?: string;
  decision?: 'approved' | 'rejected';
}

// ─── Task ────────────────────────────────────────────────────────────────────

export interface SelfBuildTask {
  id: string;
  milestoneId: string;
  order: number;
  title: string;
  description: string;
  type: 'create_file' | 'edit_file' | 'run_command' | 'git_op' | 'write_memory' | 'human_action';
  riskClass: CommandRiskClass;
  requiresApproval: boolean;
  /** Proposed commands that this task would generate */
  proposedCommands: string[];
  /** Files that would be created or modified */
  affectedFiles: string[];
  status: 'pending' | 'approved' | 'running' | 'done' | 'failed' | 'skipped';
}

// ─── Milestone ────────────────────────────────────────────────────────────────

export interface SelfBuildMilestone {
  id: string;
  planId: string;
  order: number;
  title: string;
  description: string;
  tasks: SelfBuildTask[];
  approvalGates: SelfBuildApprovalGate[];
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  branchName?: string;
  commitMessage?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface SelfBuildValidationResult {
  milestoneId: string;
  lintPassed: boolean | null;
  buildPassed: boolean | null;
  tauriBuildPassed: boolean | null;
  manualCheckRequired: boolean;
  notes: string[];
  checklist: Array<{ item: string; done: boolean }>;
}

// ─── Full plan ────────────────────────────────────────────────────────────────

export interface SelfBuildPlan {
  id: string;
  goal: SelfBuildGoal;
  milestones: SelfBuildMilestone[];
  risks: SelfBuildRisk[];
  overallRisk: CommandRiskClass;
  status: SelfBuildRunStatus;
  branchStrategy: 'one-per-milestone' | 'single-branch';
  estimatedCommandCount: number;
  estimatedFileCount: number;
  requiresAdminApproval: boolean;
  validation: SelfBuildValidationResult | null;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  memoryEntryPlan?: string;  // Description of memory entries to create on completion
}

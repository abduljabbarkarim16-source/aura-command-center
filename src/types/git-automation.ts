/**
 * AURA Git Automation Types — Milestone E
 *
 * Planning layer for git branch/commit/merge operations.
 * No real git execution yet — produces command proposals instead.
 * Real git execution wires in through CommandProposalService → Phase 2J.
 */

// ─── Git operation status ─────────────────────────────────────────────────────

export type GitOperationStatus =
  | 'planned'    // Proposed, not yet executed
  | 'approved'   // Admin approved the plan
  | 'running'    // Currently executing (Phase 2J+)
  | 'succeeded'
  | 'failed'
  | 'cancelled';

// ─── Risk ────────────────────────────────────────────────────────────────────

export type GitRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface GitBranchPlan {
  id: string;
  baseBranch: string;
  newBranchName: string;
  purpose: string;
  milestoneTag?: string;
  status: GitOperationStatus;
  risk: GitRisk;
  proposedCommands: string[];  // Commands to execute (via CommandProposalService)
  createdAt: string;
}

export interface GitCommitPlan {
  id: string;
  branchName: string;
  message: string;
  files: string[];       // Files to stage (explicit list — never glob)
  status: GitOperationStatus;
  risk: GitRisk;
  proposedCommands: string[];
  createdAt: string;
}

export interface GitMergePlan {
  id: string;
  sourceBranch: string;
  targetBranch: string;
  mergeMessage: string;
  requiresValidation: boolean;
  validationChecklist: string[];
  status: GitOperationStatus;
  risk: GitRisk;
  proposedCommands: string[];
  createdAt: string;
}

// ─── Full automation plan ────────────────────────────────────────────────────

export interface GitAutomationPlan {
  id: string;
  goal: string;
  branchPlan: GitBranchPlan | null;
  commitPlan: GitCommitPlan | null;
  mergePlan: GitMergePlan | null;
  overallRisk: GitRisk;
  requiresAdminApproval: boolean;
  estimatedCommandCount: number;
  createdAt: string;
}

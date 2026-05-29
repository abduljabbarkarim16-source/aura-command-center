/**
 * AURA Command Policy Types — Milestone C
 *
 * Defines the risk classification and approval requirement system for
 * any command AURA might propose or execute. This is the safety gating
 * layer between "AURA proposes an action" and "action executes."
 *
 * No commands are executed here — only classified and policy-checked.
 */

// ─── Risk classification ──────────────────────────────────────────────────────

/**
 * Four-level risk classification for any proposed command.
 * Maps to approval requirements and UI urgency.
 */
export type CommandRiskClass = 'safe' | 'moderate' | 'high' | 'critical';

// ─── Command category ─────────────────────────────────────────────────────────

export type CommandCategory =
  | 'read_only'          // Read files, list dirs, inspect git state
  | 'build'              // npm run build, tsc, cargo build
  | 'test'               // npm test, cargo test
  | 'lint'               // npm run lint, eslint, prettier
  | 'install_dependency' // npm install, cargo add, pip install
  | 'git_status'         // git status, git log, git diff (read-only)
  | 'git_branch'         // git checkout -b, git branch
  | 'git_commit'         // git add, git commit
  | 'git_push'           // git push
  | 'file_write'         // Write/edit a source file
  | 'file_delete'        // Delete a file
  | 'network'            // Expose ports, make HTTP calls
  | 'environment'        // Read/write .env, change config
  | 'process'            // Start/stop processes
  | 'unknown';           // Could not classify

// ─── Approval requirements ────────────────────────────────────────────────────

export type CommandApprovalRequirement =
  | 'none'          // No approval needed — safe to run
  | 'soft'          // Notify but don't block
  | 'required'      // Must be explicitly approved in UI
  | 'admin_only'    // Must be approved by admin (not automatable)
  | 'blocked';      // Never execute — blocked by policy

// ─── Decision ────────────────────────────────────────────────────────────────

export interface CommandPolicyDecision {
  command: string;
  riskClass: CommandRiskClass;
  category: CommandCategory;
  approvalRequirement: CommandApprovalRequirement;
  reason: string;
  matchedPattern?: string;
  blocked: boolean;
  canAutoRun: boolean;   // true only when riskClass=safe and approvalRequirement=none
}

// ─── Pattern ─────────────────────────────────────────────────────────────────

export interface CommandPattern {
  id: string;
  pattern: string | RegExp;
  riskClass: CommandRiskClass;
  category: CommandCategory;
  approvalRequirement: CommandApprovalRequirement;
  description: string;
}

// ─── Policy set ──────────────────────────────────────────────────────────────

export interface CommandPolicySet {
  id: string;
  name: string;
  description: string;
  patterns: CommandPattern[];
  defaultRiskClass: CommandRiskClass;
  defaultApproval: CommandApprovalRequirement;
}

// ─── Execution mode ──────────────────────────────────────────────────────────

export type CommandExecutionMode =
  | 'proposal'    // AURA proposes, admin approves, admin executes
  | 'dry_run'     // Describe what would happen, don't execute
  | 'gated'       // Approval + automatic execution (Phase 2J+)
  | 'blocked';    // Never execute

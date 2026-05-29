/**
 * CommandPolicyService — AURA Milestone C
 *
 * Classifies any command string into a risk class and determines
 * the approval requirement before AURA proposes execution.
 *
 * Design rules:
 * - This service NEVER executes commands — only classifies them.
 * - Every command passes through classifyCommand() before being proposed.
 * - Unknown commands default to 'high' risk and 'required' approval.
 * - Critical-class commands are always blocked from autonomous execution.
 * - Patterns are checked in order; first match wins.
 */

import type {
  CommandPolicyDecision,
  CommandPattern,
  CommandPolicySet,
  CommandRiskClass,
  CommandCategory,
  CommandApprovalRequirement,
} from '../../types/command-policy';

// ─── Pattern library ─────────────────────────────────────────────────────────
// Order matters: more specific patterns should come before general ones.

const PATTERNS: CommandPattern[] = [
  // ── Critical — always blocked ──────────────────────────────────────────
  {
    id: 'c-rm-rf',
    pattern: /rm\s+-rf/i,
    riskClass: 'critical', category: 'file_delete',
    approvalRequirement: 'blocked',
    description: 'Recursive force delete — always blocked',
  },
  {
    id: 'c-del-f',
    pattern: /del\s+\/[Ff]/i,
    riskClass: 'critical', category: 'file_delete',
    approvalRequirement: 'blocked',
    description: 'Windows force delete — always blocked',
  },
  {
    id: 'c-format',
    pattern: /^format\s/i,
    riskClass: 'critical', category: 'file_delete',
    approvalRequirement: 'blocked',
    description: 'Disk format command — always blocked',
  },
  {
    id: 'c-force-push',
    pattern: /git\s+push\s+.*--force/i,
    riskClass: 'critical', category: 'git_push',
    approvalRequirement: 'blocked',
    description: 'Force push destroys remote history — always blocked',
  },
  {
    id: 'c-secret-print',
    pattern: /\$env:VITE_|import\.meta\.env\.VITE_.*console|print.*API_KEY/i,
    riskClass: 'critical', category: 'environment',
    approvalRequirement: 'blocked',
    description: 'Printing API key values — always blocked',
  },
  {
    id: 'c-eval',
    pattern: /\beval\s*\(/i,
    riskClass: 'critical', category: 'unknown',
    approvalRequirement: 'blocked',
    description: 'eval() execution — always blocked',
  },
  {
    id: 'c-git-main-direct',
    pattern: /git\s+push\s+.*\s+main$/i,
    riskClass: 'critical', category: 'git_push',
    approvalRequirement: 'admin_only',
    description: 'Pushing directly to main requires admin approval',
  },

  // ── High — explicit admin approval required ────────────────────────────
  {
    id: 'h-git-push',
    pattern: /^git\s+push/i,
    riskClass: 'high', category: 'git_push',
    approvalRequirement: 'required',
    description: 'Push to remote — requires approval',
  },
  {
    id: 'h-npm-install-pkg',
    pattern: /npm\s+install\s+[^-]/i,
    riskClass: 'high', category: 'install_dependency',
    approvalRequirement: 'required',
    description: 'Install production package — requires approval',
  },
  {
    id: 'h-tauri-build',
    pattern: /tauri\s+build|tauri:build/i,
    riskClass: 'high', category: 'build',
    approvalRequirement: 'required',
    description: 'Tauri production build — requires approval (slow + installer-level)',
  },
  {
    id: 'h-file-delete',
    pattern: /\bdelete\b|Remove-Item|rmdir/i,
    riskClass: 'high', category: 'file_delete',
    approvalRequirement: 'required',
    description: 'File or directory deletion — requires approval',
  },
  {
    id: 'h-expose-port',
    pattern: /--port\s+\d+|listen\(\d+\)|0\.0\.0\.0/i,
    riskClass: 'high', category: 'network',
    approvalRequirement: 'required',
    description: 'Network port exposure — requires approval',
  },
  {
    id: 'h-git-merge-main',
    pattern: /git\s+merge\s+.*main|git\s+merge\s+.*master/i,
    riskClass: 'high', category: 'git_branch',
    approvalRequirement: 'admin_only',
    description: 'Merging to main — admin only',
  },
  {
    id: 'h-env-write',
    pattern: /\.env\b/i,
    riskClass: 'high', category: 'environment',
    approvalRequirement: 'required',
    description: 'Writing to .env file — requires approval',
  },

  // ── Moderate — approval recommended ───────────────────────────────────
  {
    id: 'm-vite-build',
    pattern: /npm\s+run\s+build|vite\s+build/i,
    riskClass: 'moderate', category: 'build',
    approvalRequirement: 'required',
    description: 'Vite build — approval recommended',
  },
  {
    id: 'm-file-write',
    pattern: /write|edit|create.*file|new-item.*file/i,
    riskClass: 'moderate', category: 'file_write',
    approvalRequirement: 'required',
    description: 'File write/edit — requires approval',
  },
  {
    id: 'm-git-commit',
    pattern: /^git\s+commit/i,
    riskClass: 'moderate', category: 'git_commit',
    approvalRequirement: 'required',
    description: 'Git commit — requires approval',
  },
  {
    id: 'm-git-checkout-b',
    pattern: /git\s+checkout\s+-b/i,
    riskClass: 'moderate', category: 'git_branch',
    approvalRequirement: 'required',
    description: 'Create git branch — requires approval',
  },
  {
    id: 'm-git-add',
    pattern: /^git\s+add/i,
    riskClass: 'moderate', category: 'git_commit',
    approvalRequirement: 'soft',
    description: 'Stage files — soft approval',
  },
  {
    id: 'm-npm-install-dev',
    pattern: /npm\s+install\s+--save-dev|npm\s+install\s+-D/i,
    riskClass: 'moderate', category: 'install_dependency',
    approvalRequirement: 'required',
    description: 'Install dev dependency — requires approval',
  },
  {
    id: 'm-tauri-dev',
    pattern: /tauri\s+dev|tauri:dev/i,
    riskClass: 'moderate', category: 'process',
    approvalRequirement: 'required',
    description: 'Tauri dev mode — approval recommended',
  },

  // ── Safe — no approval needed ──────────────────────────────────────────
  {
    id: 's-lint',
    pattern: /npm\s+run\s+lint|tsc\s+--noEmit/i,
    riskClass: 'safe', category: 'lint',
    approvalRequirement: 'none',
    description: 'TypeScript/lint check — safe',
  },
  {
    id: 's-git-status',
    pattern: /^git\s+status|^git\s+log|^git\s+diff|^git\s+branch\b/i,
    riskClass: 'safe', category: 'git_status',
    approvalRequirement: 'none',
    description: 'Git read-only commands — safe',
  },
  {
    id: 's-git-branch-show',
    pattern: /git\s+branch\s+--show-current/i,
    riskClass: 'safe', category: 'git_status',
    approvalRequirement: 'none',
    description: 'Show current branch — safe',
  },
  {
    id: 's-git-fetch',
    pattern: /^git\s+fetch/i,
    riskClass: 'safe', category: 'git_status',
    approvalRequirement: 'none',
    description: 'Fetch remote refs — safe',
  },
  {
    id: 's-read-file',
    pattern: /^cat\s|^type\s|^Get-Content|^head\s|^tail\s/i,
    riskClass: 'safe', category: 'read_only',
    approvalRequirement: 'none',
    description: 'Read file contents — safe',
  },
  {
    id: 's-list-dir',
    pattern: /^ls\s*|^dir\s*|^Get-ChildItem/i,
    riskClass: 'safe', category: 'read_only',
    approvalRequirement: 'none',
    description: 'List directory — safe',
  },
  {
    id: 's-npm-test',
    pattern: /npm\s+run\s+test|npm\s+test|vitest/i,
    riskClass: 'safe', category: 'test',
    approvalRequirement: 'none',
    description: 'Run tests — safe',
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

class CommandPolicyService {
  private customPatterns: CommandPattern[] = [];

  // ── Classification ────────────────────────────────────────────────────────

  classifyCommand(command: string): CommandPolicyDecision {
    const cmd = command.trim();
    if (!cmd) {
      return this.buildDecision(cmd, 'safe', 'unknown', 'none', 'Empty command', undefined);
    }

    // Check all patterns (custom first, then built-in)
    const allPatterns = [...this.customPatterns, ...PATTERNS];
    for (const pattern of allPatterns) {
      const matched =
        typeof pattern.pattern === 'string'
          ? cmd.toLowerCase().includes(pattern.pattern.toLowerCase())
          : pattern.pattern.test(cmd);

      if (matched) {
        return this.buildDecision(
          cmd,
          pattern.riskClass,
          pattern.category,
          pattern.approvalRequirement,
          pattern.description,
          pattern.id,
        );
      }
    }

    // Default for unknown commands: high risk
    return this.buildDecision(
      cmd, 'high', 'unknown', 'required',
      'Unrecognised command — defaulting to high risk', undefined,
    );
  }

  requiresApproval(command: string): boolean {
    const decision = this.classifyCommand(command);
    return decision.approvalRequirement !== 'none' && decision.approvalRequirement !== 'soft';
  }

  explainDecision(command: string): string {
    const d = this.classifyCommand(command);
    return [
      `Command: "${d.command}"`,
      `Risk: ${d.riskClass.toUpperCase()}`,
      `Category: ${d.category}`,
      `Approval: ${d.approvalRequirement}`,
      `Reason: ${d.reason}`,
      d.matchedPattern ? `Pattern: ${d.matchedPattern}` : '',
    ].filter(Boolean).join('\n');
  }

  evaluateAutonomousExecution(command: string, hasPlanApproval: boolean = false): { permitted: boolean; reason: string } {
    const d = this.classifyCommand(command);
    if (d.blocked) {
      return { permitted: false, reason: 'Command is strictly blocked by policy.' };
    }
    if (d.canAutoRun) {
      return { permitted: true, reason: 'Command is safe and requires no approval.' };
    }
    if (hasPlanApproval) {
      if (d.approvalRequirement === 'admin_only') {
         return { permitted: false, reason: 'Command requires explicit admin runtime approval, plan approval is insufficient.' };
      }
      return { permitted: true, reason: 'Command requires approval, and plan approval was granted.' };
    }
    return { permitted: false, reason: 'Command requires approval but no plan approval is active.' };
  }

  listPolicies(): CommandPattern[] {
    return [...this.customPatterns, ...PATTERNS];
  }

  addPolicy(pattern: CommandPattern): void {
    this.customPatterns.push(pattern);
  }

  exportPolicyReport(): CommandPolicySet {
    return {
      id: 'aura-default-policy',
      name: 'AURA Default Command Policy',
      description: 'Risk classification rules for all commands proposed by the self-build system.',
      patterns: this.listPolicies(),
      defaultRiskClass: 'high',
      defaultApproval: 'required',
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildDecision(
    command: string,
    riskClass: CommandRiskClass,
    category: CommandCategory,
    approvalRequirement: CommandApprovalRequirement,
    reason: string,
    matchedPattern: string | undefined,
  ): CommandPolicyDecision {
    return {
      command,
      riskClass,
      category,
      approvalRequirement,
      reason,
      matchedPattern,
      blocked: approvalRequirement === 'blocked',
      canAutoRun: riskClass === 'safe' && approvalRequirement === 'none',
    };
  }
}

export const commandPolicyService = new CommandPolicyService();

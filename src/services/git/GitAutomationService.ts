/**
 * GitAutomationService — AURA Milestone E
 *
 * Planning layer for git operations. Produces structured plans and
 * command proposals — does NOT execute git commands directly.
 *
 * All git execution is channelled through CommandProposalService
 * which enforces the approval gate before any real action.
 *
 * Naming conventions:
 * - Phase branches: phase-{N}-{brief-description}
 * - Feature branches: feature/{brief-description}
 * - Fix branches: fix/{brief-description}
 * - Self-build branches: selfbuild-{brief-description}
 */

import type {
  GitBranchPlan,
  GitCommitPlan,
  GitMergePlan,
  GitAutomationPlan,
  GitRisk,
} from '../../types/git-automation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `git-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Safe branch name validation ──────────────────────────────────────────────

const UNSAFE_BRANCH_CHARS = /[^a-zA-Z0-9._\-/]/g;
const RESERVED_NAMES = new Set(['HEAD', 'main', 'master', 'develop', 'release']);

// ─── Service ─────────────────────────────────────────────────────────────────

class GitAutomationService {

  // ── Branch name helpers ───────────────────────────────────────────────────

  /** Sanitise a proposed branch name to git-safe format. */
  validateBranchName(name: string): { valid: boolean; sanitised: string; reason?: string } {
    if (!name.trim()) {
      return { valid: false, sanitised: '', reason: 'Branch name is empty' };
    }
    const sanitised = name.trim().toLowerCase().replace(UNSAFE_BRANCH_CHARS, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (RESERVED_NAMES.has(sanitised)) {
      return { valid: false, sanitised, reason: `"${sanitised}" is a reserved branch name` };
    }
    if (sanitised.length < 3) {
      return { valid: false, sanitised, reason: 'Branch name too short (min 3 chars)' };
    }
    if (sanitised.length > 80) {
      return { valid: false, sanitised: sanitised.slice(0, 80), reason: 'Branch name truncated to 80 chars' };
    }
    return { valid: true, sanitised };
  }

  /** Generate a canonical phase branch name. */
  createPhaseBranchName(phaseNumber: string, description: string): string {
    const safeName = description.toLowerCase().trim().replace(/\s+/g, '-').replace(UNSAFE_BRANCH_CHARS, '');
    return `phase-${phaseNumber}-${safeName}`.slice(0, 80);
  }

  /** Generate a self-build branch name. */
  createSelfBuildBranchName(description: string): string {
    const safeName = description.toLowerCase().trim().replace(/\s+/g, '-').replace(UNSAFE_BRANCH_CHARS, '');
    return `selfbuild-${safeName}`.slice(0, 80);
  }

  // ── Plan creation ──────────────────────────────────────────────────────────

  createBranchPlan(data: {
    baseBranch: string;
    newBranchName: string;
    purpose: string;
    milestoneTag?: string;
  }): GitBranchPlan {
    const validation = this.validateBranchName(data.newBranchName);
    return {
      id: uid(),
      baseBranch: data.baseBranch,
      newBranchName: validation.sanitised || data.newBranchName,
      purpose: data.purpose,
      milestoneTag: data.milestoneTag,
      status: 'planned',
      risk: 'low',
      proposedCommands: [
        `git fetch origin --prune`,
        `git checkout ${data.baseBranch}`,
        `git pull origin ${data.baseBranch}`,
        `git checkout -b ${validation.sanitised || data.newBranchName}`,
      ],
      createdAt: now(),
    };
  }

  createCommitPlan(data: {
    branchName: string;
    message: string;
    files: string[];
  }): GitCommitPlan {
    return {
      id: uid(),
      branchName: data.branchName,
      message: data.message,
      files: data.files,
      status: 'planned',
      risk: 'medium',
      proposedCommands: [
        ...data.files.map(f => `git add ${f}`),
        `git commit -m "${data.message.replace(/"/g, "'")}"`,
      ],
      createdAt: now(),
    };
  }

  createMergePlan(data: {
    sourceBranch: string;
    targetBranch: string;
    mergeMessage: string;
  }): GitMergePlan {
    const isMainTarget = data.targetBranch === 'main' || data.targetBranch === 'master';
    return {
      id: uid(),
      sourceBranch: data.sourceBranch,
      targetBranch: data.targetBranch,
      mergeMessage: data.mergeMessage,
      requiresValidation: true,
      validationChecklist: this.getSafeMergeChecklist(data.sourceBranch, data.targetBranch),
      status: 'planned',
      risk: isMainTarget ? 'high' : 'medium',
      proposedCommands: [
        `npm run lint`,
        `npm run build`,
        `git checkout ${data.targetBranch}`,
        `git pull origin ${data.targetBranch}`,
        `git merge --no-ff origin/${data.sourceBranch} -m "${data.mergeMessage.replace(/"/g, "'")}"`,
        `git push origin ${data.targetBranch}`,
      ],
      createdAt: now(),
    };
  }

  createFullPlan(data: {
    goal: string;
    baseBranch: string;
    newBranchName: string;
    purpose: string;
    commitMessage: string;
    filesToCommit: string[];
    mergeTarget: string;
  }): GitAutomationPlan {
    const branchPlan = this.createBranchPlan({
      baseBranch: data.baseBranch,
      newBranchName: data.newBranchName,
      purpose: data.purpose,
    });
    const commitPlan = this.createCommitPlan({
      branchName: data.newBranchName,
      message: data.commitMessage,
      files: data.filesToCommit,
    });
    const mergePlan = this.createMergePlan({
      sourceBranch: data.newBranchName,
      targetBranch: data.mergeTarget,
      mergeMessage: `Merge ${data.newBranchName}: ${data.goal}`,
    });

    const overallRisk: GitRisk =
      mergePlan.risk === 'high' ? 'high' :
      commitPlan.risk === 'medium' ? 'medium' : 'low';

    return {
      id: uid(),
      goal: data.goal,
      branchPlan,
      commitPlan,
      mergePlan,
      overallRisk,
      requiresAdminApproval: overallRisk !== 'low',
      estimatedCommandCount:
        branchPlan.proposedCommands.length +
        commitPlan.proposedCommands.length +
        mergePlan.proposedCommands.length,
      createdAt: now(),
    };
  }

  // ── Checklists ────────────────────────────────────────────────────────────

  getSafeMergeChecklist(sourceBranch: string, targetBranch: string): string[] {
    const isMain = targetBranch === 'main' || targetBranch === 'master';
    return [
      `Branch "${sourceBranch}" is based on latest "${targetBranch}"`,
      'Working tree is clean (git status shows no changes)',
      'npm run lint passes with zero errors',
      'npm run build succeeds without errors',
      ...(isMain ? [
        'npm run tauri:build produces valid installer',
        'Manual visual check: app opens correctly',
        'No API keys, secrets, or .env files in diff',
        'No destructive changes in diff',
      ] : []),
    ];
  }

  /** Returns instructions for working on the current branch safely. */
  getCurrentBranchInstructions(branchName: string): string[] {
    return [
      `You are on branch: ${branchName}`,
      'Before editing: git status (confirm clean)',
      'After editing: npm run lint (required before commit)',
      'Before push: npm run build (required)',
      'Before merge to main: npm run tauri:build (required)',
      'Commit message format: "Milestone X: Brief description"',
      'Never push --force',
      'Never commit .env files',
      'Never commit API key values',
    ];
  }

  /** Returns a diff summary placeholder (real diff requires Tauri FS). */
  summarizeDiffPlaceholder(files: string[]): string {
    if (!files.length) return 'No files changed.';
    return `${files.length} file(s) modified:\n${files.map(f => `  + ${f}`).join('\n')}\n(Real diff requires Tauri native bridge — planned for Phase 2H)`;
  }
}

export const gitAutomationService = new GitAutomationService();

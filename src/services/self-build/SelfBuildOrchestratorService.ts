/**
 * SelfBuildOrchestratorService — AURA Milestone J
 *
 * Creates structured self-improvement plans from high-level goals.
 * All plans feed through CommandProposalService and require admin approval.
 *
 * Phase 2J design only: generates plans and proposals.
 * No autonomous code editing. All execution is gated.
 *
 * Integration:
 * - GitAutomationService — branch/commit/merge plans
 * - CommandPolicyService — risk classification
 * - CommandProposalService — execution proposals
 * - AgentRouterService — which agent handles each task
 * - NotificationService — plan status notifications
 */

import type {
  SelfBuildGoal,
  SelfBuildPlan,
  SelfBuildMilestone,
  SelfBuildTask,
  SelfBuildRisk,
  SelfBuildApprovalGate,
  SelfBuildValidationResult,
  SelfBuildRunStatus,
} from '../../types/self-build';
import type { CommandRiskClass } from '../../types/command-policy';
import { gitAutomationService } from '../git/GitAutomationService';
import { agentRouter } from '../router/AgentRouterService';
import { notificationService } from '../notifications/NotificationService';
import { providerRegistry } from '../providers/ProviderRegistryService';
import { makeConnectorService } from '../connectors/MakeConnectorService';
import { workspaceController } from '../workspace/WorkspaceControllerService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `sb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Service ──────────────────────────────────────────────────────────────────

type PlanListener = (plans: SelfBuildPlan[]) => void;

class SelfBuildOrchestratorService {
  private plans: SelfBuildPlan[] = [];
  private listeners = new Set<PlanListener>();

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(fn: PlanListener): () => void {
    this.listeners.add(fn);
    fn([...this.plans]);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = [...this.plans];
    for (const fn of this.listeners) fn(snap);
  }

  // ── Goal decomposition ────────────────────────────────────────────────────

  /**
   * Creates a structured plan from a free-form goal description.
   * Returns a plan with milestones, tasks, risk assessment, and command proposals.
   */
  createPlanFromGoal(goalData: Omit<SelfBuildGoal, 'id' | 'createdAt'>): SelfBuildPlan {
    const goal: SelfBuildGoal = { ...goalData, id: uid(), createdAt: now() };
    const milestones = this.decomposeGoal(goal);
    const risks = this.estimateRisk(goal, milestones);
    const overallRisk = this.computeOverallRisk(risks, milestones);
    const plan: SelfBuildPlan = {
      id: uid(),
      goal,
      milestones,
      risks,
      overallRisk,
      status: 'draft',
      branchStrategy: 'one-per-milestone',
      estimatedCommandCount: milestones.reduce((n, m) => n + m.tasks.reduce((t, k) => t + k.proposedCommands.length, 0), 0),
      estimatedFileCount: milestones.reduce((n, m) => n + m.tasks.reduce((t, k) => t + k.affectedFiles.length, 0), 0),
      requiresAdminApproval: overallRisk !== 'safe',
      validation: null,
      createdAt: now(),
      memoryEntryPlan: `Create ai-build-memory entry after completion: "${goal.title}" — outcomes, files changed, validation results.`,
    };
    this.plans = [plan, ...this.plans].slice(0, 50);
    this.notify();

    notificationService.add({
      type: 'info',
      title: 'Self-build plan created',
      message: `"${goal.title}" — ${milestones.length} milestone(s), risk: ${overallRisk}`,
      ttl: 6000,
    });

    return plan;
  }

  // ── Readiness evaluation ──────────────────────────────────────────────────

  /**
   * Evaluates if the system is ready for a full autonomous run.
   * Checks providers, connectors, and workspace state.
   */
  evaluateConnectionReadiness(): {
    ready: boolean;
    dryRunReady: boolean;
    checks: { name: string; passed: boolean; message: string; optional?: boolean }[];
  } {
    const checks: { name: string; passed: boolean; message: string; optional?: boolean }[] = [];

    // 1. LLM Provider (Anthropic + OpenAI are sufficient; Gemini is optional)
    const configuredProviders = providerRegistry.getConfigured();
    const hasLLM = configuredProviders.some(p =>
      p.capabilities.includes('chat') || p.capabilities.includes('code')
    );
    const hasGemini = configuredProviders.some(p => p.providerType === 'gemini');
    checks.push({
      name: 'LLM Provider',
      passed: hasLLM,
      message: hasLLM
        ? `Chat/Code provider configured${hasGemini ? '' : ' — Gemini optional fallback (billing/quota not blocking)'}`
        : 'Missing secret for Anthropic/OpenAI',
    });

    // 2. Make.com Connector
    const makeStatus = makeConnectorService.getConnectionStatus();
    checks.push({
      name: 'Make.com Connector',
      passed: makeStatus === 'configured',
      message: makeStatus === 'configured' ? 'Webhook scenarios active' : 'Scenarios not configured',
    });

    // 3. Workspace (optional for dry run; required for full autonomous run)
    const activeWs = workspaceController.getActiveWorkspace();
    checks.push({
      name: 'Agent Workspace',
      passed: !!activeWs,
      optional: true,
      message: activeWs
        ? `Bound to ${activeWs.name}`
        : 'No active workspace — not required for dry run',
    });

    // 4. Voice providers (optional — not required for self-build)
    checks.push({
      name: 'Voice Providers',
      passed: false,
      optional: true,
      message: 'Voice providers planned; not required for self-build dry run. OpenAI voice can use existing OpenAI key through backend-safe session flow.',
    });

    // Full autonomous run requires all non-optional checks to pass
    const required = checks.filter(c => !c.optional);
    const dryRunReady = required.every(c => c.passed);

    return {
      ready: checks.every(c => c.passed),
      dryRunReady,
      checks,
    };
  }

  /**
   * Specifically creates a plan meant to be executed autonomously
   * by the dispatcher, skipping the standard "preparation" tasks 
   * if already initialized.
   */
  createAutonomousRunPlan(goalData: Omit<SelfBuildGoal, 'id' | 'createdAt'>): SelfBuildPlan {
    const readiness = this.evaluateConnectionReadiness();
    if (!readiness.ready) {
      notificationService.add({
        type: 'danger',
        title: 'Cannot start autonomous run',
        message: 'System is not connection-ready. Check Providers, Connectors, and Workspace.',
        ttl: 8000,
      });
      throw new Error('System not ready for autonomous run');
    }

    const goal: SelfBuildGoal = { ...goalData, id: uid(), createdAt: now() };
    const milestones = this.decomposeGoal(goal); // Reuse decompose logic for now
    
    // Tag this plan as autonomous
    milestones.forEach(m => {
      m.description = `[AUTONOMOUS] ${m.description}`;
    });

    const risks = this.estimateRisk(goal, milestones);
    const overallRisk = this.computeOverallRisk(risks, milestones);

    const plan: SelfBuildPlan = {
      id: uid(),
      goal,
      milestones,
      risks,
      overallRisk,
      status: 'draft',
      branchStrategy: 'one-per-milestone',
      estimatedCommandCount: milestones.reduce((n, m) => n + m.tasks.reduce((t, k) => t + k.proposedCommands.length, 0), 0),
      estimatedFileCount: milestones.reduce((n, m) => n + m.tasks.reduce((t, k) => t + k.affectedFiles.length, 0), 0),
      requiresAdminApproval: true, // Still require gating for critical tasks
      validation: null,
      createdAt: now(),
      memoryEntryPlan: `Create ai-build-memory entry after autonomous completion: "${goal.title}"`,
    };
    
    this.plans = [plan, ...this.plans].slice(0, 50);
    this.notify();

    notificationService.add({
      type: 'info',
      title: 'Autonomous run scheduled',
      message: `Goal: "${goal.title}"`,
      ttl: 6000,
    });

    return plan;
  }

  decomposeGoal(goal: SelfBuildGoal): SelfBuildMilestone[] {
    // Generic decomposition based on goal description
    const desc = goal.description.toLowerCase();
    const milestones: SelfBuildMilestone[] = [];
    const branchName = gitAutomationService.createSelfBuildBranchName(
      goal.title.slice(0, 40).toLowerCase().replace(/\s+/g, '-'),
    );

    // Every plan has these standard milestones
    milestones.push(this.createMilestone(goal.id, 1, 'Preparation', [
      this.createTask(uid(), 'git_op', 'Create feature branch', [
        `git fetch origin --prune`,
        `git checkout main && git pull origin main`,
        `git checkout -b ${branchName}`,
      ], [], 'moderate', true),
      this.createTask(uid(), 'run_command', 'Run baseline validation', [
        'npm run lint',
      ], [], 'safe', false),
    ]));

    // Implementation milestone (generic)
    const implementationTasks: SelfBuildTask[] = [];

    if (desc.includes('type') || desc.includes('interface') || desc.includes('model')) {
      implementationTasks.push(this.createTask(uid(), 'create_file', 'Create type definitions', [],
        ['src/types/new-types.ts'], 'moderate', true));
    }
    if (desc.includes('service') || desc.includes('implement') || desc.includes('add')) {
      implementationTasks.push(this.createTask(uid(), 'create_file', 'Create service implementation', [],
        ['src/services/.../NewService.ts'], 'moderate', true));
    }
    if (desc.includes('ui') || desc.includes('component') || desc.includes('page') || desc.includes('panel')) {
      implementationTasks.push(this.createTask(uid(), 'create_file', 'Create UI component', [],
        ['src/components/.../NewComponent.tsx'], 'moderate', true));
    }
    if (desc.includes('doc') || desc.includes('architecture')) {
      implementationTasks.push(this.createTask(uid(), 'create_file', 'Create documentation', [],
        ['docs/new-feature.md'], 'safe', false));
    }

    if (implementationTasks.length === 0) {
      implementationTasks.push(this.createTask(uid(), 'create_file', 'Implement goal', [],
        ['src/...'], 'moderate', true));
    }

    milestones.push(this.createMilestone(goal.id, 2, 'Implementation', implementationTasks));

    // Validation milestone
    milestones.push(this.createMilestone(goal.id, 3, 'Validation', [
      this.createTask(uid(), 'run_command', 'TypeScript check', ['npm run lint'], [], 'safe', false),
      this.createTask(uid(), 'run_command', 'Vite build', ['npm run build'], [], 'moderate', true),
    ]));

    // Commit + push milestone
    milestones.push(this.createMilestone(goal.id, 4, 'Commit and push', [
      this.createTask(uid(), 'git_op', 'Commit changes', [
        `git add -p`,
        `git commit -m "${goal.title.replace(/"/g, "'")}"`,
      ], [], 'moderate', true),
      this.createTask(uid(), 'git_op', 'Push branch', [
        `git push -u origin ${branchName}`,
      ], [], 'high', true),
    ]));

    // Human action: review + merge
    milestones.push(this.createMilestone(goal.id, 5, 'Review and merge', [
      this.createTask(uid(), 'human_action', 'Admin reviews diff and approves', [],
        [], 'critical', true),
      this.createTask(uid(), 'git_op', 'Merge to main', [
        `git checkout main && git merge --no-ff origin/${branchName} -m "Merge ${branchName}"`,
        `git push origin main`,
      ], [], 'critical', true),
    ]));

    // Tag milestones with branch name and routing info
    milestones.forEach(m => {
      m.branchName = branchName;
      m.commitMessage = m.order === 4 ? goal.title : undefined;
      m.approvalGates = this.createApprovalGates(m);
    });

    return milestones;
  }

  createMilestones(count: number, baseName: string, goalId: string): SelfBuildMilestone[] {
    return Array.from({ length: count }, (_, i) => this.createMilestone(goalId, i + 1, `${baseName} ${i + 1}`, []));
  }

  estimateRisk(goal: SelfBuildGoal, milestones: SelfBuildMilestone[]): SelfBuildRisk[] {
    const risks: SelfBuildRisk[] = [];

    if (milestones.some(m => m.tasks.some(t => t.riskClass === 'critical'))) {
      risks.push({
        id: uid(),
        description: 'Plan includes critical-class operations (merge to main, git push)',
        likelihood: 'high', impact: 'high',
        mitigationStrategy: 'All critical operations require explicit admin approval',
      });
    }

    if (milestones.some(m => m.tasks.some(t => t.type === 'edit_file'))) {
      risks.push({
        id: uid(),
        description: 'Source file edits may introduce regressions',
        likelihood: 'medium', impact: 'medium',
        mitigationStrategy: 'Run npm run lint and npm run build before committing',
      });
    }

    if (goal.estimatedEffort === 'large') {
      risks.push({
        id: uid(),
        description: 'Large effort estimate — plan may need to be broken into sub-plans',
        likelihood: 'medium', impact: 'low',
        mitigationStrategy: 'Review and split milestones if scope grows',
      });
    }

    return risks;
  }

  // ── Plan management ────────────────────────────────────────────────────────

  listPlans(): SelfBuildPlan[] {
    return [...this.plans];
  }

  getPlan(id: string): SelfBuildPlan | null {
    return this.plans.find(p => p.id === id) ?? null;
  }

  updatePlanStatus(id: string, status: SelfBuildRunStatus): SelfBuildPlan | null {
    const idx = this.plans.findIndex(p => p.id === id);
    if (idx < 0) return null;
    this.plans[idx] = { ...this.plans[idx], status };
    this.notify();
    return this.plans[idx];
  }

  createValidationChecklist(milestoneTitle: string): SelfBuildValidationResult {
    const isDeploymentMilestone = milestoneTitle.toLowerCase().includes('build') ||
      milestoneTitle.toLowerCase().includes('deploy');
    return {
      milestoneId: uid(),
      lintPassed: null,
      buildPassed: null,
      tauriBuildPassed: isDeploymentMilestone ? null : undefined,
      manualCheckRequired: isDeploymentMilestone,
      notes: [],
      checklist: [
        { item: 'npm run lint passes with zero errors', done: false },
        { item: 'npm run build produces no errors', done: false },
        ...(isDeploymentMilestone ? [
          { item: 'npm run tauri:build produces installer', done: false },
          { item: 'App launches correctly from production binary', done: false },
        ] : []),
        { item: 'No API keys or secrets in diff', done: false },
        { item: 'Working tree is clean after changes', done: false },
      ],
    };
  }

  createBranchPlan(goalTitle: string, baseBranch = 'main') {
    const branchName = gitAutomationService.createSelfBuildBranchName(
      goalTitle.slice(0, 40).toLowerCase().replace(/\s+/g, '-'),
    );
    return gitAutomationService.createBranchPlan({
      baseBranch,
      newBranchName: branchName,
      purpose: goalTitle,
    });
  }

  createCommandProposals(plan: SelfBuildPlan): string[] {
    return plan.milestones.flatMap(m => m.tasks.flatMap(t => t.proposedCommands));
  }

  createHandoffPlan(plan: SelfBuildPlan): string {
    const decision = agentRouter.route(plan.goal.description);
    return agentRouter.createHandoffSummary(decision);
  }

  createMemoryPlan(plan: SelfBuildPlan): string {
    return [
      `Memory entry to create after "${plan.goal.title}" completes:`,
      `- Title: ${plan.goal.title}`,
      `- Files changed: ${plan.estimatedFileCount}`,
      `- Commands run: ${plan.estimatedCommandCount}`,
      `- Risk class: ${plan.overallRisk}`,
      `- Category: decision (architectural change)`,
      `- Tags: self-build, ${plan.goal.priority}-priority`,
    ].join('\n');
  }

  exportPlan(id: string): Record<string, unknown> | null {
    const plan = this.getPlan(id);
    if (!plan) return null;
    return {
      plan,
      commandProposals: this.createCommandProposals(plan),
      handoffPlan: this.createHandoffPlan(plan),
      memoryPlan: this.createMemoryPlan(plan),
      exportedAt: now(),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private createMilestone(
    planId: string, order: number, title: string, tasks: SelfBuildTask[],
  ): SelfBuildMilestone {
    const milestoneId = uid();
    // Back-patch tasks with the milestone ID and sequential order
    const patchedTasks = tasks.map((t, i) => ({ ...t, milestoneId, order: i + 1 }));
    return {
      id: milestoneId, planId, order, title,
      description: `Milestone ${order}: ${title}`,
      tasks: patchedTasks, approvalGates: [], status: 'pending',
    };
  }

  private createTask(
    id: string,
    type: SelfBuildTask['type'],
    title: string,
    proposedCommands: string[],
    affectedFiles: string[],
    riskClass: CommandRiskClass,
    requiresApproval: boolean,
  ): SelfBuildTask {
    return {
      id, milestoneId: '', order: 0, title, description: title,
      type, riskClass, requiresApproval, proposedCommands, affectedFiles,
      status: 'pending',
    };
  }

  private createApprovalGates(milestone: SelfBuildMilestone): SelfBuildApprovalGate[] {
    return milestone.tasks
      .filter(t => t.requiresApproval)
      .map(t => ({
        id: uid(),
        description: `Approve: ${t.title}`,
        riskClass: t.riskClass,
        requiredBefore: t.id,
        resolved: false,
      }));
  }

  private computeOverallRisk(risks: SelfBuildRisk[], milestones: SelfBuildMilestone[]): CommandRiskClass {
    const hasCritical = milestones.some(m => m.tasks.some(t => t.riskClass === 'critical'));
    if (hasCritical) return 'critical';
    const hasHigh = milestones.some(m => m.tasks.some(t => t.riskClass === 'high'));
    if (hasHigh) return 'high';
    const hasHighImpactRisk = risks.some(r => r.impact === 'high' && r.likelihood !== 'low');
    if (hasHighImpactRisk) return 'high';
    const hasModerate = milestones.some(m => m.tasks.some(t => t.riskClass === 'moderate'));
    if (hasModerate) return 'moderate';
    const hasModerateRisk = risks.some(r => r.impact === 'medium' || r.likelihood === 'high');
    if (hasModerateRisk) return 'moderate';
    return 'safe';
  }
}

export const selfBuildOrchestrator = new SelfBuildOrchestratorService();

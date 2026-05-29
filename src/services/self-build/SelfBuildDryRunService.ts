/**
 * SelfBuildDryRunService — AURA Phase 3B
 *
 * Runs a controlled self-build dry run:
 *   1. Checks readiness (relaxed — workspace not required for dry run)
 *   2. Creates a self-build plan from a fixed low-risk goal
 *   3. Calls ProviderPlanningService for one minimal Anthropic planning suggestion
 *   4. Classifies and proposes safe validation commands via CommandProposalService
 *   5. Sends a Make.com dry-run payload (local only, no live call)
 *   6. Optionally sends one approved Make.com live event on completion
 *   7. Logs all events to RuntimeTimelineService
 *   8. Returns a structured dry-run report
 *
 * Boundaries:
 * - No source edits
 * - No git push
 * - No destructive commands
 * - No secrets in any payload
 * - No repeated live provider calls
 * - One Make.com live event maximum (after completion, if approved)
 */

import { selfBuildOrchestrator } from './SelfBuildOrchestratorService';
import { commandProposalService } from '../commands/CommandProposalService';
import { commandPolicyService } from '../commands/CommandPolicyService';
import { providerPlanningService } from '../providers/ProviderPlanningService';
import { makeConnectorService } from '../connectors/MakeConnectorService';
import { runtimeTimeline } from '../runtime/RuntimeTimelineService';
import { notificationService } from '../notifications/NotificationService';
import type { SelfBuildPlan } from '../../types/self-build';
import type { PlanningResult } from '../providers/ProviderPlanningService';
import type { ProposedCommand } from '../../types/command-runner';

// ─── Report type ──────────────────────────────────────────────────────────────

export interface CommandProposalSummary {
  command: string;
  riskClass: string;
  status: string;
  canAutoRun: boolean;
}

export interface DryRunReport {
  success: boolean;
  goal: string;
  planId: string;
  planStatus: string;
  providerResult: PlanningResult;
  commandProposals: CommandProposalSummary[];
  makeDryRun: { success: boolean; message: string };
  makeLiveEvent: { sent: boolean; statusCode?: number; message: string };
  timelineEvents: string[];
  timestamp: string;
  error?: string;
}

// ─── Sanitised status (no secrets, no paths, no code) ────────────────────────

const SANITIZED_STATUS = [
  'Make.com connected — webhook live',
  'Anthropic connected — smoke test passed',
  'OpenAI connected — smoke test passed',
  'Gemini optional — billing/quota uncertain',
  'Native bridge safe commands enabled (git status, npm lint)',
  'Voice foundation pending — microphone not requested',
  'Self-build dry run in progress',
].join('\n');

const DRY_RUN_GOAL = 'Review AURA connection readiness UI and propose one low-risk improvement that does not require source edits.';

const SAFE_COMMANDS = [
  { command: 'git', args: ['status', '--short'], reason: 'Check working tree state', expected: 'List of modified/untracked files' },
  { command: 'npm', args: ['run', 'lint'],       reason: 'Run TypeScript lint check',  expected: 'Zero type errors' },
];

// ─── Service ──────────────────────────────────────────────────────────────────

type DryRunListener = (report: DryRunReport | null) => void;

class SelfBuildDryRunServiceImpl {
  private lastReport: DryRunReport | null = null;
  private running = false;
  private listeners = new Set<DryRunListener>();

  subscribe(fn: DryRunListener): () => void {
    this.listeners.add(fn);
    fn(this.lastReport);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn(this.lastReport);
  }

  isRunning(): boolean { return this.running; }
  getLastReport(): DryRunReport | null { return this.lastReport; }

  // ── Readiness (relaxed for dry run) ──────────────────────────────────────

  isDryRunReady(): { ready: boolean; reason: string } {
    const full = selfBuildOrchestrator.evaluateConnectionReadiness();
    // For dry run: LLM + Make are sufficient; workspace is not required
    const llmCheck = full.checks.find(c => c.name === 'LLM Provider');
    const makeCheck = full.checks.find(c => c.name === 'Make.com Connector');
    if (!llmCheck?.passed) return { ready: false, reason: 'LLM provider not configured' };
    if (!makeCheck?.passed) return { ready: false, reason: 'Make.com connector not configured' };
    return { ready: true, reason: 'LLM + Make.com ready — workspace not required for dry run' };
  }

  // ── Main run ──────────────────────────────────────────────────────────────

  async run(options: { sendLiveMakeEvent?: boolean } = {}): Promise<DryRunReport> {
    if (this.running) {
      return this.lastReport ?? this.errorReport('Already running');
    }
    this.running = true;
    const timelineEvents: string[] = [];

    const log = (msg: string) => {
      timelineEvents.push(msg);
      runtimeTimeline.addEvent({
        timestamp: Date.now(),
        category: 'system',
        severity: 'info',
        title: msg,
        source: 'SelfBuildDryRunService',
      });
    };

    try {
      log('Phase 3B dry run started');

      // ── Readiness check ──────────────────────────────────────────────────
      const readiness = this.isDryRunReady();
      if (!readiness.ready) {
        return this.done(this.errorReport(`Readiness check failed: ${readiness.reason}`), timelineEvents);
      }
      log(`Readiness: ${readiness.reason}`);

      // ── Create self-build plan ────────────────────────────────────────────
      const plan: SelfBuildPlan = selfBuildOrchestrator.createPlanFromGoal({
        title: 'Phase 3B Controlled Dry Run',
        description: DRY_RUN_GOAL,
        requestedBy: 'SelfBuildDryRunService',
        priority: 'low',
        estimatedEffort: 'small',
      });
      log(`Plan created: ${plan.id} — ${plan.milestones.length} milestones`);

      // ── Provider-assisted planning (one call) ──────────────────────────────
      log('Requesting planning suggestion from provider (Anthropic first)');
      const providerResult = await providerPlanningService.requestPlan(
        { sanitizedStatus: SANITIZED_STATUS },
        false, // live call
      );
      if (providerResult.success && providerResult.proposal) {
        log(`Provider (${providerResult.provider}/${providerResult.model}) returned: "${providerResult.proposal.title}" — risk: ${providerResult.proposal.risk}`);
      } else {
        log(`Provider call failed: ${providerResult.error ?? 'unknown'}`);
      }

      // ── Command proposals ─────────────────────────────────────────────────
      const proposals: ProposedCommand[] = [];
      for (const cmd of SAFE_COMMANDS) {
        const decision = commandPolicyService.classifyCommand(cmd.command);
        if (!decision.blocked) {
          const proposal = commandProposalService.proposeCommand({
            command: cmd.command,
            args: cmd.args,
            reason: cmd.reason,
            proposedBy: 'SelfBuildDryRunService',
            expectedOutcome: cmd.expected,
          });
          proposals.push(proposal);
          log(`Command proposed: "${cmd.command} ${cmd.args.join(' ')}" — risk: ${decision.riskClass}, autoRun: ${decision.canAutoRun}`);
        } else {
          log(`Command blocked by policy: "${cmd.command}" — ${decision.reason}`);
        }
      }

      // ── Make.com dry-run payload ──────────────────────────────────────────
      log('Validating Make.com dry-run payload');
      const dryRunMakeResult = makeConnectorService.dryRunPayload(
        makeConnectorService.createPayload('phase3b_self_build_dry_run_completed', 'safe', {
          dryRun: true,
          testMode: true,
          message: 'AURA Phase 3B dry-run payload validation.',
        })
      );
      log(`Make.com dry-run: ${dryRunMakeResult.success ? 'validated' : 'failed'}`);

      // ── Optional Make.com live event ──────────────────────────────────────
      let makeLiveResult = { sent: false, message: 'Not sent (sendLiveMakeEvent=false)' } as DryRunReport['makeLiveEvent'];
      if (options.sendLiveMakeEvent) {
        log('Sending approved Make.com Phase 3B live event');
        const liveResults = await makeConnectorService.triggerScenarioIfConfigured(
          'phase3b_self_build_dry_run_completed',
          'safe',
          {
            source: 'AURA Command Center',
            dryRun: true,
            testMode: false,
            providerUsed: providerResult.provider,
            commandProposalCount: proposals.length,
            validationStatus: providerResult.success ? 'planning_succeeded' : 'planning_failed',
            message: 'AURA Phase 3B controlled self-build dry run completed.',
          },
        );
        const first = liveResults[0];
        makeLiveResult = {
          sent: first?.success ?? false,
          statusCode: first?.statusCode,
          message: first?.message ?? 'No scenarios matched',
        };
        log(`Make.com live event: ${makeLiveResult.sent ? 'sent' : 'failed'} — ${makeLiveResult.message}`);
      }

      // ── Notification ──────────────────────────────────────────────────────
      notificationService.add({
        type: 'success',
        title: 'Self-build dry run complete',
        message: `Plan: ${plan.id} · Provider: ${providerResult.provider} · Proposals: ${proposals.length}`,
        ttl: 8000,
      });

      const report: DryRunReport = {
        success: true,
        goal: DRY_RUN_GOAL,
        planId: plan.id,
        planStatus: plan.status,
        providerResult,
        commandProposals: proposals.map(p => ({
          command: `${p.command} ${p.args.join(' ')}`.trim(),
          riskClass: p.riskClass,
          status: p.status,
          canAutoRun: p.canAutoRun,
        })),
        makeDryRun: { success: dryRunMakeResult.success, message: dryRunMakeResult.message ?? '' },
        makeLiveEvent: makeLiveResult,
        timelineEvents,
        timestamp: new Date().toISOString(),
      };

      log('Phase 3B dry run completed successfully');
      return this.done(report, timelineEvents);

    } catch (err) {
      const msg = String(err);
      log(`Dry run error: ${msg}`);
      return this.done(this.errorReport(msg, timelineEvents), timelineEvents);
    }
  }

  private done(report: DryRunReport, events: string[]): DryRunReport {
    report.timelineEvents = events;
    this.lastReport = report;
    this.running = false;
    this.notify();
    return report;
  }

  private errorReport(msg: string, events: string[] = []): DryRunReport {
    return {
      success: false,
      goal: DRY_RUN_GOAL,
      planId: '',
      planStatus: 'error',
      providerResult: { success: false, provider: 'none', model: 'none', isDryRun: false, error: msg },
      commandProposals: [],
      makeDryRun: { success: false, message: msg },
      makeLiveEvent: { sent: false, message: msg },
      timelineEvents: events,
      timestamp: new Date().toISOString(),
      error: msg,
    };
  }
}

export const selfBuildDryRunService = new SelfBuildDryRunServiceImpl();

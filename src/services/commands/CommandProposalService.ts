/**
 * CommandProposalService — AURA Milestone D + Native Execution Bridge
 *
 * Manages the full lifecycle of proposed commands — from AURA drafting
 * a proposal through admin approval to execution via the native bridge.
 *
 * Integration:
 * - Uses CommandPolicyService to classify every proposal before creating it
 * - Emits to NotificationService when a proposal needs approval
 * - Bridges to VoiceRuntimeService to surface approval tray for high-risk proposals
 * - Executes approved allowlisted commands via NativeCommandService
 * - Records execution results to timeline via RuntimeTimelineService
 */

import type {
  ProposedCommand,
  CommandProposalStatus,
  CommandExecutionResult,
  CommandAuditEvent,
  CommandQueueSnapshot,
} from '../../types/command-runner';
import { commandPolicyService } from './CommandPolicyService';
import { notificationService } from '../notifications/NotificationService';
import { voiceRuntimeService } from '../voice/VoiceRuntimeService';
import { nativeCommandService } from '../native/NativeCommandService';
import { runtimeTimeline } from '../runtime/RuntimeTimelineService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Service ──────────────────────────────────────────────────────────────────

type QueueListener = (snapshot: CommandQueueSnapshot) => void;

class CommandProposalService {
  private proposals: ProposedCommand[]         = [];
  private auditLog: CommandAuditEvent[]        = [];
  private results: Map<string, CommandExecutionResult> = new Map();
  private listeners = new Set<QueueListener>();
  private readonly MAX_PROPOSALS = 100;

  /** Maps VoiceRuntime approval IDs → proposal IDs for approval correlation */
  private approvalMap = new Map<string, string>();

  constructor() {
    // Subscribe to VoiceRuntime to catch approval resolutions and correlate them
    // back to the originating command proposal.
    voiceRuntimeService.subscribe(snapshot => {
      for (const event of snapshot.recentEvents) {
        if (event.type === 'approval_resolved' && event.payload?.id) {
          const approvalId = event.payload.id as string;
          const proposalId = this.approvalMap.get(approvalId);
          if (proposalId) {
            const decision = event.payload.decision as string;
            if (decision === 'approved') {
              this.approveProposal(proposalId);
            } else {
              this.rejectProposal(proposalId, 'Rejected via voice approval');
            }
            this.approvalMap.delete(approvalId);
          }
        }
      }
    });
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(fn: QueueListener): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) fn(snap);
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  getSnapshot(): CommandQueueSnapshot {
    return {
      total:     this.proposals.length,
      pending:   this.proposals.filter(p => p.status === 'pending_approval').length,
      approved:  this.proposals.filter(p => p.status === 'approved' || p.status === 'ready_to_run').length,
      rejected:  this.proposals.filter(p => p.status === 'rejected').length,
      running:   this.proposals.filter(p => p.status === 'running').length,
      proposals: [...this.proposals],
    };
  }

  // ── Propose ───────────────────────────────────────────────────────────────

  proposeCommand(data: {
    command: string;
    args?: string[];
    workingDirectory?: string;
    reason: string;
    proposedBy?: string;
    workspaceId?: string;
    expectedOutcome?: string;
    affectedPaths?: string[];
  }): ProposedCommand {
    const cmd = [data.command, ...(data.args ?? [])].join(' ');
    const decision = commandPolicyService.classifyCommand(data.command);

    const proposal: ProposedCommand = {
      id:               uid(),
      command:          data.command,
      args:             data.args ?? [],
      workingDirectory: data.workingDirectory ?? '',
      riskClass:        decision.riskClass,
      category:         decision.category,
      reason:           data.reason,
      proposedBy:       data.proposedBy ?? 'aura',
      proposedAt:       now(),
      status:           decision.blocked ? 'rejected' : 'drafted',
      workspaceId:      data.workspaceId ?? '',
      requiresApproval: commandPolicyService.requiresApproval(data.command),
      canAutoRun:       decision.canAutoRun,
      expectedOutcome:  data.expectedOutcome,
      affectedPaths:    data.affectedPaths,
    };

    this.addAudit(proposal.id, 'aura', 'proposal_created',
      `Command: "${cmd}" | Risk: ${decision.riskClass} | Approval: ${decision.approvalRequirement}`);

    if (decision.blocked) {
      this.addAudit(proposal.id, 'system', 'proposal_blocked', decision.reason);
      notificationService.add({
        type: 'danger',
        title: 'Command blocked by policy',
        message: `"${data.command}" — ${decision.reason}`,
        ttl: 6000,
      });
    } else {
      this.proposals = [proposal, ...this.proposals].slice(0, this.MAX_PROPOSALS);
      this.surfaceProposal(proposal);
    }

    this.notify();
    return proposal;
  }

  // ── Status transitions ────────────────────────────────────────────────────

  listProposals(filter?: Partial<{ status: CommandProposalStatus }>): ProposedCommand[] {
    if (!filter) return [...this.proposals];
    return this.proposals.filter(p =>
      (!filter.status || p.status === filter.status)
    );
  }

  getProposal(id: string): ProposedCommand | null {
    return this.proposals.find(p => p.id === id) ?? null;
  }

  approveProposal(id: string): ProposedCommand | null {
    return this.transitionStatus(id, 'approved', 'admin', 'Admin approved');
  }

  rejectProposal(id: string, reason?: string): ProposedCommand | null {
    const p = this.transitionStatus(id, 'rejected', 'admin', reason ?? 'Admin rejected');
    if (p) {
      notificationService.add({
        type: 'info',
        title: 'Command proposal rejected',
        message: `"${p.command}"`,
        ttl: 4000,
      });
    }
    return p;
  }

  markRunning(id: string): ProposedCommand | null {
    return this.transitionStatus(id, 'running', 'system', 'Execution started');
  }

  markSucceeded(id: string, result?: Partial<CommandExecutionResult>): ProposedCommand | null {
    const p = this.transitionStatus(id, 'succeeded', 'system', 'Execution succeeded');
    if (p && result) {
      this.results.set(id, {
        proposalId: id, startedAt: now(), completedAt: now(),
        exitCode: 0, stdout: '', stderr: '', succeeded: true,
        summary: result.summary ?? 'Completed.',
        ...result,
      });
    }
    if (p) {
      notificationService.add({
        type: 'success',
        title: 'Command succeeded',
        message: `"${p.command}"`,
        ttl: 4000,
      });
    }
    return p;
  }

  markFailed(id: string, reason?: string): ProposedCommand | null {
    const p = this.transitionStatus(id, 'failed', 'system', reason ?? 'Execution failed');
    if (p) {
      notificationService.add({
        type: 'danger',
        title: 'Command failed',
        message: `"${p.command}" — ${reason ?? 'Unknown error'}`,
        ttl: 6000,
      });
    }
    return p;
  }

  archiveProposal(id: string): void {
    this.proposals = this.proposals.filter(p => p.id !== id);
    this.notify();
  }

  exportAuditLog(): CommandAuditEvent[] {
    return [...this.auditLog];
  }

  getResult(id: string): CommandExecutionResult | null {
    return this.results.get(id) ?? null;
  }

  // ── Execution via Native Bridge ─────────────────────────────────────────

  /**
   * Execute an approved proposal through the Tauri native command bridge.
   * Only runs commands that are approved/ready_to_run AND in the native allowlist.
   */
  async executeProposal(id: string): Promise<CommandExecutionResult | null> {
    const proposal = this.getProposal(id);
    if (!proposal) return null;

    // Validate status — must be approved or ready_to_run
    if (proposal.status !== 'approved' && proposal.status !== 'ready_to_run') {
      this.addAudit(id, 'system', 'execution_rejected',
        `Cannot execute: status is '${proposal.status}', expected 'approved' or 'ready_to_run'`);
      return null;
    }

    // Check native bridge availability
    if (!nativeCommandService.isNativeAvailable()) {
      this.addAudit(id, 'system', 'execution_rejected',
        'Native bridge unavailable — not running in Tauri desktop mode');
      notificationService.add({
        type: 'warning',
        title: 'Cannot execute',
        message: 'Native bridge not available. Run in Tauri desktop mode.',
        ttl: 5000,
      });
      return null;
    }

    // Check allowlist
    if (!nativeCommandService.isCommandAllowed(proposal.command, proposal.args)) {
      this.addAudit(id, 'system', 'execution_rejected',
        `Command not in native allowlist: ${proposal.command}`);
      notificationService.add({
        type: 'danger',
        title: 'Execution blocked',
        message: `"${proposal.command}" is not in the native execution allowlist`,
        ttl: 5000,
      });
      return null;
    }

    // Mark as running
    this.markRunning(id);
    voiceRuntimeService.emit('tool_running', {
      toolName: proposal.command,
      proposalId: id,
    });

    // Execute through native bridge
    const nativeResult = await nativeCommandService.runAllowedCommand(
      proposal.command, proposal.args,
    );

    const completedAt = now();
    const succeeded = nativeResult.allowed && nativeResult.exitCode === 0 && !nativeResult.error;

    // Build execution result
    const result: CommandExecutionResult = {
      proposalId: id,
      startedAt: proposal.proposedAt,
      completedAt,
      exitCode: nativeResult.exitCode,
      stdout: nativeResult.stdout,
      stderr: nativeResult.stderr,
      succeeded,
      summary: succeeded
        ? `Command succeeded (exit code 0, ${nativeResult.durationMs}ms)`
        : nativeResult.error ?? `Failed with exit code ${nativeResult.exitCode}`,
      durationMs: nativeResult.durationMs,
    };

    // Update proposal status and store result
    if (succeeded) {
      this.markSucceeded(id, result);
      voiceRuntimeService.emit('tool_completed', {
        toolName: proposal.command,
        proposalId: id,
        durationMs: nativeResult.durationMs,
      });
    } else {
      this.markFailed(id, result.summary);
      voiceRuntimeService.emit('error', {
        message: `Command failed: ${proposal.command}`,
        proposalId: id,
      });
    }

    // Record to timeline with proposalId as entityId for correlation
    runtimeTimeline.addEvent({
      timestamp: Date.now(),
      severity: succeeded ? 'success' : 'error',
      category: 'tool',
      title: succeeded
        ? `Executed: ${proposal.command} (${nativeResult.durationMs}ms)`
        : `Failed: ${proposal.command} — ${result.summary}`,
      detail: JSON.stringify({
        exitCode: nativeResult.exitCode,
        durationMs: nativeResult.durationMs,
        stdoutLines: nativeResult.stdout.split('\n').length,
        stderrLines: nativeResult.stderr.split('\n').length,
      }),
      source: 'native-bridge',
      entityId: id,
    });

    return result;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private transitionStatus(
    id: string,
    status: CommandProposalStatus,
    actor: CommandAuditEvent['actor'],
    details?: string,
  ): ProposedCommand | null {
    const idx = this.proposals.findIndex(p => p.id === id);
    if (idx < 0) return null;
    this.proposals[idx] = { ...this.proposals[idx], status };
    this.addAudit(id, actor, `status_→_${status}`, details);
    this.notify();
    return this.proposals[idx];
  }

  private addAudit(proposalId: string, actor: CommandAuditEvent['actor'], action: string, details?: string) {
    this.auditLog.push({ id: uid(), proposalId, timestamp: now(), actor, action, details });
  }

  /**
   * Surfaces a proposal to the appropriate UI channel.
   * - Safe commands: info notification only
   * - Moderate/high: approval notification + approval tray via VoiceRuntime
   */
  private surfaceProposal(proposal: ProposedCommand) {
    if (proposal.canAutoRun) {
      // Safe — just update status and notify
      this.proposals = this.proposals.map(p =>
        p.id === proposal.id ? { ...p, status: 'ready_to_run' } : p,
      );
      notificationService.add({
        type: 'tool',
        title: 'Safe command ready',
        message: `"${proposal.command}" — ${proposal.reason}`,
        ttl: 5000,
      });
    } else if (proposal.requiresApproval) {
      // Surface as Voice Core approval
      this.proposals = this.proposals.map(p =>
        p.id === proposal.id ? { ...p, status: 'pending_approval' } : p,
      );
      const approval = voiceRuntimeService.requestApproval({
        title: `Run: ${proposal.command}`,
        summary: proposal.reason,
        riskLevel: proposal.riskClass === 'high' ? 'high' : 'medium',
        requestedAction: [proposal.command, ...proposal.args].join(' '),
        sourceAgent: proposal.proposedBy,
        targetAgent: 'workspace-shell',
      });
      // Store correlation so approval resolution flows back to this proposal
      this.approvalMap.set(approval.id, proposal.id);
    } else {
      // Soft approval — just show notification
      notificationService.add({
        type: 'info',
        title: 'Command proposed',
        message: `"${proposal.command}" — ${proposal.reason}`,
        ttl: 5000,
      });
    }
  }
}

export const commandProposalService = new CommandProposalService();


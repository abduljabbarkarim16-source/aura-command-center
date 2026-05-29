/**
 * CommandProposalService — AURA Milestone D
 *
 * Manages the full lifecycle of proposed commands — from AURA drafting
 * a proposal through admin approval to execution status tracking.
 *
 * Integration:
 * - Uses CommandPolicyService to classify every proposal before creating it
 * - Emits to NotificationService when a proposal needs approval
 * - Bridges to VoiceRuntimeService to surface approval tray for high-risk proposals
 *
 * No actual command execution happens here.
 * Execution support arrives in Milestone J (SelfBuildOrchestratorService).
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
      voiceRuntimeService.requestApproval({
        title: `Run: ${proposal.command}`,
        summary: proposal.reason,
        riskLevel: proposal.riskClass === 'high' ? 'high' : 'medium',
        requestedAction: [proposal.command, ...proposal.args].join(' '),
        sourceAgent: proposal.proposedBy,
        targetAgent: 'workspace-shell',
      });
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


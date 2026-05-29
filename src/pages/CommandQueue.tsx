/**
 * CommandQueue — Native Execution Bridge UI
 *
 * Displays the command proposal queue with approval controls, execution
 * buttons, and result panels. Commands execute through the Tauri native
 * bridge when available.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Terminal, Play, CheckCircle2, XCircle, ShieldAlert,
  Copy, ChevronDown, ChevronRight, Clock, AlertTriangle,
  Shield, Zap, Ban, Loader2,
} from 'lucide-react';
import type { ProposedCommand, CommandExecutionResult } from '../types/command-runner';
import type { NativeBridgeStatus, NativeAllowedCommandEntry } from '../types/native-command';
import { commandProposalService } from '../services/commands/CommandProposalService';
import { nativeCommandService } from '../services/native/NativeCommandService';

// ─── Risk class styling ───────────────────────────────────────────────────────

const RISK_STYLES: Record<string, { bg: string; text: string; icon: typeof Shield }> = {
  safe:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: Shield },
  moderate: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   icon: AlertTriangle },
  high:     { bg: 'bg-orange-500/10',   text: 'text-orange-400',  icon: ShieldAlert },
  critical: { bg: 'bg-rose-500/10',     text: 'text-rose-400',    icon: Ban },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  drafted:          { bg: 'bg-zinc-700/20',    text: 'text-zinc-400' },
  pending_approval: { bg: 'bg-amber-500/10',   text: 'text-amber-400' },
  approved:         { bg: 'bg-indigo-500/10',  text: 'text-indigo-400' },
  ready_to_run:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  running:          { bg: 'bg-blue-500/10',    text: 'text-blue-400' },
  succeeded:        { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  failed:           { bg: 'bg-rose-500/10',    text: 'text-rose-400' },
  rejected:         { bg: 'bg-rose-500/10',    text: 'text-rose-400' },
  logged:           { bg: 'bg-zinc-700/20',    text: 'text-zinc-500' },
  cancelled:        { bg: 'bg-zinc-700/20',    text: 'text-zinc-500' },
};

// ─── Bridge status indicator ──────────────────────────────────────────────────

function BridgeStatusBadge({ status }: { status: NativeBridgeStatus }) {
  if (status === 'available') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Native Bridge Connected
      </span>
    );
  }
  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-lg">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking Bridge…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
      <AlertTriangle className="w-3 h-3" />
      Native Bridge Unavailable
    </span>
  );
}

// ─── Proposal card ────────────────────────────────────────────────────────────

interface ProposalCardProps {
  proposal: ProposedCommand;
  result: CommandExecutionResult | null;
  isAllowed: boolean;
  bridgeAvailable: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
}

function ProposalCard({
  proposal,
  result,
  isAllowed,
  bridgeAvailable,
  onApprove,
  onReject,
  onExecute,
}: ProposalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const risk = RISK_STYLES[proposal.riskClass] ?? RISK_STYLES.safe;
  const statusStyle = STATUS_STYLES[proposal.status] ?? STATUS_STYLES.drafted;
  const RiskIcon = risk.icon;

  const fullCommand = [proposal.command, ...proposal.args].join(' ');
  const canApprove = proposal.status === 'pending_approval';
  const canRun = (proposal.status === 'approved' || proposal.status === 'ready_to_run')
    && isAllowed && bridgeAvailable;
  const isRunning = proposal.status === 'running';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [fullCommand]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden transition-all duration-200 hover:border-zinc-700/80">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${risk.bg}`}>
              <RiskIcon className={`w-4 h-4 ${risk.text}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-sm text-white font-mono truncate">{fullCommand}</code>
                <button
                  id={`copy-${proposal.id}`}
                  onClick={handleCopy}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                  title="Copy command"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {copied && <span className="text-[10px] text-emerald-400">Copied!</span>}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {proposal.reason} • {proposal.category} • by {proposal.proposedBy}
              </div>
            </div>
          </div>

          {/* Status + Risk badges */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${risk.bg} ${risk.text}`}>
              {proposal.riskClass.toUpperCase()}
            </span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text}`}>
              {proposal.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          {canApprove && (
            <>
              <button
                id={`approve-${proposal.id}`}
                onClick={() => onApprove(proposal.id)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                id={`reject-${proposal.id}`}
                onClick={() => onReject(proposal.id)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}

          {canRun && (
            <button
              id={`run-${proposal.id}`}
              onClick={() => onExecute(proposal.id)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
            >
              <Play className="w-3.5 h-3.5" /> Run
            </button>
          )}

          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Executing…
            </span>
          )}

          {!isAllowed && (proposal.status === 'approved' || proposal.status === 'ready_to_run') && (
            <span className="text-xs text-zinc-500 italic">Not in native allowlist</span>
          )}

          {isAllowed && !bridgeAvailable && (proposal.status === 'approved' || proposal.status === 'ready_to_run') && (
            <span className="text-xs text-amber-400/70 italic">Native bridge unavailable</span>
          )}

          {/* Toggle result panel */}
          {result && (
            <button
              id={`toggle-result-${proposal.id}`}
              onClick={() => setExpanded(p => !p)}
              className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {result.succeeded ? 'View result' : 'View error'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable result panel */}
      {result && expanded && (
        <div className="border-t border-zinc-800 p-4 bg-zinc-900/50">
          <div className="flex items-center gap-3 mb-3">
            {result.succeeded ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Exit code: {result.exitCode}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                <XCircle className="w-3.5 h-3.5" /> Exit code: {result.exitCode}
              </span>
            )}
            {result.durationMs !== undefined && (
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock className="w-3 h-3" /> {result.durationMs}ms
              </span>
            )}
          </div>

          {result.stdout && (
            <div className="mb-3">
              <div className="text-zinc-600 mb-1 uppercase tracking-wider text-[10px] font-semibold">stdout</div>
              <pre className="text-xs text-zinc-400 bg-zinc-950 border border-zinc-800/50 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto font-mono custom-scrollbar">
                {result.stdout}
              </pre>
            </div>
          )}

          {result.stderr && (
            <div>
              <div className="text-zinc-600 mb-1 uppercase tracking-wider text-[10px] font-semibold">stderr</div>
              <pre className="text-xs text-rose-400/70 bg-rose-500/5 border border-zinc-800/50 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto font-mono custom-scrollbar">
                {result.stderr}
              </pre>
            </div>
          )}

          <div className="mt-2 text-xs text-zinc-500">{result.summary}</div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CommandQueue() {
  const [proposals, setProposals] = useState<ProposedCommand[]>([]);
  const [results, setResults] = useState<Map<string, CommandExecutionResult>>(new Map());
  const [bridgeStatus, setBridgeStatus] = useState<NativeBridgeStatus>('checking');
  const [allowedCommands, setAllowedCommands] = useState<NativeAllowedCommandEntry[]>([]);

  // Subscribe to proposal service
  useEffect(() => {
    return commandProposalService.subscribe(snap => {
      setProposals(snap.proposals);
      // Refresh results for any proposal with execution data
      const newResults = new Map<string, CommandExecutionResult>();
      for (const p of snap.proposals) {
        const r = commandProposalService.getResult(p.id);
        if (r) newResults.set(p.id, r);
      }
      setResults(newResults);
    });
  }, []);

  // Subscribe to bridge status
  useEffect(() => {
    const unsub = nativeCommandService.subscribe(setBridgeStatus);
    nativeCommandService.validateNativeBridge();
    nativeCommandService.listAllowedCommands().then(setAllowedCommands);
    return unsub;
  }, []);

  // Compute allowlist set for fast lookup
  const allowedSet = useMemo(() => {
    const set = new Set<string>();
    for (const cmd of allowedCommands) {
      set.add(`${cmd.program}|${cmd.args.join(',')}`);
    }
    return set;
  }, [allowedCommands]);

  const isAllowed = useCallback((p: ProposedCommand) => {
    return allowedSet.has(`${p.command}|${p.args.join(',')}`);
  }, [allowedSet]);

  // Actions
  const handleApprove = useCallback((id: string) => {
    commandProposalService.approveProposal(id);
  }, []);

  const handleReject = useCallback((id: string) => {
    commandProposalService.rejectProposal(id);
  }, []);

  const handleExecute = useCallback(async (id: string) => {
    await commandProposalService.executeProposal(id);
  }, []);

  // Stats
  const stats = useMemo(() => {
    const pending = proposals.filter(p => p.status === 'pending_approval').length;
    const approved = proposals.filter(p => p.status === 'approved' || p.status === 'ready_to_run').length;
    const running = proposals.filter(p => p.status === 'running').length;
    const done = proposals.filter(p => p.status === 'succeeded' || p.status === 'failed').length;
    return { pending, approved, running, done };
  }, [proposals]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Command Queue</h1>
          <p className="text-zinc-400 text-sm">Review, approve, and execute commands through the native bridge</p>
        </div>
        <BridgeStatusBadge status={bridgeStatus} />
      </div>

      {/* Warning banner when bridge unavailable */}
      {bridgeStatus === 'unavailable' && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-amber-300">Native bridge unavailable</div>
            <div className="text-xs text-amber-400/70 mt-0.5">
              Command execution requires running in Tauri desktop mode. Use <code className="text-amber-300">npm run tauri:dev</code> to launch the desktop app.
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-amber-400 font-medium">{stats.pending}</span>
          <span className="text-zinc-500">pending</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-indigo-400 font-medium">{stats.approved}</span>
          <span className="text-zinc-500">approved</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-blue-400 font-medium">{stats.running}</span>
          <span className="text-zinc-500">running</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-300 font-medium">{stats.done}</span>
          <span className="text-zinc-500">completed</span>
        </div>
      </div>

      {/* Proposal list */}
      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
        {proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <Terminal className="w-8 h-8 mb-3 opacity-40" />
            <div className="text-sm">No command proposals yet</div>
            <div className="text-xs text-zinc-600 mt-1">
              Commands proposed by AURA agents will appear here for review
            </div>
          </div>
        ) : (
          proposals.map(p => (
            <div key={p.id}>
              <ProposalCard
                proposal={p}
                result={results.get(p.id) ?? null}
                isAllowed={isAllowed(p)}
                bridgeAvailable={bridgeStatus === 'available'}
                onApprove={handleApprove}
                onReject={handleReject}
                onExecute={handleExecute}
              />
            </div>
          ))
        )}
      </div>

      {/* Allowlist reference */}
      {allowedCommands.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase mb-2 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            Native Execution Allowlist
          </div>
          <div className="flex flex-wrap gap-2">
            {allowedCommands.map((cmd, i) => (
              <span key={i} className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-1 rounded-md">
                {cmd.program} {cmd.args.join(' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { ShieldCheck, XCircle, CheckCircle2, AlertCircle, Play, Zap, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { selfBuildOrchestrator } from '../../services/self-build/SelfBuildOrchestratorService';
import { selfBuildDryRunService } from '../../services/self-build/SelfBuildDryRunService';
import type { DryRunReport } from '../../services/self-build/SelfBuildDryRunService';

export function SelfBuildReadinessPanel() {
  const [readiness, setReadiness] = useState(selfBuildOrchestrator.evaluateConnectionReadiness());
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);
  const [dryRunRunning, setDryRunRunning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setReadiness(selfBuildOrchestrator.evaluateConnectionReadiness());
    }, 2000);
    const unsub = selfBuildDryRunService.subscribe(r => setDryRunReport(r));
    return () => { clearInterval(interval); unsub(); };
  }, []);

  const handleDryRun = async () => {
    setDryRunRunning(true);
    await selfBuildDryRunService.run({ sendLiveMakeEvent: true });
    setDryRunRunning(false);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/40 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-200">Autonomous Run Readiness</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Phase 3B — Anthropic + OpenAI + Make.com sufficient for dry run
          </p>
        </div>
        <span className={cn(
          'px-2.5 py-1 rounded-full text-[11px] font-semibold border',
          readiness.dryRunReady
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
        )}>
          {readiness.ready ? 'Full run ready' : readiness.dryRunReady ? 'Dry run ready' : 'Checks failing'}
        </span>
      </div>

      {/* Checks */}
      <div className="divide-y divide-zinc-800/30 p-1">
        {readiness.checks.map((check, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/20 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center">
                {check.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : check.optional ? (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-medium text-zinc-300">
                  {check.name}
                  {check.optional && <span className="ml-1.5 text-[10px] text-zinc-500 font-normal">(optional)</span>}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{check.message}</p>
              </div>
            </div>
            {!check.passed && !check.optional && (
              <span className="text-[10px] uppercase font-semibold tracking-wide text-rose-500/70 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                Required
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Dry run report */}
      {dryRunReport && (
        <div className={cn(
          'mx-4 mb-3 p-3 rounded-lg border text-[11px]',
          dryRunReport.success
            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
            : 'bg-rose-500/5 border-rose-500/20 text-rose-300'
        )}>
          <p className="font-semibold mb-1">
            {dryRunReport.success ? 'Dry run completed' : 'Dry run failed'}
          </p>
          {dryRunReport.providerResult.proposal && (
            <p className="text-zinc-400 mb-0.5">
              Suggestion: <span className="text-zinc-200">{dryRunReport.providerResult.proposal.title}</span>
            </p>
          )}
          <p className="text-zinc-500">
            Provider: {dryRunReport.providerResult.provider}/{dryRunReport.providerResult.model}
            {dryRunReport.providerResult.latencyMs ? ` · ${dryRunReport.providerResult.latencyMs}ms` : ''}
            {' '}· Proposals: {dryRunReport.commandProposals.length}
            {' '}· Make: {dryRunReport.makeLiveEvent.sent ? 'sent ✓' : 'not sent'}
          </p>
          {dryRunReport.error && <p className="text-rose-400 mt-1">{dryRunReport.error}</p>}
        </div>
      )}

      {/* Footer */}
      <div className="bg-zinc-950/40 p-4 border-t border-zinc-800/40 flex items-center justify-between">
        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
          Full autonomous run requires workspace + all checks
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDryRun}
            disabled={!readiness.dryRunReady || dryRunRunning}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition',
              readiness.dryRunReady && !dryRunRunning
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-indigo-600/30 text-white/40 cursor-not-allowed'
            )}
          >
            {dryRunRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {dryRunRunning ? 'Running…' : 'Run Dry Run'}
          </button>
          <button
            disabled={true}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700/30 text-white/30 rounded-lg text-[11px] font-semibold cursor-not-allowed"
          >
            <Play className="w-3 h-3" />
            Full Run
          </button>
        </div>
      </div>
    </div>
  );
}

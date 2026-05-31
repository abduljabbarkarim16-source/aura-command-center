/**
 * CapabilityGapsPanel — AURA Phase 3G (Milestone 13)
 *
 * Shows what AURA can't do yet and lets it propose (not execute) an upgrade:
 * a suggested task, a branch plan, and a handoff prompt for Claude/Codex.
 * Recording a gap writes a memory entry. Execution stays approval-gated.
 */

import { useEffect, useState, useCallback } from 'react';
import { Lightbulb, ClipboardCopy, Save, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { capabilityRegistryService } from '../../services/capabilities/CapabilityRegistryService';
import { capabilityGapService, type CapabilityGapReport } from '../../services/capabilities/CapabilityGapService';
import { capabilityGapPlannerService, type GapPlan } from '../../services/capabilities/CapabilityGapPlannerService';

export function CapabilityGapsPanel() {
  const [report, setReport] = useState<CapabilityGapReport>(() => capabilityGapService.report());
  const [plans, setPlans] = useState<Record<string, GapPlan>>({});

  useEffect(() => capabilityRegistryService.subscribe(() => setReport(capabilityGapService.report())), []);

  const plan = useCallback((id: string) => {
    const p = capabilityGapPlannerService.planFor(id);
    if (p) setPlans(prev => ({ ...prev, [id]: p }));
  }, []);

  const record = useCallback((id: string) => {
    const p = capabilityGapPlannerService.recordGap(id);
    if (p) setPlans(prev => ({ ...prev, [id]: p }));
  }, []);

  const copy = (text: string) => navigator.clipboard.writeText(text).catch(() => {});
  const next = capabilityGapPlannerService.nextMissingPlan();
  const allGaps = [...report.gaps, ...report.degraded];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-3 py-2.5 border-b border-zinc-800/60">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">
          <Lightbulb className="w-3 h-3 text-amber-400" /> Capability Gaps
        </span>
        <p className="mt-1 text-[10px] text-zinc-500 leading-relaxed">{report.text}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
        {next && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-300">Next to build</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-200">{next.name}</p>
            <p className="text-[9px] text-zinc-500">{next.suggestedTask} · effort: {next.effort}</p>
            <button onClick={() => record(next.capabilityId)}
              className="mt-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-amber-300 hover:bg-amber-500/10 border border-amber-500/30">
              <Save className="w-2.5 h-2.5" /> Record + plan
            </button>
          </div>
        )}

        {allGaps.map(g => {
          const p = plans[g.capability.id];
          return (
            <div key={g.capability.id} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-zinc-200 flex-1 truncate">{g.capability.name}</span>
                <span className={cn('text-[9px] px-1 py-0.5 rounded font-semibold',
                  g.capability.status === 'planned' ? 'text-sky-400' :
                  g.capability.status === 'blocked' ? 'text-rose-400' :
                  g.capability.status === 'degraded' ? 'text-amber-400' : 'text-zinc-400')}>
                  {g.capability.status}
                </span>
              </div>
              <p className="mt-0.5 text-[9px] text-zinc-500 leading-snug">{g.whyNot}</p>
              {!p ? (
                <button onClick={() => plan(g.capability.id)}
                  className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10 border border-zinc-700/50">
                  <ChevronRight className="w-2.5 h-2.5" /> Plan upgrade
                </button>
              ) : (
                <div className="mt-1.5 space-y-1">
                  <p className="text-[9px] text-zinc-400"><span className="text-zinc-600">task:</span> {p.suggestedTask}</p>
                  <p className="text-[9px] text-zinc-400 font-mono"><span className="text-zinc-600">branch:</span> {p.branchPlan}</p>
                  <div className="rounded bg-zinc-950/60 border border-zinc-800 p-1.5">
                    <pre className="text-[8px] text-zinc-500 font-mono whitespace-pre-wrap leading-snug max-h-24 overflow-y-auto">{p.handoffPrompt}</pre>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => copy(p.handoffPrompt)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-zinc-400 hover:text-zinc-200 border border-zinc-700/50">
                      <ClipboardCopy className="w-2.5 h-2.5" /> Copy handoff
                    </button>
                    <button onClick={() => record(g.capability.id)}
                      className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border',
                        p.recordedToMemory ? 'text-emerald-400 border-emerald-500/30' : 'text-zinc-400 hover:text-amber-300 border-zinc-700/50')}>
                      <Save className="w-2.5 h-2.5" /> {p.recordedToMemory ? 'Recorded' : 'Record to memory'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

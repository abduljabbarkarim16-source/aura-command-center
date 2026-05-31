/**
 * CapabilitiesPanel — AURA Phase 3G
 *
 * Operator view of AURA's self-knowledge: what it can/can't do, with evidence.
 * Each testable capability has a Test button; "Test all" runs the low-risk set.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck, AlertTriangle, Clock, Ban, HelpCircle, Play, Loader2, RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { capabilityRegistryService } from '../../services/capabilities/CapabilityRegistryService';
import { capabilityGapService } from '../../services/capabilities/CapabilityGapService';
import type { Capability, CapabilityStatus } from '../../types/capabilities';

const STATUS_META: Record<CapabilityStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  available: { label: 'available', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', icon: <ShieldCheck className="w-3 h-3" /> },
  degraded:  { label: 'degraded',  cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10',     icon: <AlertTriangle className="w-3 h-3" /> },
  planned:   { label: 'planned',   cls: 'text-sky-400 border-sky-500/30 bg-sky-500/10',           icon: <Clock className="w-3 h-3" /> },
  blocked:   { label: 'blocked',   cls: 'text-rose-400 border-rose-500/30 bg-rose-500/10',        icon: <Ban className="w-3 h-3" /> },
  unknown:   { label: 'untested',  cls: 'text-zinc-400 border-zinc-600/40 bg-zinc-700/20',        icon: <HelpCircle className="w-3 h-3" /> },
};

export function CapabilitiesPanel() {
  const [caps, setCaps] = useState<Capability[]>(() => capabilityRegistryService.getAll());
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [gapText, setGapText] = useState('');

  useEffect(() => capabilityRegistryService.subscribe(setCaps), []);
  useEffect(() => { setGapText(capabilityGapService.report().text); }, [caps]);

  const runTest = useCallback(async (id: string) => {
    setTesting(t => ({ ...t, [id]: true }));
    try { await capabilityRegistryService.test(id); }
    finally { setTesting(t => ({ ...t, [id]: false })); }
  }, []);

  const runAll = useCallback(async () => {
    setRunningAll(true);
    try { await capabilityRegistryService.testAll(); }
    finally { setRunningAll(false); }
  }, []);

  const summary = capabilityRegistryService.summary();
  const byCat: Record<string, Capability[]> = {};
  for (const c of caps) (byCat[c.category] ??= []).push(c);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header / summary */}
      <div className="shrink-0 px-3 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">Capabilities</span>
          <button onClick={runAll} disabled={runningAll}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-zinc-700/50 transition-colors disabled:opacity-50">
            {runningAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Test all
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_META) as CapabilityStatus[]).map(s => (
            <span key={s} className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold', STATUS_META[s].cls)}>
              {STATUS_META[s].icon}{summary[s]} {STATUS_META[s].label}
            </span>
          ))}
        </div>
        {gapText && <p className="mt-2 text-[10px] text-zinc-500 leading-relaxed">{gapText}</p>}
      </div>

      {/* Capability list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
        {Object.entries(byCat).map(([cat, list]) => (
          <div key={cat}>
            <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1">{cat}</div>
            <div className="space-y-1.5">
              {list.map(c => {
                const meta = STATUS_META[c.status];
                return (
                  <div key={c.id} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold shrink-0', meta.cls)}>
                        {meta.icon}{meta.label}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-200 truncate flex-1">{c.name}</span>
                      {c.testable && (
                        <button onClick={() => runTest(c.id)} disabled={testing[c.id]}
                          title={`Test ${c.id}`}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-zinc-700/50 transition-colors disabled:opacity-50">
                          {testing[c.id] ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                          Test
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500 leading-snug">{c.description}</p>
                    {c.evidence.lastTestResult && (
                      <p className="mt-1 text-[9px] text-zinc-600 font-mono leading-snug">› {c.evidence.lastTestResult}</p>
                    )}
                    {c.status !== 'available' && c.upgradePlan && (
                      <p className="mt-1 text-[9px] text-sky-500/80 leading-snug">↑ {c.upgradePlan}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

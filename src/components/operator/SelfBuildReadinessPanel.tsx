import React, { useEffect, useState } from 'react';
import { ShieldCheck, XCircle, CheckCircle2, Play } from 'lucide-react';
import { cn } from '../../lib/utils';
import { selfBuildOrchestrator } from '../../services/self-build/SelfBuildOrchestratorService';

export function SelfBuildReadinessPanel() {
  const [readiness, setReadiness] = useState(selfBuildOrchestrator.evaluateConnectionReadiness());

  useEffect(() => {
    // We poll or just evaluate on mount. For a real app, we'd subscribe to changes
    // in all the underlying services, but for this panel, a simple interval is fine
    // to keep it updated if the user configures something in another tab.
    const interval = setInterval(() => {
      setReadiness(selfBuildOrchestrator.evaluateConnectionReadiness());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800/40 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-200">Autonomous Run Readiness</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            System checks required before launching autonomous build loops
          </p>
        </div>
        <span className={cn(
          'px-2.5 py-1 rounded-full text-[11px] font-semibold border',
          readiness.ready
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
        )}>
          {readiness.ready ? 'Ready for auto-run' : 'Checks failing'}
        </span>
      </div>

      <div className="divide-y divide-zinc-800/30 p-1">
        {readiness.checks.map((check, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/20 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center">
                {check.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-medium text-zinc-300">{check.name}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{check.message}</p>
              </div>
            </div>
            {!check.passed && (
              <span className="text-[10px] uppercase font-semibold tracking-wide text-rose-500/70 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                Action Required
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="bg-zinc-950/40 p-4 border-t border-zinc-800/40 flex items-center justify-between">
        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
          Autonomous runs are disabled in Phase 2
        </p>
        <button
          disabled={true}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/50 text-white/50 rounded-lg text-[11px] font-semibold cursor-not-allowed"
        >
          <Play className="w-3 h-3" />
          Launch Run
        </button>
      </div>
    </div>
  );
}

/**
 * SelfTestPanel — AURA Phase 3G (Milestone 8)
 *
 * Runs AuraSelfTestService and renders a pass/fail table with evidence and
 * suggested fixes. Lets AURA be verified without voice.
 */

import { useState, useCallback } from 'react';
import { Play, Loader2, CheckCircle2, XCircle, MinusCircle, Clock, FileText, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { auraSelfTestService, type SelfTestRun, type SelfTestStatus } from '../../services/testing/AuraSelfTestService';

const ICON: Record<SelfTestStatus, React.ReactNode> = {
  pass:    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  fail:    <XCircle className="w-3.5 h-3.5 text-rose-400" />,
  skip:    <MinusCircle className="w-3.5 h-3.5 text-zinc-500" />,
  running: <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
  pending: <Clock className="w-3.5 h-3.5 text-zinc-600" />,
};

export function SelfTestPanel() {
  const [run, setRun] = useState<SelfTestRun | null>(() => auraSelfTestService.getLastRun());
  const [running, setRunning] = useState(false);
  const [includeTiny, setIncludeTiny] = useState(false);

  const start = useCallback(async () => {
    setRunning(true);
    try {
      await auraSelfTestService.run({ includeTinyPrompts: includeTiny, onProgress: r => setRun({ ...r }) });
    } finally {
      setRunning(false);
    }
  }, [includeTiny]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-3 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">
            <Zap className="w-3 h-3 text-indigo-400" /> Self-Test
          </span>
          <button onClick={start} disabled={running}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-zinc-300 hover:text-white bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500/40 transition-colors disabled:opacity-50">
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {running ? 'Running…' : 'Run self-test'}
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer">
          <input type="checkbox" checked={includeTiny} onChange={e => setIncludeTiny(e.target.checked)}
            className="accent-indigo-500 w-3 h-3" />
          Include approved tiny CLI prompts (Claude/Codex)
        </label>
        {run && (
          <div className="flex items-center gap-2 mt-2 text-[10px]">
            <span className="text-emerald-400">{run.passCount} pass</span>
            <span className="text-rose-400">{run.failCount} fail</span>
            <span className="text-zinc-500">{run.skipCount} skip</span>
            {run.finishedAt && <span className="text-zinc-600 ml-auto">{new Date(run.finishedAt).toLocaleTimeString()}</span>}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1">
        {!run && <p className="text-[10px] text-zinc-600 italic">No self-test run yet. Click “Run self-test”.</p>}
        {run?.steps.map(s => (
          <div key={s.id} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              {ICON[s.status]}
              <span className="text-[11px] text-zinc-200 flex-1 truncate">{s.name}</span>
              {s.durationMs != null && <span className="text-[9px] text-zinc-600">{s.durationMs}ms</span>}
            </div>
            {s.detail && <p className="mt-0.5 ml-5 text-[9px] text-zinc-500 font-mono leading-snug">{s.detail}</p>}
            {s.suggestedFix && <p className="mt-0.5 ml-5 text-[9px] text-amber-500/80 leading-snug">fix: {s.suggestedFix}</p>}
          </div>
        ))}
      </div>

      {run && (
        <div className="shrink-0 px-3 py-2 border-t border-zinc-800/60">
          <a className="flex items-center gap-1 text-[9px] text-zinc-600 hover:text-zinc-400" href="#" onClick={e => e.preventDefault()}>
            <FileText className="w-2.5 h-2.5" /> {run.docsPath}
          </a>
        </div>
      )}
    </div>
  );
}

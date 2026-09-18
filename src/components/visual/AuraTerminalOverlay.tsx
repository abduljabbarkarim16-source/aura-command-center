import { X, Terminal, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { TerminalVisualData } from '../../types/visual-canvas';
import { cn } from '../../lib/utils';

interface AuraTerminalOverlayProps {
  data: TerminalVisualData | null;
  onClose?: () => void;
  className?: string;
}

function formatElapsed(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function StatusIcon({ status }: { status: TerminalVisualData['status'] }) {
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-300" />;
  if (status === 'success') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />;
  if (status === 'failed' || status === 'blocked') return <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />;
  return <Terminal className="h-3.5 w-3.5 text-zinc-500" />;
}

export function AuraTerminalOverlay({ data, onClose, className }: AuraTerminalOverlayProps) {
  if (!data) return null;

  return (
    <div
      className={cn(
        'pointer-events-auto absolute right-4 top-16 z-20 flex max-h-[42vh] w-[min(28rem,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/88 shadow-2xl backdrop-blur-xl',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-zinc-800/70 px-3 py-2">
        <StatusIcon status={data.status} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] text-zinc-200">{data.command ?? 'Terminal visual'}</p>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">
            {data.illustrative ? 'Illustrative only' : data.taskId ? `Task ${data.taskId}` : 'Runtime task'}
            {data.durationMs != null ? ` / ${formatElapsed(data.durationMs)}` : ''}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-200" title="Close terminal visual">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed custom-scrollbar">
        {data.logs.length === 0 ? (
          <p className="text-zinc-600">No runtime logs yet.</p>
        ) : data.logs.map((log, index) => (
          <div
            key={`${log.timestamp ?? 'log'}-${index}`}
            className={cn(
              'whitespace-pre-wrap break-words',
              log.level === 'error' ? 'text-rose-300'
                : log.level === 'warn' ? 'text-amber-300'
                  : log.level === 'success' ? 'text-emerald-300'
                    : 'text-zinc-400',
            )}
          >
            {log.timestamp && <span className="mr-2 select-none text-zinc-700">{new Date(log.timestamp).toLocaleTimeString()}</span>}
            {log.message}
          </div>
        ))}
      </div>

      {data.resultSummary && (
        <div className="border-t border-zinc-800/70 bg-zinc-900/45 px-3 py-2 text-[10px] leading-relaxed text-zinc-400">
          {data.resultSummary}
        </div>
      )}
    </div>
  );
}

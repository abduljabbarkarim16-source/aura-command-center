import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Database,
  FileText,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react';
import { runtimeTaskService, type RuntimeTaskEvent } from '../../services/runtime/RuntimeTaskService';
import type { RuntimeTask } from '../../types/runtime-task';
import { cn } from '../../lib/utils';

type CanvasMode =
  | 'idle'
  | 'tool_running'
  | 'terminal_running'
  | 'cli_running'
  | 'memory_update'
  | 'task_completed'
  | 'task_failed';

function formatElapsed(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function getMode(task: RuntimeTask | null): CanvasMode {
  if (!task) return 'idle';
  if (task.status === 'completed') return 'task_completed';
  if (task.status === 'failed' || task.status === 'blocked' || task.status === 'cancelled') return 'task_failed';
  if (task.type === 'terminal') return 'terminal_running';
  if (task.type === 'cli') return 'cli_running';
  if (task.type === 'memory') return 'memory_update';
  return 'tool_running';
}

function modeMeta(mode: CanvasMode) {
  switch (mode) {
    case 'terminal_running':
      return { label: 'terminal running', icon: <Terminal className="h-3.5 w-3.5" />, tone: 'text-sky-300 border-sky-500/25 bg-sky-500/10' };
    case 'cli_running':
      return { label: 'CLI running', icon: <Sparkles className="h-3.5 w-3.5" />, tone: 'text-violet-300 border-violet-500/25 bg-violet-500/10' };
    case 'memory_update':
      return { label: 'memory update', icon: <Database className="h-3.5 w-3.5" />, tone: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10' };
    case 'task_completed':
      return { label: 'task completed', icon: <CheckCircle2 className="h-3.5 w-3.5" />, tone: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10' };
    case 'task_failed':
      return { label: 'needs attention', icon: <AlertTriangle className="h-3.5 w-3.5" />, tone: 'text-rose-300 border-rose-500/25 bg-rose-500/10' };
    case 'tool_running':
      return { label: 'tool running', icon: <Activity className="h-3.5 w-3.5" />, tone: 'text-indigo-300 border-indigo-500/25 bg-indigo-500/10' };
    default:
      return { label: 'idle', icon: <Brain className="h-3.5 w-3.5" />, tone: 'text-zinc-500 border-zinc-800/70 bg-zinc-900/30' };
  }
}

export function LivingVisualCanvas() {
  const [task, setTask] = useState<RuntimeTask | null>(() => {
    const active = runtimeTaskService.listActive();
    return active[0] ?? null;
  });
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: RuntimeTaskEvent) => {
      const active = runtimeTaskService.listActive();
      const current = active.find(t => t.id === task?.id);

      if (current) {
        setTask({ ...current });
        return;
      }

      if (active.length > 0) {
        setTask({ ...active[0] });
        return;
      }

      if (event.task.id === task?.id || event.type === 'task_completed' || event.type === 'task_failed' || event.type === 'task_blocked') {
        setTask({ ...event.task });
      }
    };

    const unsubscribe = runtimeTaskService.subscribe(handler);
    return unsubscribe;
  }, [task?.id]);

  useEffect(() => {
    if (task?.logs.length) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task?.logs.length]);

  const mode = getMode(task);
  const meta = modeMeta(mode);
  const lastLog = task?.logs[task.logs.length - 1];
  const summary = task?.summary || task?.error || lastLog?.message;

  if (!task || mode === 'idle') {
    return (
      <div className="mb-2 flex w-full items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-900/25 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Brain className="h-3.5 w-3.5 shrink-0 text-zinc-700" />
          <span className="truncate text-[11px] text-zinc-600">Working surface idle</span>
        </div>
        <span className="text-[10px] text-zinc-700">real tasks appear here</span>
      </div>
    );
  }

  return (
    <div className="mb-3 flex w-full flex-col overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950/85 shadow-xl">
      <div className="flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-900/75 px-3 py-2">
        <span className={cn('flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold', meta.tone)}>
          {meta.icon}
          {meta.label}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[12px] font-semibold text-zinc-200">{task.title}</span>
            {task.toolId && <span className="truncate font-mono text-[9px] text-zinc-600">{task.toolId}</span>}
          </div>
          <p className="mt-0.5 truncate text-[9px] text-zinc-600">
            {task.source} / {task.type}{task.elapsedMs != null ? ` / ${formatElapsed(task.elapsedMs)}` : ''}
          </p>
        </div>
        {task.status === 'running' && <Activity className="h-3.5 w-3.5 animate-pulse text-indigo-400" />}
        {mode === 'task_completed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
        {mode === 'task_failed' && <XCircle className="h-3.5 w-3.5 text-rose-400" />}
      </div>

      <div className="max-h-[34vh] min-h-[84px] overflow-y-auto bg-zinc-950 p-3 custom-scrollbar">
        {summary && (
          <div className={cn(
            'mb-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed',
            mode === 'task_failed'
              ? 'border-rose-500/20 bg-rose-500/5 text-rose-300'
              : 'border-zinc-800/60 bg-zinc-900/45 text-zinc-300',
          )}>
            {summary}
          </div>
        )}

        {task.args && Object.keys(task.args).length > 0 && (
          <div className="mb-2 rounded-lg border border-zinc-800/50 bg-zinc-900/35 p-2">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              <FileText className="h-3 w-3" />
              Parameters
            </div>
            <pre className="whitespace-pre-wrap break-words font-mono text-[10px] text-zinc-400">{JSON.stringify(task.args, null, 2)}</pre>
          </div>
        )}

        {task.logs.length > 0 && (
          <div className="rounded-lg border border-zinc-800/50 bg-zinc-950/80 p-2 font-mono text-[10px] leading-relaxed">
            {task.logs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className={cn(
                  'whitespace-pre-wrap break-words',
                  log.level === 'error' ? 'text-rose-400'
                    : log.level === 'warn' ? 'text-amber-400'
                      : log.level === 'success' ? 'text-emerald-400'
                        : 'text-zinc-400',
                )}
              >
                <span className="mr-2 select-none text-zinc-700">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {log.message}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}

        {task.result && (
          <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">Result</div>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] text-emerald-300/90 custom-scrollbar">
              {typeof task.result === 'string' ? task.result : JSON.stringify(task.result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

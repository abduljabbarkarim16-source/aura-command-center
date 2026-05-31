import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Bot,
  LayoutGrid,
  Loader2,
  Send,
  Settings2,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useConsoleConversation, type ConsoleMessage } from '../../hooks/useConsoleConversation';
import { toolRegistryService } from '../../services/tools/ToolRegistryService';
import { runtimeTaskService } from '../../services/runtime/RuntimeTaskService';
import { permissionModeService } from '../../services/permissions/PermissionModeService';
import { PERMISSION_MODE_META, type PermissionMode } from '../../types/permission-mode';
import type { ToolExecution } from '../../types/tools';
import type { RuntimeTask } from '../../types/runtime-task';
import { PermissionModeSelector } from './PermissionModeSelector';
import { LivingVisualCanvas } from './LivingVisualCanvas';

const QUICK_PROMPTS = [
  'Check git status',
  'Check Claude CLI',
  'Check Codex CLI',
  'Remember my name is ...',
  'What can you do?',
];

interface AuraCommandConsoleProps {
  onBack: () => void;
  onOpenAdmin: () => void;
  onOpenDetails: () => void;
}

function MessageRow({ msg }: { msg: ConsoleMessage }) {
  const ts = new Date(msg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (msg.role === 'system') {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="h-px flex-1 bg-zinc-800/50" />
        <span className="px-2 text-center font-mono text-[9px] text-zinc-600">{msg.text}</span>
        <div className="h-px flex-1 bg-zinc-800/50" />
      </div>
    );
  }

  if (msg.role === 'user') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-500/20 text-indigo-400">
          <span className="text-[9px] font-bold">U</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold text-indigo-400">You</span>
            <span className="text-[9px] text-zinc-700">{ts}</span>
          </div>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-200">{msg.text}</p>
        </div>
      </div>
    );
  }

  if (msg.role === 'error') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-rose-500/20 text-rose-400">
          <XCircle className="h-3 w-3" />
        </div>
        <p className="flex-1 pt-0.5 text-[12px] leading-relaxed text-rose-300">{msg.text}</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-500/20 text-violet-400">
        <Bot className="h-2.5 w-2.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[10px] font-semibold text-violet-400">AURA</span>
          <span className="text-[9px] text-zinc-700">{ts}</span>
          {msg.toolUsed && (
            <span className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1 font-mono text-[9px] text-emerald-400/80">
              <Wrench className="h-2 w-2" />
              {msg.toolUsed}
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-300">{msg.text}</p>
      </div>
    </div>
  );
}

function StatusItem({
  label,
  value,
  tone = 'zinc',
}: {
  label: string;
  value: string;
  tone?: 'zinc' | 'indigo' | 'emerald' | 'amber';
}) {
  const toneClass = {
    zinc: 'border-zinc-800/70 bg-zinc-900/40 text-zinc-300',
    indigo: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  }[tone];

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]', toneClass)}>
      <span className="shrink-0 uppercase tracking-wider text-zinc-600">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function ConsoleStatusRow({ busyLabel }: { busyLabel: string | null }) {
  const [mode, setMode] = useState<PermissionMode>(() => permissionModeService.getMode());
  const [activeTasks, setActiveTasks] = useState<RuntimeTask[]>(() => runtimeTaskService.listActive());
  const [executions, setExecutions] = useState<ToolExecution[]>(() => toolRegistryService.getExecutions());

  useEffect(() => permissionModeService.subscribe(setMode), []);
  useEffect(() => runtimeTaskService.subscribe(() => setActiveTasks(runtimeTaskService.listActive())), []);
  useEffect(() => toolRegistryService.subscribe(setExecutions), []);

  const runningTool = executions.find(e => e.status === 'running');
  const lastTool = runningTool ?? executions[0];
  const toolStatus = runningTool
    ? `${runningTool.toolId} running`
    : lastTool
      ? `${lastTool.toolId} ${lastTool.status}`
      : (busyLabel ?? 'idle');

  return (
    <div className="shrink-0 border-b border-zinc-900/80 bg-zinc-950/75 px-4 py-1.5">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1.5">
        <StatusItem label="mode" value="Console" tone="indigo" />
        <StatusItem label="permission" value={PERMISSION_MODE_META[mode].label} tone={mode === 'locked' ? 'amber' : 'emerald'} />
        <StatusItem label="tasks" value={`${activeTasks.length} active`} tone={activeTasks.length > 0 ? 'amber' : 'zinc'} />
        <StatusItem label="tool" value={toolStatus} tone={runningTool ? 'amber' : 'zinc'} />
      </div>
    </div>
  );
}

export function AuraCommandConsole({ onBack, onOpenAdmin, onOpenDetails }: AuraCommandConsoleProps) {
  const { messages, busyLabel, send, clear } = useConsoleConversation();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, busyLabel]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 76)}px`;
  }, [draft]);

  function submit() {
    const text = draft.trim();
    if (!text || busyLabel) return;
    setDraft('');
    void send(text);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-zinc-950">
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800/60 bg-zinc-950/80 px-4 py-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] text-zinc-500 transition-colors hover:text-zinc-200">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voice Core
        </button>
        <div className="h-3.5 w-px bg-zinc-800" />
        <span className="text-[11px] font-semibold text-zinc-300">Console</span>
        <div className="ml-1 flex items-center gap-1.5">
          {busyLabel ? (
            <>
              <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400" />
              <span className="text-[10px] text-amber-400">{busyLabel}</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-emerald-500">ready</span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <PermissionModeSelector />
          <button
            onClick={clear}
            title="Clear console"
            className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 transition-all hover:bg-zinc-800/60 hover:text-zinc-200"
          >
            <Trash2 className="mr-1 inline h-3 w-3" />
            Clear
          </button>
          <button
            onClick={onOpenAdmin}
            className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 transition-all hover:bg-zinc-800/60 hover:text-zinc-200"
          >
            <LayoutGrid className="mr-1 inline h-3 w-3" />
            Admin
          </button>
          <button
            onClick={onOpenDetails}
            className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 transition-all hover:bg-zinc-800/60 hover:text-zinc-200"
          >
            <Settings2 className="mr-1 inline h-3 w-3" />
            Details
          </button>
        </div>
      </div>

      <ConsoleStatusRow busyLabel={busyLabel} />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-3">
            <LivingVisualCanvas />
            {messages.map(m => <MessageRow key={m.id} msg={m} />)}
            {busyLabel && (
              <div className="flex items-center gap-2 pl-7 text-[11px] text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                {busyLabel}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-800/50 bg-zinc-950/85 px-4 py-2">
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-1.5 flex flex-wrap gap-1">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  disabled={!!busyLabel}
                  className="rounded-md border border-zinc-800/70 bg-zinc-900/60 px-2 py-0.5 text-[10px] text-zinc-500 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 transition-colors focus-within:border-zinc-600">
              <Activity className="mb-1 h-3.5 w-3.5 shrink-0 text-zinc-600" />
              <textarea
                ref={taRef}
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="Ask AURA to inspect, remember, explain, or run an allowlisted tool..."
                className="min-h-[22px] flex-1 resize-none border-none bg-transparent py-0.5 text-[13px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                onClick={submit}
                disabled={!draft.trim() || !!busyLabel}
                className={cn(
                  'shrink-0 rounded-lg p-1.5 transition-all',
                  draft.trim() && !busyLabel
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'cursor-not-allowed bg-zinc-800/60 text-zinc-600',
                )}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AuraCommandConsole — AURA Phase 3G (Milestone 5 + 10)
 *
 * The real operator console. AURA can be driven and TESTED here without voice:
 * type a prompt → AURA decides whether to call a tool → runs it through the
 * real registry → prints a natural-language answer. Shares the same dispatch
 * brain as voice (useConsoleConversation → auraToolDispatchService).
 *
 * Layout (Claude Code / Codex style):
 *   header · conversation stream (center) · compact composer
 *   right panel: live tool Activity / Capabilities / Memory
 *
 * No mock data. No oversized composer. The right space is used for live state.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Settings2, LayoutGrid, Bot, Send, Trash2, Loader2,
  Wrench, ShieldCheck, Brain, CheckCircle2, XCircle, ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useConsoleConversation, type ConsoleMessage } from '../../hooks/useConsoleConversation';
import { toolRegistryService } from '../../services/tools/ToolRegistryService';
import type { ToolExecution } from '../../types/tools';
import { CapabilitiesPanel } from './CapabilitiesPanel';
import { MemoryPanel } from './MemoryPanel';

// ─── Quick test prompts (compact, not oversized pills) ─────────────────────────

const QUICK_PROMPTS = [
  'Check git status',
  'Run npm lint',
  'Check Claude CLI',
  'Check Codex CLI',
  'What can you do?',
  "What's my name?",
];

// ─── Message row ───────────────────────────────────────────────────────────────

function MessageRow({ msg }: { msg: ConsoleMessage }) {
  const ts = new Date(msg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (msg.role === 'system') {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="h-px flex-1 bg-zinc-800/50" />
        <span className="text-[9px] text-zinc-600 font-mono px-2 text-center">{msg.text}</span>
        <div className="h-px flex-1 bg-zinc-800/50" />
      </div>
    );
  }

  if (msg.role === 'user') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
          <span className="text-[9px] font-bold">U</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold text-indigo-400">You</span>
            <span className="text-[9px] text-zinc-700">{ts}</span>
          </div>
          <p className="text-[12px] text-zinc-200 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
        </div>
      </div>
    );
  }

  if (msg.role === 'error') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
          <XCircle className="w-3 h-3" />
        </div>
        <p className="text-[12px] text-rose-300 leading-relaxed flex-1 pt-0.5">{msg.text}</p>
      </div>
    );
  }

  // aura
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 rounded flex items-center justify-center bg-violet-500/20 text-violet-400 shrink-0 mt-0.5">
        <Bot className="w-2.5 h-2.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-semibold text-violet-400">AURA</span>
          <span className="text-[9px] text-zinc-700">{ts}</span>
          {msg.toolUsed && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400/80 font-mono bg-emerald-500/10 border border-emerald-500/20 rounded px-1">
              <Wrench className="w-2 h-2" />{msg.toolUsed}
            </span>
          )}
        </div>
        <p className="text-[12px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
      </div>
    </div>
  );
}

// ─── Right panel: live tool activity ───────────────────────────────────────────

function ToolActivity() {
  const [execs, setExecs] = useState<ToolExecution[]>([]);
  useEffect(() => toolRegistryService.subscribe(setExecs), []);

  if (execs.length === 0) {
    return <p className="px-3 py-3 text-[10px] text-zinc-600 italic">No tool runs yet. Ask AURA to check git status.</p>;
  }
  return (
    <div className="px-3 py-2 space-y-1.5 overflow-y-auto">
      {execs.slice(0, 40).map(e => {
        const icon = e.status === 'completed' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          : e.status === 'error' ? <XCircle className="w-3 h-3 text-rose-400" />
          : e.status === 'running' ? <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
          : <ChevronRight className="w-3 h-3 text-zinc-500" />;
        return (
          <div key={e.id} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5">
              {icon}
              <span className="text-[10px] font-mono text-zinc-300 truncate flex-1">{e.toolId}</span>
              {e.durationMs != null && <span className="text-[9px] text-zinc-600">{e.durationMs}ms</span>}
              <span className={cn('text-[9px]', e.approvedBy === 'user' ? 'text-amber-400' : 'text-zinc-600')}>{e.approvedBy}</span>
            </div>
            {e.output && <p className="mt-1 text-[9px] text-zinc-500 font-mono leading-snug line-clamp-3 whitespace-pre-wrap">{e.output.slice(0, 240)}</p>}
            {e.errorSummary && <p className="mt-1 text-[9px] text-rose-400/80 leading-snug line-clamp-2">{e.errorSummary}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AuraCommandConsoleProps {
  onBack: () => void;
  onOpenAdmin: () => void;
  onOpenDetails: () => void;
}

type RightTab = 'activity' | 'capabilities' | 'memory';

// ─── Component ───────────────────────────────────────────────────────────────

export function AuraCommandConsole({ onBack, onOpenAdmin, onOpenDetails }: AuraCommandConsoleProps) {
  const { messages, busyLabel, send, clear } = useConsoleConversation();
  const [tab, setTab] = useState<RightTab>('activity');
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, busyLabel]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [draft]);

  function submit() {
    const t = draft.trim();
    if (!t || busyLabel) return;
    setDraft('');
    void send(t);
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-full bg-zinc-950">
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-zinc-800/60 bg-zinc-950/80">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Voice Core
        </button>
        <div className="h-3.5 w-px bg-zinc-800" />
        <span className="text-[11px] font-semibold text-zinc-300">Console</span>
        <div className="flex items-center gap-1.5 ml-1">
          {busyLabel
            ? <><Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" /><span className="text-[10px] text-amber-400">{busyLabel}</span></>
            : <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[10px] text-emerald-500">ready</span></>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={clear} title="Clear console"
            className="px-2 py-1 rounded-md text-[10px] font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all">
            <Trash2 className="w-3 h-3 inline mr-1" />Clear
          </button>
          <button onClick={onOpenAdmin} className="px-2 py-1 rounded-md text-[10px] font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all">
            <LayoutGrid className="w-3 h-3 inline mr-1" />Admin
          </button>
          <button onClick={onOpenDetails} className="px-2 py-1 rounded-md text-[10px] font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all">
            <Settings2 className="w-3 h-3 inline mr-1" />Details
          </button>
        </div>
      </div>

      {/* ── Body: conversation + right panel ── */}
      <div className="flex flex-1 min-h-0">
        {/* Conversation column */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-3xl mx-auto w-full px-4 py-3 flex flex-col gap-3">
              {messages.map(m => <MessageRow key={m.id} msg={m} />)}
              {busyLabel && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 pl-7">
                  <Loader2 className="w-3 h-3 animate-spin" />{busyLabel}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Compact composer */}
          <div className="shrink-0 border-t border-zinc-800/50 bg-zinc-950/80 px-4 py-2.5">
            <div className="max-w-3xl mx-auto w-full">
              <div className="flex flex-wrap gap-1 mb-1.5">
                {QUICK_PROMPTS.map(p => (
                  <button key={p} onClick={() => send(p)} disabled={!!busyLabel}
                    className="px-2 py-0.5 rounded-md text-[10px] text-zinc-500 hover:text-zinc-200 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/70 hover:border-zinc-700 transition-colors disabled:opacity-40">
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2 bg-zinc-900/70 border border-zinc-800 rounded-xl px-3 py-2 focus-within:border-zinc-600 transition-colors">
                <textarea
                  ref={taRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                  rows={1}
                  placeholder="Type a command for AURA…  (Enter to send, Shift+Enter for newline)"
                  className="flex-1 bg-transparent border-none focus:outline-none resize-none text-[13px] text-zinc-200 placeholder:text-zinc-600 leading-relaxed py-0.5 min-h-[24px]"
                />
                <button onClick={submit} disabled={!draft.trim() || !!busyLabel}
                  className={cn('p-1.5 rounded-lg transition-all shrink-0',
                    draft.trim() && !busyLabel ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-zinc-800/60 text-zinc-600 cursor-not-allowed')}>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <aside className="hidden md:flex flex-col w-80 shrink-0 border-l border-zinc-800/60 bg-zinc-950/40">
          <div className="shrink-0 flex items-center border-b border-zinc-800/60">
            {([
              { id: 'activity' as const, label: 'Activity', icon: <Wrench className="w-3 h-3" /> },
              { id: 'capabilities' as const, label: 'Capabilities', icon: <ShieldCheck className="w-3 h-3" /> },
              { id: 'memory' as const, label: 'Memory', icon: <Brain className="w-3 h-3" /> },
            ]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('flex items-center gap-1 px-3 py-2 text-[10px] font-medium border-b-2 transition-colors',
                  tab === t.id ? 'border-indigo-500 text-zinc-200' : 'border-transparent text-zinc-500 hover:text-zinc-300')}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            {tab === 'activity' && <ToolActivity />}
            {tab === 'capabilities' && <CapabilitiesPanel />}
            {tab === 'memory' && <MemoryPanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}

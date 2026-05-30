/**
 * AuraCommandConsole — AURA Phase 3E QA
 *
 * Claude Code / Codex-style operator console.
 * Dense, precise, developer-oriented layout.
 * Replaces the over-sized consumer chat bubbles.
 */

import React, { Fragment, useRef, useEffect } from 'react';
import { ArrowLeft, Settings2, LayoutGrid, Bot, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AuraComposer } from './AuraComposer';
import type { AuraMessage } from './AssistantMessage';

// ─── Message row ──────────────────────────────────────────────────────────────

function MessageRow({ msg }: { msg: AuraMessage }) {
  const isUser    = msg.type === 'user';
  const isSystem  = msg.type === 'system';
  const isHandoff = msg.type === 'agent-handoff';
  const isTool    = msg.type === 'tool-status';
  const isApproval= msg.type === 'approval-request';

  const ts = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  if (isUser) {
    return (
      <div className="flex items-start gap-2.5 group">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
          <span className="text-[9px] font-bold">U</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold text-indigo-400">User</span>
            {ts && <span className="text-[9px] text-zinc-700">{ts}</span>}
          </div>
          <p className="text-[12px] text-zinc-200 leading-relaxed">{(msg as { content: string }).content}</p>
        </div>
      </div>
    );
  }

  if (msg.type === 'assistant') {
    const m = msg as { content: string; agentName?: string };
    return (
      <div className="flex items-start gap-2.5 group">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-violet-500/20 text-violet-400 shrink-0 mt-0.5">
          <Bot className="w-2.5 h-2.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold text-violet-400">{m.agentName ?? 'AURA'}</span>
            {ts && <span className="text-[9px] text-zinc-700">{ts}</span>}
          </div>
          <p className="text-[12px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{m.content}</p>
        </div>
      </div>
    );
  }

  if (isApproval) {
    const m = msg as { title: string; summary: string; riskLevel: string; sourceAgent: string };
    const riskColor = m.riskLevel === 'high' || m.riskLevel === 'critical' ? 'text-rose-400 border-rose-500/30 bg-rose-500/5'
      : m.riskLevel === 'medium' ? 'text-amber-400 border-amber-500/30 bg-amber-500/5'
      : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
    return (
      <div className={cn('rounded-lg border px-3 py-2.5 space-y-1', riskColor)}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">Approval</span>
          <span className="text-[10px] font-semibold">{m.title}</span>
          <span className="ml-auto text-[9px] opacity-60">{m.riskLevel}</span>
        </div>
        <p className="text-[11px] opacity-80">{m.summary}</p>
        <p className="text-[10px] opacity-60">From {m.sourceAgent}</p>
      </div>
    );
  }

  if (isHandoff) {
    const m = msg as { sourceAgent: string; targetAgent: string; objective: string; status: string };
    return (
      <div className="flex items-center gap-2 py-1 px-2 rounded border border-zinc-800/50 bg-zinc-900/30">
        <span className="text-[9px] text-zinc-500 font-mono uppercase">handoff</span>
        <span className="text-[10px] text-sky-400">{m.sourceAgent}</span>
        <span className="text-zinc-700">→</span>
        <span className="text-[10px] text-violet-400">{m.targetAgent}</span>
        <span className="text-[10px] text-zinc-500 truncate flex-1">{m.objective}</span>
        <span className={cn('text-[9px] font-semibold', m.status === 'completed' ? 'text-emerald-400' : 'text-amber-400')}>{m.status}</span>
      </div>
    );
  }

  if (isTool) {
    const m = msg as { toolName: string; status: string; detail?: string };
    const statusColor = m.status === 'completed' ? 'text-emerald-400' : m.status === 'failed' ? 'text-rose-400' : 'text-amber-400';
    return (
      <div className="flex items-center gap-2 py-1 px-2 rounded border border-zinc-800/40 bg-zinc-900/20">
        <span className="text-[9px] text-zinc-600 font-mono uppercase">tool</span>
        <span className="text-[10px] text-zinc-300">{m.toolName}</span>
        <span className={cn('text-[9px] font-semibold', statusColor)}>{m.status}</span>
        {m.detail && <span className="text-[10px] text-zinc-600 truncate flex-1">{m.detail}</span>}
      </div>
    );
  }

  if (isSystem) {
    const m = msg as { title: string; summary: string };
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className="h-px flex-1 bg-zinc-800/60" />
        <span className="text-[9px] text-zinc-600 font-mono uppercase px-2">{m.title}: {m.summary?.slice(0, 60)}</span>
        <div className="h-px flex-1 bg-zinc-800/60" />
      </div>
    );
  }

  return null;
}

// ─── Session divider ──────────────────────────────────────────────────────────

function SessionDivider() {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-zinc-800/40" />
      <div className="flex items-center gap-1.5 text-zinc-700">
        <Clock className="w-2.5 h-2.5" />
        <span className="text-[9px] font-mono uppercase tracking-wider">Session</span>
      </div>
      <div className="h-px flex-1 bg-zinc-800/40" />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuraCommandConsoleProps {
  messages: AuraMessage[];
  onBack: () => void;
  onOpenAdmin: () => void;
  onOpenDetails: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuraCommandConsole({ messages, onBack, onOpenAdmin, onOpenDetails }: AuraCommandConsoleProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-950">
      {/* ── Header bar ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Voice Core
        </button>
        <div className="h-3.5 w-px bg-zinc-800" />
        <span className="text-[11px] font-semibold text-zinc-300">Console</span>
        <div className="flex items-center gap-1.5 ml-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-500">active</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={onOpenAdmin}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700/50 transition-all">
            <LayoutGrid className="w-3 h-3 inline mr-1" />Admin
          </button>
          <button onClick={onOpenDetails}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700/50 transition-all">
            <Settings2 className="w-3 h-3 inline mr-1" />Details
          </button>
        </div>
      </div>

      {/* ── Message stream ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 py-3 flex flex-col gap-2.5">
          <SessionDivider />
          {messages.map(msg => (
            <Fragment key={msg.id}>
              <MessageRow msg={msg} />
            </Fragment>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Composer ── */}
      <div className="shrink-0 px-4 py-3 border-t border-zinc-800/50 bg-zinc-950/80">
        <div className="max-w-2xl mx-auto w-full">
          <AuraComposer />
        </div>
      </div>
    </div>
  );
}

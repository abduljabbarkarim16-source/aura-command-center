/**
 * AgentBridgesPanel — AURA Phase 3G (Milestone 6)
 *
 * Clean "Agent Bridges" view: Claude / Codex / Antigravity with connection
 * state, supported modes, and approval-gated tiny prompts. Tiny prompts run
 * through AgentBridgeService (which also feeds capability evidence).
 *
 * Security: tiny prompts are fixed sentinel strings; medium-risk and require
 * explicit in-panel approval before running. No repo source, no secrets.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Bot, RefreshCw, Play, Loader2, CheckCircle2, AlertTriangle, Ban, Clock, HelpCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { agentBridgeService } from '../../services/agents/AgentBridgeService';
import { reminderService } from '../../services/reminders/ReminderService';
import { notificationService } from '../../services/notifications/NotificationService';
import { sessionThreadService } from '../../services/session/SessionThreadService';
import type { AgentBridgeState, BridgeConnection } from '../../types/agent-bridge';

const CONN_META: Record<BridgeConnection, { label: string; cls: string; icon: React.ReactNode }> = {
  connected:        { label: 'connected',     cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', icon: <CheckCircle2 className="w-3 h-3" /> },
  'auth-required':  { label: 'auth required',  cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10',      icon: <AlertTriangle className="w-3 h-3" /> },
  missing:          { label: 'missing',        cls: 'text-zinc-400 border-zinc-600/40 bg-zinc-700/20',         icon: <Ban className="w-3 h-3" /> },
  'rate-limited':   { label: 'rate limited',   cls: 'text-rose-400 border-rose-500/30 bg-rose-500/10',         icon: <AlertTriangle className="w-3 h-3" /> },
  planned:          { label: 'planned',        cls: 'text-sky-400 border-sky-500/30 bg-sky-500/10',            icon: <Clock className="w-3 h-3" /> },
  unknown:          { label: 'unknown',        cls: 'text-zinc-400 border-zinc-600/40 bg-zinc-700/20',         icon: <HelpCircle className="w-3 h-3" /> },
};

export function AgentBridgesPanel() {
  const [bridges, setBridges] = useState<AgentBridgeState[]>(() => agentBridgeService.getAll());
  const [handshaking, setHandshaking] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => agentBridgeService.subscribe(setBridges), []);
  useEffect(() => { void handshake(); /* initial detection */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handshake = useCallback(async () => {
    setHandshaking(true);
    try { await agentBridgeService.handshakeAll(); }
    finally { setHandshaking(false); }
  }, []);

  const runTiny = useCallback(async (agentId: 'claude' | 'codex') => {
    setConfirm(null);
    setRunning(agentId);
    try {
      const result = await agentBridgeService.runTiny(agentId, true);
      if (result.usageLimited) {
        reminderService.addUsageLimitReminder(agentId, new Date(Date.now() + 3600_000), agentId);
        notificationService.add({ type: 'warning', title: `${agentId}: usage limit`, message: 'Reminder created for reset.', ttl: 8000 });
      } else if (result.ok) {
        sessionThreadService.addFact(`${agentId} CLI bridge verified (sentinel OK).`);
        notificationService.add({ type: 'success', title: `${agentId}: bridge OK`, message: 'Sentinel prompt matched.', ttl: 5000 });
      } else {
        notificationService.add({ type: 'error', title: `${agentId}: bridge failed`, message: (result.error ?? 'No sentinel match').slice(0, 120), ttl: 8000 });
      }
    } finally {
      setRunning(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">
          <Bot className="w-3 h-3" /> Agent Bridges
        </span>
        <button onClick={handshake} disabled={handshaking}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-zinc-700/50 transition-colors disabled:opacity-50">
          {handshaking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Handshake
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
        {bridges.map(b => {
          const meta = CONN_META[b.connection];
          const canTest = (b.agentId === 'claude' || b.agentId === 'codex') && b.detected;
          return (
            <div key={b.agentId} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-zinc-200 capitalize flex-1">{b.agentId}</span>
                <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold', meta.cls)}>
                  {meta.icon}{meta.label}
                </span>
              </div>
              {b.versionSummary && <p className="mt-1 text-[9px] text-zinc-500 font-mono leading-snug line-clamp-2">{b.versionSummary}</p>}
              {b.supportedModes.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {b.supportedModes.map(m => (
                    <span key={m} className="text-[8px] px-1 py-0.5 rounded bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 font-mono">{m}</span>
                  ))}
                </div>
              )}
              {b.notes && <p className="mt-1 text-[9px] text-zinc-600 leading-snug">{b.notes}</p>}
              {b.lastError && <p className="mt-1 text-[9px] text-rose-400/80 leading-snug">{b.lastError}</p>}

              {canTest && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  {confirm === b.agentId ? (
                    <>
                      <span className="text-[9px] text-amber-400">Run sentinel prompt?</span>
                      <button onClick={() => runTiny(b.agentId as 'claude' | 'codex')} disabled={running !== null}
                        className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40">Run</button>
                      <button onClick={() => setConfirm(null)}
                        className="px-1.5 py-0.5 rounded text-[9px] text-zinc-500 hover:text-zinc-300 border border-zinc-800">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirm(b.agentId)} disabled={running !== null}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-zinc-700/50 transition-colors disabled:opacity-40">
                      {running === b.agentId ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
                      Tiny test
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[9px] text-zinc-600 leading-relaxed pt-1">
          Tiny tests send a fixed sentinel prompt and require approval. No repo source or secrets are sent.
        </p>
      </div>
    </div>
  );
}

/**
 * AdminPanelOverlay — Phase 2E Voice Core
 *
 * Background admin panel. Hidden by default, opened via "Open Admin Panel"
 * button on the Voice Core. Contains project/relay/handoff/health info
 * plus a shortcut to the TechnicalDrawer.
 *
 * No network. No real agent execution. All mock data.
 */

import React, { Fragment } from 'react';
import {
  X, FolderKanban, Workflow, BringToFront, Activity,
  Settings2, ShieldCheck, AlertTriangle, CheckCircle2,
  ArrowRight, Target, Bot, Clock,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PROJECTS = [
  { id: 'p1', name: 'AURA Phase 2E',    status: 'active',    progress: 72, agent: 'Claude Architect' },
  { id: 'p2', name: 'Relay Integration', status: 'paused',    progress: 44, agent: 'Codex Dev' },
  { id: 'p3', name: 'Memory Schema v2',  status: 'completed', progress: 100, agent: 'Claude Architect' },
];

const MOCK_RELAYS = [
  { id: 'r1', label: 'Design review → Codex',  status: 'pending',  risk: 'medium' },
  { id: 'r2', label: 'Handoff spec v2 ready',   status: 'approved', risk: 'low' },
];

const MOCK_HANDOFFS = [
  { id: 'h1', from: 'Claude Architect', to: 'Codex Dev',  objective: 'Implement Phase 2E voice core', status: 'pending' },
  { id: 'h2', from: 'Codex Dev',        to: 'Test Agent', objective: 'Run lint + build validation',   status: 'completed' },
];

const MOCK_HEALTH = [
  { id: 'hc1', label: 'TypeScript',      ok: true  },
  { id: 'hc2', label: 'Tauri Runtime',   ok: true  },
  { id: 'hc3', label: 'LocalStorage',    ok: true  },
  { id: 'hc4', label: 'Provider Keys',   ok: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  paused:    'bg-amber-500/15  text-amber-400  border-amber-500/25',
  completed: 'bg-zinc-800      text-zinc-500   border-zinc-700/50',
  pending:   'bg-amber-500/15  text-amber-400  border-amber-500/25',
  approved:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
};

const RISK_COLOR: Record<string, string> = {
  low:    'text-emerald-400',
  medium: 'text-amber-400',
  high:   'text-rose-400',
};

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-zinc-500">{icon}</span>
      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ─── AdminPanelOverlay ────────────────────────────────────────────────────────

interface AdminPanelOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTechnicalDrawer?: () => void;
}

export function AdminPanelOverlay({
  isOpen,
  onClose,
  onOpenTechnicalDrawer,
}: AdminPanelOverlayProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full z-50 w-[380px] max-w-[90vw]',
          'bg-zinc-950 border-l border-zinc-800/70 flex flex-col',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-100">Admin Panel</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Operations overview</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Close admin panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 flex flex-col gap-6">

          {/* ── Projects ──────────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={<FolderKanban className="w-3.5 h-3.5" />} label="Projects" />
            <div className="flex flex-col gap-2">
              {MOCK_PROJECTS.map(p => (
                <Fragment key={p.id}>
                  <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Target className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <span className="text-[13px] font-medium text-zinc-200 truncate">{p.name}</span>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ml-2', STATUS_PILL[p.status])}>
                        {p.status}
                      </span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <Bot className="w-3 h-3" />
                      <span>{p.agent}</span>
                      <span className="ml-auto text-zinc-700">{p.progress}%</span>
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          </section>

          {/* ── Relay ─────────────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={<Workflow className="w-3.5 h-3.5" />} label="Relay" />
            <div className="flex flex-col gap-2">
              {MOCK_RELAYS.map(r => (
                <Fragment key={r.id}>
                  <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                      <span className="text-[13px] text-zinc-300 truncate">{r.label}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={cn('text-[11px] font-medium', RISK_COLOR[r.risk])}>
                        {r.risk}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', STATUS_PILL[r.status])}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          </section>

          {/* ── Handoffs ──────────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={<BringToFront className="w-3.5 h-3.5" />} label="Handoffs" />
            <div className="flex flex-col gap-2">
              {MOCK_HANDOFFS.map(h => (
                <Fragment key={h.id}>
                  <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-[12px] text-zinc-400 min-w-0">
                        <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] truncate">{h.from}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                        <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded text-[11px] truncate">{h.to}</span>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ml-2', STATUS_PILL[h.status])}>
                        {h.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug">{h.objective}</p>
                  </div>
                </Fragment>
              ))}
            </div>
          </section>

          {/* ── System Health ─────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={<Activity className="w-3.5 h-3.5" />} label="System Health" />
            <div className="grid grid-cols-2 gap-2">
              {MOCK_HEALTH.map(h => (
                <Fragment key={h.id}>
                  <div className={cn(
                    'flex items-center gap-2 bg-zinc-900/60 border rounded-xl px-3 py-2.5',
                    h.ok ? 'border-zinc-800/50' : 'border-rose-900/40',
                  )}>
                    {h.ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    }
                    <span className="text-[12px] text-zinc-300 truncate">{h.label}</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </section>
        </div>

        {/* Footer — Technical Drawer shortcut */}
        <div className="shrink-0 border-t border-zinc-800/60 px-5 py-4">
          <button
            onClick={onOpenTechnicalDrawer}
            className={cn(
              'w-full flex items-center justify-center gap-2.5',
              'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/50',
              'text-zinc-300 hover:text-zinc-100 rounded-xl py-3 text-[13px] font-medium',
              'transition-colors',
            )}
          >
            <Settings2 className="w-4 h-4" />
            Open Technical Drawer
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <ShieldCheck className="w-3 h-3 text-zinc-700" />
            <span className="text-[10px] text-zinc-700">External tools remain approval-gated</span>
          </div>
        </div>
      </div>
    </>
  );
}

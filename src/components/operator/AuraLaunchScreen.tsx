import React from 'react';
import { Orbit, Shield, Power, Activity, Database, Zap, Terminal, Network } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AuraLaunchScreenProps {
  onInitiate: () => void;
}

// ─── Readiness card ───────────────────────────────────────────────────────────

interface ReadinessCardProps {
  icon: React.ReactNode;
  label: string;
  status: 'online' | 'locked' | 'standby' | 'ready';
  detail?: string;
}

const readinessConfig = {
  online:  { dotColor: 'bg-emerald-500', textColor: 'text-emerald-400', label: 'Online' },
  ready:   { dotColor: 'bg-indigo-400',  textColor: 'text-indigo-400',  label: 'Ready' },
  locked:  { dotColor: 'bg-amber-500',   textColor: 'text-amber-400',   label: 'Locked' },
  standby: { dotColor: 'bg-zinc-500',    textColor: 'text-zinc-500',    label: 'Standby' },
};

function ReadinessCard({ icon, label, status, detail }: ReadinessCardProps) {
  const cfg = readinessConfig[status];
  return (
    <div className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-3">
      <span className="text-zinc-500 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-zinc-300 font-medium leading-none mb-0.5">{label}</p>
        {detail && <p className="text-[11px] text-zinc-600 truncate">{detail}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dotColor, status === 'online' && 'animate-pulse')} />
        <span className={cn('text-[11px] font-semibold', cfg.textColor)}>{cfg.label}</span>
      </div>
    </div>
  );
}

// ─── AuraLaunchScreen ─────────────────────────────────────────────────────────

export function AuraLaunchScreen({ onInitiate }: AuraLaunchScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-full bg-gradient-to-b from-zinc-950 via-zinc-950 to-indigo-950/20 overflow-y-auto custom-scrollbar">

      <div className="flex flex-col items-center max-w-lg w-full px-6 py-12 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">

        {/* ── Glowing Orb ─────────────────────────────────────────────── */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_0_40px_rgba(79,70,229,0.4)] flex items-center justify-center relative z-10">
            <Orbit className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* ── Branding ────────────────────────────────────────────────── */}
        <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
          AURA Command Center
        </h1>
        <p className="text-lg text-zinc-400 font-medium tracking-wide mb-8">
          Agentic Unified Routing Assistant
        </p>

        {/* ── Status chips ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-10 flex-wrap justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Activity className="w-3.5 h-3.5" />
            Core Online
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Shield className="w-3.5 h-3.5" />
            Tools Secured
          </div>
        </div>

        {/* ── System readiness cards ──────────────────────────────────── */}
        <div className="w-full space-y-2 mb-10">
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-semibold mb-3 text-left">
            System Readiness
          </p>
          <ReadinessCard
            icon={<Database className="w-4 h-4" />}
            label="Memory"
            status="online"
            detail="LocalStorage adapter · aura: namespace"
          />
          <ReadinessCard
            icon={<Zap className="w-4 h-4" />}
            label="Relay"
            status="ready"
            detail="Approval-gated · manual import mode"
          />
          <ReadinessCard
            icon={<Shield className="w-4 h-4" />}
            label="External Tools"
            status="locked"
            detail="Awaiting operator approval to unlock"
          />
          <ReadinessCard
            icon={<Terminal className="w-4 h-4" />}
            label="Local Shell"
            status="standby"
            detail="No active workspace attached"
          />
        </div>

        {/* ── CTA buttons ─────────────────────────────────────────────── */}
        <div className="w-full flex flex-col gap-3 mb-8">
          <button
            onClick={onInitiate}
            className="w-full flex items-center justify-center gap-3 bg-white text-zinc-950 hover:bg-zinc-100 py-4 px-6 rounded-2xl font-semibold text-lg transition-all shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5"
          >
            <Power className="w-5 h-5" />
            Initiate AURA
          </button>

          <button
            onClick={onInitiate}
            className="w-full flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 py-4 px-6 rounded-2xl font-medium transition-colors"
          >
            Safe Monitor Mode
          </button>
        </div>

        {/* ── Trust note ──────────────────────────────────────────────── */}
        <p className="text-sm text-zinc-500 flex items-center justify-center gap-2 mb-8">
          <Shield className="w-4 h-4 opacity-50" />
          External tools remain locked until approved by the operator.
        </p>

        {/* ── Future: Dispatcher hint ──────────────────────────────────── */}
        <div className="w-full bg-zinc-900/30 border border-dashed border-zinc-800/60 rounded-2xl px-5 py-4 text-left">
          <div className="flex items-center gap-2 mb-1.5">
            <Network className="w-4 h-4 text-zinc-600" />
            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">Coming Soon</span>
            <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-500 text-[10px] rounded-full border border-zinc-700/50 font-semibold ml-auto">
              PLANNED
            </span>
          </div>
          <p className="text-[13px] text-zinc-600 leading-relaxed">
            <strong className="text-zinc-500">Dispatcher Mode</strong> — Autonomous multi-agent task distribution across connected providers. AURA will coordinate parallel workstreams with zero manual relay steps.
          </p>
        </div>

      </div>
    </div>
  );
}

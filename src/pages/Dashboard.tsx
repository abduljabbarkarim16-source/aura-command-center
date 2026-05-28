/**
 * Dashboard — Phase 2E Deep Refinement
 *
 * Operations overview — not a data panel.
 * Default: today's ops, active missions, approvals needed, agent fleet, system health.
 * Technical data hidden behind "View details" actions.
 */

import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, CheckCircle2, Clock, AlertCircle,
  Bot, ChevronRight, ShieldCheck, Zap, MemoryStick,
  Terminal, Workflow, ArrowRight, Sparkles
} from 'lucide-react';
import { mockAgents, mockTasks, mockProjects } from '../store/mockData';
import { FuturePlaceholderCards } from '../components/operator/FuturePlaceholderCards';
import { ProviderCapabilityCard } from '../components/operator/ProviderCapabilityCard';
import { cn } from '../lib/utils';

// ─── Compact section header ───────────────────────────────────────────────────

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[13px] font-semibold text-zinc-400 uppercase tracking-widest">{title}</h2>
      {action && (
        <button
          onClick={onAction}
          className="text-[12px] text-zinc-600 hover:text-indigo-400 transition-colors flex items-center gap-1"
        >
          {action} <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate     = useNavigate();
  const activeProj   = mockProjects[0];
  const workingAgents = mockAgents.filter(a => a.status === 'working');
  const pendingTasks  = mockTasks.filter(t => t.status !== 'completed');
  const completedTasks = mockTasks.filter(t => t.status === 'completed');
  const today         = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

      {/* ── Today / Operations header ───────────────────────────────── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">{today}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Operations</h1>
          <p className="text-zinc-500 text-[13px] mt-1">
            {activeProj.name} · {workingAgents.length} agent{workingAgents.length !== 1 ? 's' : ''} active
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[13px] font-semibold transition-all shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5"
        >
          <Sparkles className="w-4 h-4" />
          Open Console
        </button>
      </div>

      {/* ── Quick stat strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active agents',    value: workingAgents.length,     color: 'text-amber-400',   icon: Activity    },
          { label: 'Pending tasks',    value: pendingTasks.length,      color: 'text-indigo-400',  icon: Clock       },
          { label: 'Completed tasks',  value: completedTasks.length,    color: 'text-emerald-400', icon: CheckCircle2},
          { label: 'Open issues',      value: 1,                         color: 'text-rose-400',    icon: AlertCircle },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl px-4 py-4 hover:border-zinc-700/70 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] text-zinc-500 font-medium">{stat.label}</span>
              <stat.icon className={cn('w-4 h-4 flex-shrink-0', stat.color)} />
            </div>
            <span className={cn('text-3xl font-bold', stat.color)}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* ── Active mission ──────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Active Mission" action="View project" onAction={() => navigate('/projects')} />
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-5 hover:border-zinc-700/60 transition-colors">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
                <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest">Phase 2E</span>
              </div>
              <h3 className="text-[16px] font-semibold text-zinc-100 leading-snug">
                {activeProj.name}
              </h3>
              <p className="text-[13px] text-zinc-400 mt-1.5 leading-relaxed">
                Build a unified AI agent orchestration desktop app with relay, memory, and approval workflows.
                Currently in premium operator UX deep refinement pass.
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-2xl font-bold text-indigo-400">72%</div>
              <div className="text-[11px] text-zinc-600">complete</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
            <div className="h-full w-[72%] bg-indigo-500 rounded-full" />
          </div>

          {/* Agent + next action */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[13px] text-zinc-400">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="font-medium text-zinc-300">Claude Architect</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">anthropic / claude-3-5-sonnet</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Approvals needed ────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Approvals Needed" action="View relay" onAction={() => navigate('/relay')} />
        <div className="space-y-2.5">
          {/* Pending approval card */}
          <div className="bg-zinc-900/50 border border-amber-500/20 rounded-2xl p-5 border-l-2 border-l-amber-500">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Workflow className="w-4 h-4 text-amber-400" />
                  <span className="text-[13px] font-semibold text-zinc-200">Relay Packet Ready</span>
                  <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold rounded-full">LOW RISK</span>
                </div>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  AURA has prepared a reasoning relay packet for architectural review. Target: ChatGPT.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => navigate('/relay')}
                  className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-[12px] font-semibold rounded-xl transition-colors"
                >
                  Review
                </button>
              </div>
            </div>
          </div>

          {/* No more approvals hint */}
          <div className="flex items-center gap-2 px-5 py-2.5 text-[12px] text-zinc-600">
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-700" />
            No other pending approvals
          </div>
        </div>
      </div>

      {/* ── Agent fleet ─────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Agent Fleet" action="Manage agents" onAction={() => navigate('/agents')} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mockAgents.map(agent => (
            <Fragment key={agent.id}>
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl px-4 py-3.5 hover:border-zinc-700/60 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      agent.status === 'working' ? 'bg-amber-400 animate-pulse'
                      : agent.status === 'idle'  ? 'bg-emerald-400'
                      : 'bg-rose-400'
                    )} />
                    <span className="text-[13px] font-semibold text-zinc-200">{agent.name}</span>
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full border',
                    agent.status === 'working'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-500'
                  )}>
                    {agent.status}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 font-mono">{agent.provider} · {agent.model}</p>
                <p className="text-[11px] text-zinc-500 mt-1">{agent.role}</p>
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      {/* ── System health ────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="System Health" />
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <MemoryStick className="w-3.5 h-3.5" />, label: 'Memory',    status: 'Online', ok: true },
              { icon: <Workflow className="w-3.5 h-3.5" />,    label: 'Relay',     status: 'Ready',  ok: true },
              { icon: <Terminal className="w-3.5 h-3.5" />,    label: 'Local Shell', status: 'Standby', ok: true },
              { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: 'Tools',     status: 'Locked', ok: true },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                  item.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                )}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-zinc-300">{item.label}</p>
                  <p className={cn('text-[10px]', item.ok ? 'text-emerald-500' : 'text-rose-500')}>{item.status}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800/30">
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              All core systems operational — external tools remain locked until approved
            </div>
          </div>
        </div>
      </div>

      {/* ── Provider capability (compact) ────────────────────────────── */}
      <div>
        <SectionHeader title="Provider Capability" action="View settings" onAction={() => navigate('/settings')} />
        <ProviderCapabilityCard compact />
      </div>

      {/* ── Roadmap ──────────────────────────────────────────────────── */}
      <FuturePlaceholderCards />

    </div>
  );
}

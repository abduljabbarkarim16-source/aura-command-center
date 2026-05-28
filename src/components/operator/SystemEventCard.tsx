import React, { useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Info, Loader2,
  ChevronDown, ChevronUp, BrainCircuit, GitBranch,
  ShieldCheck, Zap, Terminal, MemoryStick
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type SystemEventType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'agent-started'
  | 'agent-stopped'
  | 'tool-unlocked'
  | 'memory-write'
  | 'handoff-created'
  | 'relay-sent'
  | 'thinking';

interface SystemEventCardProps {
  id: string;
  type: SystemEventType;
  title: string;
  summary?: string;
  detail?: string;
  timestamp: string;
  expandable?: boolean;
  className?: string;
}

const eventConfig: Record<SystemEventType, {
  icon: React.ReactNode;
  labelColor: string;
  dotColor: string;
  label: string;
}> = {
  info:           { icon: <Info className="w-3.5 h-3.5" />,          labelColor: 'text-zinc-500',   dotColor: 'bg-zinc-600',    label: 'System' },
  success:        { icon: <CheckCircle2 className="w-3.5 h-3.5" />,  labelColor: 'text-emerald-400', dotColor: 'bg-emerald-500', label: 'Success' },
  warning:        { icon: <AlertTriangle className="w-3.5 h-3.5" />, labelColor: 'text-amber-400',   dotColor: 'bg-amber-500',   label: 'Warning' },
  error:          { icon: <AlertTriangle className="w-3.5 h-3.5" />, labelColor: 'text-rose-400',    dotColor: 'bg-rose-500',    label: 'Error' },
  'agent-started':{ icon: <Activity className="w-3.5 h-3.5" />,      labelColor: 'text-indigo-400',  dotColor: 'bg-indigo-500',  label: 'Agent Started' },
  'agent-stopped':{ icon: <Activity className="w-3.5 h-3.5" />,      labelColor: 'text-zinc-500',    dotColor: 'bg-zinc-600',    label: 'Agent Stopped' },
  'tool-unlocked':{ icon: <ShieldCheck className="w-3.5 h-3.5" />,   labelColor: 'text-emerald-400', dotColor: 'bg-emerald-500', label: 'Tool Unlocked' },
  'memory-write': { icon: <MemoryStick className="w-3.5 h-3.5" />,   labelColor: 'text-sky-400',     dotColor: 'bg-sky-500',     label: 'Memory' },
  'handoff-created':{ icon: <GitBranch className="w-3.5 h-3.5" />,   labelColor: 'text-sky-400',     dotColor: 'bg-sky-500',     label: 'Handoff' },
  'relay-sent':   { icon: <Zap className="w-3.5 h-3.5" />,           labelColor: 'text-amber-400',   dotColor: 'bg-amber-500',   label: 'Relay Sent' },
  thinking:       { icon: <BrainCircuit className="w-3.5 h-3.5" />,  labelColor: 'text-indigo-400',  dotColor: 'bg-indigo-500',  label: 'Thinking' },
};

export function SystemEventCard({
  type,
  title,
  summary,
  detail,
  timestamp,
  expandable = false,
  className,
}: SystemEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = eventConfig[type] ?? eventConfig.info;

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={cn('flex justify-center my-0.5', className)}>
      <div className="max-w-xl w-full bg-zinc-900/20 border border-zinc-800/30 rounded-xl px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Left: icon + label + title */}
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('flex-shrink-0', cfg.labelColor)}>{cfg.icon}</span>
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider flex-shrink-0', cfg.labelColor)}>
              {cfg.label}
            </span>
            <span className="text-[13px] text-zinc-400 font-medium truncate">{title}</span>
            {summary && !expanded && (
              <span className="text-[12px] text-zinc-600 truncate hidden sm:inline">{summary}</span>
            )}
          </div>

          {/* Right: timestamp + expand toggle */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-zinc-700">{formattedTime}</span>
            {expandable && detail && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-0.5 text-zinc-700 hover:text-zinc-400 transition-colors rounded"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && detail && (
          <div className="mt-2 pt-2 border-t border-zinc-800/30 text-[12px] text-zinc-500 leading-relaxed font-mono whitespace-pre-wrap">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mini variant for inline context ─────────────────────────────────────────

interface MiniEventBadgeProps {
  type: SystemEventType;
  label: string;
}

export function MiniEventBadge({ type, label }: MiniEventBadgeProps) {
  const cfg = eventConfig[type] ?? eventConfig.info;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
      cfg.labelColor,
      'bg-zinc-900/60 border-zinc-800/60'
    )}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'currentColor' }} />
      {label}
    </span>
  );
}

// ─── Loading pulse card ───────────────────────────────────────────────────────

export function ThinkingCard({ agentName }: { agentName?: string }) {
  return (
    <div className="flex justify-center my-0.5">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-900/20 border border-indigo-500/15 rounded-xl">
        <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
        <span className="text-[13px] text-indigo-400 font-medium">
          {agentName ? `${agentName} is thinking...` : 'AURA is thinking...'}
        </span>
      </div>
    </div>
  );
}

// ─── Session divider ──────────────────────────────────────────────────────────

export function SessionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-6">
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent w-full max-w-xs" />
      <span className="px-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent w-full max-w-xs" />
    </div>
  );
}

/**
 * AuraThoughtCard — Phase 2E Voice Core
 *
 * Momentary status/thought cards that surface near the Voice Core.
 * Concise — no raw logs. Fade in, optional auto-dismiss.
 */

import React, { useEffect, useState, useRef, Fragment } from 'react';
import {
  Target, Workflow, ShieldAlert, Wrench, Database,
  Zap, Bot, CheckCircle2, AlertCircle, Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThoughtVariant =
  | 'info'
  | 'mission'
  | 'relay'
  | 'approval'
  | 'tool'
  | 'memory'
  | 'agent'
  | 'success'
  | 'warning';

export interface Thought {
  id: string;
  text: string;
  variant?: ThoughtVariant;
  /** Auto-dismiss after N ms. Omit to stay until manually cleared. */
  ttl?: number;
}

interface AuraThoughtCardProps {
  thought: Thought;
  onDismiss?: (id: string) => void;
  className?: string;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CFG: Record<ThoughtVariant, {
  icon: React.ReactNode;
  border: string;
  bg: string;
  textColor: string;
  iconColor: string;
}> = {
  info:     { icon: <Info className="w-3 h-3" />,         border: 'border-zinc-700/50',     bg: 'bg-zinc-900/80',       textColor: 'text-zinc-300',  iconColor: 'text-zinc-500' },
  mission:  { icon: <Target className="w-3 h-3" />,        border: 'border-indigo-500/30',   bg: 'bg-indigo-950/40',     textColor: 'text-zinc-200',  iconColor: 'text-indigo-400' },
  relay:    { icon: <Workflow className="w-3 h-3" />,       border: 'border-amber-500/30',    bg: 'bg-amber-950/30',      textColor: 'text-zinc-200',  iconColor: 'text-amber-400' },
  approval: { icon: <ShieldAlert className="w-3 h-3" />,   border: 'border-amber-500/40',    bg: 'bg-amber-950/40',      textColor: 'text-amber-200', iconColor: 'text-amber-400' },
  tool:     { icon: <Wrench className="w-3 h-3" />,         border: 'border-zinc-700/40',     bg: 'bg-zinc-900/80',       textColor: 'text-zinc-300',  iconColor: 'text-zinc-500' },
  memory:   { icon: <Database className="w-3 h-3" />,       border: 'border-sky-500/30',      bg: 'bg-sky-950/30',        textColor: 'text-zinc-200',  iconColor: 'text-sky-400' },
  agent:    { icon: <Bot className="w-3 h-3" />,            border: 'border-violet-500/30',   bg: 'bg-violet-950/30',     textColor: 'text-zinc-200',  iconColor: 'text-violet-400' },
  success:  { icon: <CheckCircle2 className="w-3 h-3" />,   border: 'border-emerald-500/30',  bg: 'bg-emerald-950/30',    textColor: 'text-zinc-200',  iconColor: 'text-emerald-400' },
  warning:  { icon: <AlertCircle className="w-3 h-3" />,    border: 'border-rose-500/30',     bg: 'bg-rose-950/30',       textColor: 'text-zinc-200',  iconColor: 'text-rose-400' },
};

// ─── AuraThoughtCard ──────────────────────────────────────────────────────────

export function AuraThoughtCard({ thought, onDismiss, className }: AuraThoughtCardProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fade in
    const enterTimer = setTimeout(() => setVisible(true), 10);

    // Auto-dismiss
    if (thought.ttl && thought.ttl > 0) {
      timerRef.current = setTimeout(() => {
        setExiting(true);
        setTimeout(() => onDismiss?.(thought.id), 400);
      }, thought.ttl);
    }

    return () => {
      clearTimeout(enterTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [thought.id, thought.ttl, onDismiss]);

  const variant = thought.variant ?? 'info';
  const cfg = VARIANT_CFG[variant];

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2 rounded-xl border backdrop-blur-sm',
        'transition-all duration-400',
        cfg.bg, cfg.border,
        visible && !exiting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        className,
      )}
    >
      <span className={cn('flex-shrink-0 mt-0.5', cfg.iconColor)}>
        {cfg.icon}
      </span>
      <p className={cn('text-[12px] leading-snug', cfg.textColor)}>
        {thought.text}
      </p>
    </div>
  );
}

// ─── AuraThoughtStack — auto-rotating thought list ───────────────────────────

export const MOCK_THOUGHTS: Thought[] = [
  { id: 't1', text: 'Reviewing current mission…',       variant: 'mission',  ttl: 4000 },
  { id: 't2', text: 'Relay packet ready.',               variant: 'relay',    ttl: 4000 },
  { id: 't3', text: '1 approval waiting.',               variant: 'approval', ttl: 5000 },
  { id: 't4', text: 'No external tools running.',        variant: 'tool',     ttl: 4000 },
  { id: 't5', text: 'Memory updated.',                   variant: 'memory',   ttl: 3500 },
  { id: 't6', text: 'Antigravity is standing by.',       variant: 'agent',    ttl: 4000 },
  { id: 't7', text: 'Phase 2E context loaded.',          variant: 'success',  ttl: 3500 },
  { id: 't8', text: 'Handoff tracker up to date.',       variant: 'info',     ttl: 3500 },
];

interface AuraThoughtStackProps {
  /** Max visible thought cards */
  maxVisible?: number;
  /** Which MOCK_THOUGHTS index to start from (wraps). Default 0. */
  initialIndex?: number;
  className?: string;
}

export function AuraThoughtStack({ maxVisible = 3, initialIndex = 0, className }: AuraThoughtStackProps) {
  const [active, setActive] = useState<Thought[]>([]);
  const indexRef = useRef(initialIndex);

  // Seed first thought from initialIndex
  useEffect(() => {
    const first = MOCK_THOUGHTS[initialIndex % MOCK_THOUGHTS.length];
    setActive([{ ...first, id: `${first.id}-${Date.now()}` }]);
    indexRef.current = initialIndex + 1;
  }, [initialIndex]);

  // Rotate thoughts
  useEffect(() => {
    const interval = setInterval(() => {
      const thought = MOCK_THOUGHTS[indexRef.current % MOCK_THOUGHTS.length];
      const unique: Thought = { ...thought, id: `${thought.id}-${Date.now()}` };
      indexRef.current++;
      setActive(prev => {
        const updated = [...prev, unique];
        return updated.slice(-maxVisible);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [maxVisible]);

  const handleDismiss = (id: string) => {
    setActive(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {active.map(thought => (
        <Fragment key={thought.id}>
          <AuraThoughtCard
            thought={thought}
            onDismiss={handleDismiss}
          />
        </Fragment>
      ))}
    </div>
  );
}

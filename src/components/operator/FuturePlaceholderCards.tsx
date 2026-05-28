/**
 * FuturePlaceholderCards — Phase 2E
 *
 * Surfaces planned and concept-stage capabilities so the roadmap
 * is always visible in the operator console. Cards are intentionally
 * non-interactive (no onClick) to signal they are not yet available.
 */

import React, { Fragment } from 'react';
import { Network, Radio, Smartphone, BrainCircuit, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

type CardTier = 'PLANNED' | 'CONCEPT' | 'BETA';

interface PlaceholderCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  tier: CardTier;
  accentColor: string;
}

const FUTURE_CARDS: PlaceholderCard[] = [
  {
    id: 'dispatcher',
    icon: <Network className="w-5 h-5" />,
    title: 'Dispatcher Mode',
    description:
      'Autonomous multi-agent task distribution. AURA coordinates parallel workstreams across agents without manual relay steps.',
    tier: 'PLANNED',
    accentColor: 'indigo',
  },
  {
    id: 'remote-relay',
    icon: <Radio className="w-5 h-5" />,
    title: 'Remote Relay Channel',
    description:
      'Issue commands and approve actions over a secure encrypted tunnel — from anywhere, with full audit logging.',
    tier: 'PLANNED',
    accentColor: 'sky',
  },
  {
    id: 'mobile-approval',
    icon: <Smartphone className="w-5 h-5" />,
    title: 'Mobile Approval Channel',
    description:
      'Push high-priority approvals to a mobile device. Approve or reject agent actions with a single tap.',
    tier: 'PLANNED',
    accentColor: 'emerald',
  },
  {
    id: 'oracle-agent',
    icon: <BrainCircuit className="w-5 h-5" />,
    title: 'Oracle / OpenClaude Agent',
    description:
      'A deep-reasoning synthesis agent with multi-pass review. Designed to integrate with extended thinking models for high-stakes decisions.',
    tier: 'CONCEPT',
    accentColor: 'violet',
  },
];

const tierStyles: Record<CardTier, string> = {
  PLANNED: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400',
  CONCEPT: 'bg-violet-500/10 border-violet-500/25 text-violet-400',
  BETA:    'bg-amber-500/10 border-amber-500/25 text-amber-400',
};

const accentStyles: Record<string, string> = {
  indigo:  'text-indigo-500/50 bg-indigo-500/10 border-indigo-500/20',
  sky:     'text-sky-500/50 bg-sky-500/10 border-sky-500/20',
  emerald: 'text-emerald-500/50 bg-emerald-500/10 border-emerald-500/20',
  violet:  'text-violet-500/50 bg-violet-500/10 border-violet-500/20',
};

function PlaceholderCardItem({ card }: { card: PlaceholderCard }) {
  return (
    <div className="relative bg-zinc-900/30 border border-dashed border-zinc-800/60 rounded-2xl p-5 overflow-hidden group">
      {/* Faint background accent */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-zinc-900/0 to-zinc-900/50 pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0',
          accentStyles[card.accentColor]
        )}>
          {card.icon}
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-zinc-700" />
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wider',
            tierStyles[card.tier]
          )}>
            {card.tier}
          </span>
        </div>
      </div>

      {/* Content */}
      <h3 className="text-[14px] font-semibold text-zinc-400 mb-1.5">{card.title}</h3>
      <p className="text-[12px] text-zinc-600 leading-relaxed">{card.description}</p>
    </div>
  );
}

interface FuturePlaceholderCardsProps {
  className?: string;
}

export function FuturePlaceholderCards({ className }: FuturePlaceholderCardsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-300">Roadmap</h2>
          <p className="text-[12px] text-zinc-600 mt-0.5">
            Capabilities in development — not yet available
          </p>
        </div>
        <span className="text-[10px] text-zinc-700 font-semibold uppercase tracking-widest">
          Phase 3+
        </span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FUTURE_CARDS.map(card => (
          <Fragment key={card.id}>
            <PlaceholderCardItem card={card} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

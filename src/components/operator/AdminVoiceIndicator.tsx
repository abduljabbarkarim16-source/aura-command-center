/**
 * AdminVoiceIndicator — Phase 2E Voice Core
 *
 * Small waveform strip representing the admin's voice state.
 * Pure CSS / mock state — no real audio capture.
 */

import type { ReactNode } from 'react';
import { Mic, MicOff, Radio } from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminVoiceState = 'idle' | 'speaking' | 'muted' | 'push-to-talk-ready';

interface AdminVoiceIndicatorProps {
  state?: AdminVoiceState;
  className?: string;
}

// ─── Bar config ───────────────────────────────────────────────────────────────

const BAR_PEAKS  = [0.3, 0.5, 0.75, 0.9, 1.0, 0.9, 0.75, 0.5, 0.3];
const BAR_DELAYS = [0, 60, 120, 180, 100, 140, 80, 40, 20]; // ms

// ─── State configuration ──────────────────────────────────────────────────────

const STATE_CFG: Record<AdminVoiceState, {
  label: string;
  labelColor: string;
  barColor: string;
  dotColor: string;
  icon: ReactNode;
  animate: boolean;
}> = {
  idle: {
    label: 'Admin',
    labelColor: 'text-zinc-500',
    barColor: 'bg-zinc-600',
    dotColor: 'bg-zinc-600',
    icon: <Mic className="w-3 h-3 text-zinc-500" />,
    animate: false,
  },
  speaking: {
    label: 'Speaking',
    labelColor: 'text-sky-400',
    barColor: 'bg-sky-400/70',
    dotColor: 'bg-sky-500',
    icon: <Mic className="w-3 h-3 text-sky-400" />,
    animate: true,
  },
  muted: {
    label: 'Muted',
    labelColor: 'text-rose-500/70',
    barColor: 'bg-rose-900/40',
    dotColor: 'bg-rose-700',
    icon: <MicOff className="w-3 h-3 text-rose-500/70" />,
    animate: false,
  },
  'push-to-talk-ready': {
    label: 'Push to Talk',
    labelColor: 'text-amber-400',
    barColor: 'bg-amber-400/30',
    dotColor: 'bg-amber-500',
    icon: <Radio className="w-3 h-3 text-amber-400" />,
    animate: false,
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminVoiceIndicator({
  state = 'idle',
  className,
}: AdminVoiceIndicatorProps) {
  const cfg = STATE_CFG[state];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* Icon */}
      <div className="flex-shrink-0">
        {cfg.icon}
      </div>

      {/* Waveform bars */}
      <div className="flex items-center gap-[2px]" style={{ height: 20 }}>
        {BAR_PEAKS.map((peak, i) => {
          const baseH = cfg.animate ? Math.round(peak * 16) : Math.round(peak * 4);
          return (
            <div
              key={i}
              className={cn('w-[2px] rounded-full transition-all', cfg.barColor)}
              style={{
                height: `${baseH}px`,
                ...(cfg.animate ? {
                  animationName: 'admin-bar-bounce',
                  animationDuration: '0.7s',
                  animationDelay: `${BAR_DELAYS[i]}ms`,
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                  animationDirection: 'alternate',
                } : {}),
              }}
            />
          );
        })}
      </div>

      {/* Label + status dot */}
      <div className="flex items-center gap-1.5">
        <span className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          cfg.dotColor,
          state === 'speaking' && 'animate-pulse',
          state === 'push-to-talk-ready' && 'animate-pulse',
        )} />
        <span className={cn('text-[11px] font-semibold tracking-wide', cfg.labelColor)}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ─── Keyframe injection ───────────────────────────────────────────────────────

const adminBarStyle =
  typeof document !== 'undefined' && !document.getElementById('admin-bar-bounce')
    ? Object.assign(document.createElement('style'), {
        id: 'admin-bar-bounce',
        textContent: `@keyframes admin-bar-bounce {
          from { transform: scaleY(0.25); }
          to   { transform: scaleY(1.1); }
        }`,
      })
    : null;

if (adminBarStyle && typeof document !== 'undefined') {
  document.head.appendChild(adminBarStyle);
}

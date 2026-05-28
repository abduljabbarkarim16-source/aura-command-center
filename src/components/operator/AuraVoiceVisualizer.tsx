/**
 * AuraVoiceVisualizer — Phase 2E Deep Refinement
 *
 * Premium orb + waveform visualizer for the AURA assistant presence.
 * Pure CSS animations — no Web Audio API, no microphone access.
 * Accepts mock amplitude (0–1) for future real audio hookup.
 */

import React from 'react';
import { cn } from '../../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type VisualizerState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'waiting_for_approval'
  | 'executing'
  | 'error';

export interface AuraVoiceVisualizerProps {
  state?: VisualizerState;
  /** Mock amplitude 0–1. Real audio value can be wired here later. */
  amplitude?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
}

// ─── State configuration ──────────────────────────────────────────────────────

const STATE_CONFIG: Record<VisualizerState, {
  label: string;
  orbColor: string;
  glowColor: string;
  ringColor: string;
  barColor: string;
  labelColor: string;
  ringSpeed: string;
  barSpeed: string;
}> = {
  idle: {
    label: 'Ready',
    orbColor: 'from-zinc-600/70 to-zinc-800',
    glowColor: 'rgba(99,102,241,0.12)',
    ringColor: 'bg-zinc-700/30',
    barColor: 'bg-zinc-600',
    labelColor: 'text-zinc-500',
    ringSpeed: 'animation-duration-[4s]',
    barSpeed: 'animation-duration-[2s]',
  },
  listening: {
    label: 'Listening',
    orbColor: 'from-indigo-500 to-blue-600',
    glowColor: 'rgba(99,102,241,0.35)',
    ringColor: 'bg-indigo-500/25',
    barColor: 'bg-indigo-400',
    labelColor: 'text-indigo-400',
    ringSpeed: 'animation-duration-[1.5s]',
    barSpeed: 'animation-duration-[0.6s]',
  },
  thinking: {
    label: 'Thinking',
    orbColor: 'from-violet-500 to-purple-700',
    glowColor: 'rgba(139,92,246,0.35)',
    ringColor: 'bg-violet-500/25',
    barColor: 'bg-violet-400',
    labelColor: 'text-violet-400',
    ringSpeed: 'animation-duration-[2s]',
    barSpeed: 'animation-duration-[1.2s]',
  },
  speaking: {
    label: 'Speaking',
    orbColor: 'from-emerald-500 to-teal-600',
    glowColor: 'rgba(16,185,129,0.35)',
    ringColor: 'bg-emerald-500/25',
    barColor: 'bg-emerald-400',
    labelColor: 'text-emerald-400',
    ringSpeed: 'animation-duration-[0.8s]',
    barSpeed: 'animation-duration-[0.4s]',
  },
  waiting_for_approval: {
    label: 'Waiting for approval',
    orbColor: 'from-amber-500 to-orange-600',
    glowColor: 'rgba(245,158,11,0.30)',
    ringColor: 'bg-amber-500/25',
    barColor: 'bg-amber-400',
    labelColor: 'text-amber-400',
    ringSpeed: 'animation-duration-[2.5s]',
    barSpeed: 'animation-duration-[1.8s]',
  },
  executing: {
    label: 'Executing',
    orbColor: 'from-orange-500 to-red-600',
    glowColor: 'rgba(249,115,22,0.30)',
    ringColor: 'bg-orange-500/25',
    barColor: 'bg-orange-400',
    labelColor: 'text-orange-400',
    ringSpeed: 'animation-duration-[1s]',
    barSpeed: 'animation-duration-[0.5s]',
  },
  error: {
    label: 'Error',
    orbColor: 'from-rose-500 to-red-700',
    glowColor: 'rgba(244,63,94,0.35)',
    ringColor: 'bg-rose-500/25',
    barColor: 'bg-rose-400',
    labelColor: 'text-rose-400',
    ringSpeed: 'animation-duration-[0.6s]',
    barSpeed: 'animation-duration-[0.3s]',
  },
};

// ─── Size configuration ───────────────────────────────────────────────────────

const SIZE_CONFIG = {
  sm: { orb: 'w-10 h-10', bars: 'h-6', barW: 'w-0.5', ring: 'w-14 h-14', ring2: 'w-20 h-20' },
  md: { orb: 'w-16 h-16', bars: 'h-10', barW: 'w-0.5', ring: 'w-24 h-24', ring2: 'w-32 h-32' },
  lg: { orb: 'w-24 h-24', bars: 'h-14', barW: 'w-1',   ring: 'w-36 h-36', ring2: 'w-48 h-48' },
  xl: { orb: 'w-32 h-32', bars: 'h-20', barW: 'w-1',   ring: 'w-48 h-48', ring2: 'w-64 h-64' },
};

// ─── Waveform bars (7 bars, staggered animations) ─────────────────────────────

const BAR_HEIGHTS = [0.4, 0.7, 0.9, 1.0, 0.9, 0.7, 0.4];
const BAR_DELAYS  = [0, 80, 160, 240, 160, 80, 0]; // ms

// ─── Component ───────────────────────────────────────────────────────────────

export function AuraVoiceVisualizer({
  state = 'idle',
  amplitude = 0.5,
  size = 'md',
  showLabel = true,
  className,
}: AuraVoiceVisualizerProps) {
  const cfg   = STATE_CONFIG[state];
  const sizes = SIZE_CONFIG[size];

  const isActive = state !== 'idle' && state !== 'error';
  const effectiveAmplitude = Math.max(0.1, Math.min(1, amplitude));

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* ── Orb + rings ─────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center">

        {/* Outer glow ring (slow) */}
        {isActive && (
          <div
            className={cn(
              'absolute rounded-full opacity-0 animate-ping',
              sizes.ring2,
              cfg.ringColor
            )}
            style={{ animationDuration: '2.4s', animationDelay: '0.6s' }}
          />
        )}

        {/* Mid glow ring */}
        {isActive && (
          <div
            className={cn(
              'absolute rounded-full opacity-0 animate-ping',
              sizes.ring,
              cfg.ringColor
            )}
            style={{ animationDuration: '1.8s' }}
          />
        )}

        {/* Wide diffuse glow (second layer) */}
        <div
          className="absolute rounded-full blur-3xl transition-all duration-700 opacity-60"
          style={{
            width: '180%',
            height: '180%',
            background: cfg.glowColor,
          }}
        />

        {/* Primary glow backdrop */}
        <div
          className="absolute rounded-full blur-xl transition-all duration-700"
          style={{
            width: '140%',
            height: '140%',
            background: cfg.glowColor,
          }}
        />

        {/* Premium outer border ring — always visible, varies by state */}
        <div
          className="absolute rounded-full border transition-all duration-700 pointer-events-none"
          style={{
            width: 'calc(100% + 12px)',
            height: 'calc(100% + 12px)',
            borderColor: isActive
              ? cfg.glowColor.replace(/[\d.]+\)$/, '0.35)')
              : 'rgba(99,102,241,0.08)',
            boxShadow: isActive
              ? `0 0 12px 2px ${cfg.glowColor.replace(/[\d.]+\)$/, '0.15)')}`
              : 'none',
          }}
        />

        {/* ── Orb ─────────────────────────────────────────────────── */}
        <div
          className={cn(
            'relative rounded-full flex items-center justify-center bg-gradient-to-br transition-all duration-700',
            'shadow-[inset_0_1px_1px_rgba(255,255,255,0.07),inset_0_-1px_1px_rgba(0,0,0,0.4)]',
            sizes.orb,
            cfg.orbColor,
            isActive && 'animate-pulse',
          )}
          style={
            isActive
              ? { animationDuration: state === 'speaking' ? '0.6s' : state === 'listening' ? '1s' : '2s' }
              : state === 'idle'
              ? {
                  animationName: 'idle-breathe',
                  animationDuration: '5s',
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                }
              : undefined
          }
        >
          {/* Waveform bars inside orb (only in active states) */}
          {(state === 'speaking' || state === 'listening') && (
            <div className="flex items-center gap-0.5">
              {BAR_HEIGHTS.map((baseH, i) => (
                <div
                  key={i}
                  className={cn('rounded-full opacity-80 transition-all', sizes.barW, cfg.barColor)}
                  style={{
                    height: `${Math.round(baseH * effectiveAmplitude * (size === 'sm' ? 16 : size === 'md' ? 24 : 36))}px`,
                    animationName: 'bar-bounce',
                    animationDuration: state === 'speaking' ? '0.5s' : '0.8s',
                    animationDelay: `${BAR_DELAYS[i]}ms`,
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDirection: 'alternate',
                  }}
                />
              ))}
            </div>
          )}

          {/* Thinking spinner ring */}
          {state === 'thinking' && (
            <div
              className="absolute inset-1 rounded-full border-2 border-transparent border-t-violet-300/70"
              style={{ animation: 'spin 1.5s linear infinite' }}
            />
          )}

          {/* Executing spinner */}
          {state === 'executing' && (
            <div
              className="absolute inset-1 rounded-full border-2 border-transparent border-t-orange-300/70 border-r-orange-300/30"
              style={{ animation: 'spin 0.8s linear infinite' }}
            />
          )}

          {/* Error X marker */}
          {state === 'error' && (
            <div className="text-white/80 font-bold text-lg select-none">✕</div>
          )}

          {/* Idle dot */}
          {state === 'idle' && (
            <div className="w-2 h-2 rounded-full bg-zinc-500/80" />
          )}

          {/* Waiting amber dot */}
          {state === 'waiting_for_approval' && (
            <div className="w-3 h-3 rounded-full bg-amber-300/90 animate-pulse" />
          )}
        </div>
      </div>

      {/* ── Label ───────────────────────────────────────────────────── */}
      {showLabel && (
        <span className={cn(
          'text-[11px] font-semibold uppercase tracking-widest transition-colors duration-500',
          cfg.labelColor
        )}>
          {cfg.label}
        </span>
      )}
    </div>
  );
}

// ─── Inline style injection for keyframes ─────────────────────────────────────

// Injected once at module load; id guards against duplicate insertion.
const auraKeyframesStyle =
  typeof document !== 'undefined' && !document.getElementById('aura-keyframes')
    ? Object.assign(document.createElement('style'), {
        id: 'aura-keyframes',
        textContent: [
          `@keyframes bar-bounce { from { transform: scaleY(0.3); } to { transform: scaleY(1.2); } }`,
          `@keyframes idle-breathe {`,
          `  0%, 100% { opacity: 0.72; transform: scale(1); }`,
          `  50%       { opacity: 1;    transform: scale(1.035); }`,
          `}`,
        ].join('\n'),
      })
    : null;

if (auraKeyframesStyle && typeof document !== 'undefined') {
  document.head.appendChild(auraKeyframesStyle);
}

// ─── Compact inline orb (for top nav / status strip) ─────────────────────────

export function AuraPresenceDot({
  state = 'idle',
  className,
}: {
  state?: VisualizerState;
  className?: string;
}) {
  const cfg = STATE_CONFIG[state];
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <div
        className={cn(
          'w-3 h-3 rounded-full bg-gradient-to-br transition-all duration-700',
          cfg.orbColor,
          state !== 'idle' && 'animate-pulse'
        )}
      />
      {state !== 'idle' && state !== 'error' && (
        <div
          className={cn('absolute inset-0 rounded-full animate-ping opacity-60', cfg.ringColor)}
          style={{ animationDuration: '1.5s' }}
        />
      )}
    </div>
  );
}

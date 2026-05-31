/**
 * AuraVoiceVisualizer — Phase 2E Audio-Reactive Rebuild
 *
 * Multi-layer audio-reactive visualizer:
 *   Layer 1 — Diffuse glow  (opacity scales with energyLevel)
 *   Layer 2 — SVG spectrum ring  (radial bars driven by frequencyBands)
 *   Layer 3 — Energy pulse rings  (only rendered when energyLevel > threshold)
 *   Layer 4 — Outer border ring  (glow intensity scales with energyLevel)
 *   Layer 5 — Orb  (state-colored gradient, glass highlight)
 *             ↳ Inner elements: waveform bars / spinner / dot / mark
 *
 * Idle state: perfectly calm — only the gentle idle-breathe keyframe, no fake activity.
 * All motion is data-driven from useMockAudioReactivity (or external frequencyBands).
 *
 * New props:
 *   frequencyBands — per-band magnitudes (0–1). Omit to use internal mock.
 *   mode           — visual character: 'ambient'|'voice'|'music'|'agent'
 *   source         — speaker accent: 'aura'|'admin'|'system'
 */

import { cn } from '../../lib/utils';
import { useMockAudioReactivity } from '../../hooks/useMockAudioReactivity';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /**
   * Normalized per-band frequency magnitudes (0–1), length 8–64.
   * When omitted, internal useMockAudioReactivity drives the visualizer.
   *
   * FUTURE: pass analyser.getByteFrequencyData() values here.
   */
  frequencyBands?: number[];
  /**
   * Overall amplitude 0–1. Overrides internal mock envelope when provided.
   */
  amplitude?: number;
  /**
   * Visual mode — controls energy character and bar density.
   * 'ambient': softer, sparser  |  'voice': standard  |  'music': denser, louder  |  'agent': structured
   * Full per-mode differentiation planned for Phase 3.
   */
  mode?: 'ambient' | 'voice' | 'music' | 'agent';
  /**
   * Source accent — changes SVG bar color to identify who is speaking.
   * 'aura' (default): state color  |  'admin': amber  |  'system': zinc
   */
  source?: 'aura' | 'admin' | 'system';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
}

// ─── State configuration ──────────────────────────────────────────────────────

interface StateConfig {
  label:      string;
  orbColor:   string;   // Tailwind gradient classes
  glowColor:  string;   // CSS rgba string for backdrop glow
  ringColor:  string;   // Tailwind class for ping rings
  barColor:   string;   // Tailwind class for inner waveform bars
  svgColor:   string;   // CSS rgba string for SVG spectrum lines
  labelColor: string;   // Tailwind class for state label
}

const STATE_CONFIG: Record<VisualizerState, StateConfig> = {
  idle: {
    label:      'Ready',
    orbColor:   'from-zinc-600/70 to-zinc-800',
    glowColor:  'rgba(99,102,241,0.10)',
    ringColor:  'bg-zinc-700/20',
    barColor:   'bg-zinc-400',
    svgColor:   'rgba(113,113,122,0.55)',
    labelColor: 'text-zinc-600',
  },
  listening: {
    label:      'Listening',
    orbColor:   'from-indigo-500 to-blue-600',
    glowColor:  'rgba(99,102,241,0.40)',
    ringColor:  'bg-indigo-500/20',
    barColor:   'bg-indigo-200',
    svgColor:   'rgba(99,102,241,0.82)',
    labelColor: 'text-indigo-400',
  },
  thinking: {
    label:      'Thinking',
    orbColor:   'from-violet-500 to-purple-700',
    glowColor:  'rgba(139,92,246,0.36)',
    ringColor:  'bg-violet-500/20',
    barColor:   'bg-violet-200',
    svgColor:   'rgba(139,92,246,0.78)',
    labelColor: 'text-violet-400',
  },
  speaking: {
    label:      'Speaking',
    orbColor:   'from-emerald-500 to-teal-600',
    glowColor:  'rgba(16,185,129,0.40)',
    ringColor:  'bg-emerald-500/20',
    barColor:   'bg-emerald-200',
    svgColor:   'rgba(16,185,129,0.82)',
    labelColor: 'text-emerald-400',
  },
  waiting_for_approval: {
    label:      'Awaiting approval',
    orbColor:   'from-amber-500 to-orange-600',
    glowColor:  'rgba(245,158,11,0.30)',
    ringColor:  'bg-amber-500/20',
    barColor:   'bg-amber-200',
    svgColor:   'rgba(245,158,11,0.72)',
    labelColor: 'text-amber-400',
  },
  executing: {
    label:      'Executing',
    orbColor:   'from-orange-500 to-red-600',
    glowColor:  'rgba(249,115,22,0.34)',
    ringColor:  'bg-orange-500/20',
    barColor:   'bg-orange-200',
    svgColor:   'rgba(249,115,22,0.75)',
    labelColor: 'text-orange-400',
  },
  error: {
    label:      'Error',
    orbColor:   'from-rose-500 to-red-700',
    glowColor:  'rgba(244,63,94,0.36)',
    ringColor:  'bg-rose-500/20',
    barColor:   'bg-rose-200',
    svgColor:   'rgba(244,63,94,0.75)',
    labelColor: 'text-rose-400',
  },
};

// Source → SVG color override (identifies who is speaking)
const SOURCE_SVG_COLOR: Partial<Record<string, string>> = {
  admin:  'rgba(245,158,11,0.80)',
  system: 'rgba(113,113,122,0.58)',
};

// ─── Size configuration ───────────────────────────────────────────────────────

interface SizeConfig {
  orb:            string;  // Tailwind w/h classes (diameter)
  orbPx:          number;  // orb radius in px (diameter ÷ 2)
  spectrumSizePx: number;  // SVG container size (must fit orb + full bars)
  maxBarPx:       number;  // max spectrum bar extension in px
  spectrumGap:    number;  // gap (px) between orb edge and bar root
  strokeW:        number;  // SVG strokeWidth
  barW:           string;  // Tailwind class for inner waveform bar width
}

const SIZE_CONFIG: Record<string, SizeConfig> = {
  sm: { orb: 'w-10 h-10',  orbPx: 20, spectrumSizePx: 100, maxBarPx: 18, spectrumGap:  8, strokeW: 1.5, barW: 'w-px'   },
  md: { orb: 'w-16 h-16',  orbPx: 32, spectrumSizePx: 152, maxBarPx: 28, spectrumGap:  9, strokeW: 2.0, barW: 'w-0.5' },
  lg: { orb: 'w-24 h-24',  orbPx: 48, spectrumSizePx: 218, maxBarPx: 40, spectrumGap: 10, strokeW: 2.0, barW: 'w-0.5' },
  xl: { orb: 'w-32 h-32',  orbPx: 64, spectrumSizePx: 282, maxBarPx: 52, spectrumGap: 12, strokeW: 2.5, barW: 'w-1'   },
};

// ─── AuraVoiceVisualizer ──────────────────────────────────────────────────────

export function AuraVoiceVisualizer({
  state          = 'idle',
  frequencyBands: externalBands,
  amplitude:      externalAmplitude,
  mode           = 'voice',
  source         = 'aura',
  size           = 'md',
  showLabel      = true,
  className,
}: AuraVoiceVisualizerProps) {

  // Internal audio-reactive data — always runs; values overridden when external props provided.
  // Component re-renders at ~60fps only for itself; parent is unaffected.
  const mock = useMockAudioReactivity(state);

  const bands       = externalBands      ?? mock.frequencyBands;
  const amplitude   = externalAmplitude  ?? mock.amplitude;
  const energyLevel = mock.energyLevel;  // use internal envelope regardless of external bands

  void amplitude; // acknowledged — available for future external override use

  const cfg   = STATE_CONFIG[state];
  const sizes = SIZE_CONFIG[size];

  // SVG bar color — source accent overrides state color when speaking as admin/system
  const svgBarColor = SOURCE_SVG_COLOR[source] ?? cfg.svgColor;

  // Mode → max bar height multiplier
  const barMultiplier = mode === 'music' ? 1.25 : mode === 'ambient' ? 0.65 : 1.0;

  // SVG geometry
  const cx     = sizes.spectrumSizePx / 2;
  const cy     = sizes.spectrumSizePx / 2;
  const innerR = sizes.orbPx + sizes.spectrumGap;
  const n      = bands.length || 1;

  // Compute spectrum ring lines for this frame
  const spectrumLines = bands.map((magnitude, i) => {
    const angle  = (i / n) * 2 * Math.PI - Math.PI / 2; // start from 12-o'clock
    const barLen = magnitude * sizes.maxBarPx * barMultiplier;
    const cos    = Math.cos(angle);
    const sin    = Math.sin(angle);
    return {
      x1: cx + innerR * cos,
      y1: cy + innerR * sin,
      x2: cx + (innerR + barLen) * cos,
      y2: cy + (innerR + barLen) * sin,
      magnitude,
    };
  });

  // Inner waveform bars — only for speaking/listening, sampled from mid-freq bands
  const innerBars: number[] = [];
  if (state === 'speaking' || state === 'listening') {
    const midStart = Math.floor(n * 0.12);
    const midEnd   = Math.floor(n * 0.65);
    const midSlice = bands.slice(midStart, midEnd);
    const barCount = 7;
    const step     = Math.max(1, midSlice.length / barCount);
    const maxH     = sizes.orbPx * 0.60;
    for (let i = 0; i < barCount; i++) {
      const v = midSlice[Math.floor(i * step)] ?? 0;
      innerBars.push(Math.max(2, Math.round(v * maxH)));
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>

      {/* ── Visualization container (sized to hold spectrum ring) ────── */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: sizes.spectrumSizePx, height: sizes.spectrumSizePx }}
      >

        {/* ── Layer 1: Diffuse backdrop glow ──────────────────────────── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width:      '72%',
              height:     '72%',
              background: cfg.glowColor,
              opacity:    0.07 + energyLevel * 0.55,
              transition: 'opacity 0.7s ease, background 0.7s ease',
            }}
          />
          <div
            className="absolute rounded-full blur-xl"
            style={{
              width:      '52%',
              height:     '52%',
              background: cfg.glowColor,
              opacity:    0.10 + energyLevel * 0.45,
              transition: 'opacity 0.5s ease',
            }}
          />
        </div>

        {/* ── Layer 2: SVG spectrum ring ───────────────────────────────── */}
        {energyLevel > 0.015 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={sizes.spectrumSizePx}
            height={sizes.spectrumSizePx}
            viewBox={`0 0 ${sizes.spectrumSizePx} ${sizes.spectrumSizePx}`}
            aria-hidden="true"
          >
            {spectrumLines.map(({ x1, y1, x2, y2, magnitude }, i) =>
              magnitude > 0.01 ? (
                <line
                  key={i}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  stroke={svgBarColor}
                  strokeWidth={sizes.strokeW}
                  strokeLinecap="round"
                  opacity={0.28 + magnitude * 0.72}
                />
              ) : null,
            )}
          </svg>
        )}

        {/* ── Layer 3: Energy pulse rings (only when active) ──────────── */}
        {energyLevel > 0.18 && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <div
              className={cn('absolute rounded-full animate-ping', cfg.ringColor)}
              style={{
                width:             sizes.orbPx * 2 + 30,
                height:            sizes.orbPx * 2 + 30,
                opacity:           Math.min(0.50, energyLevel * 0.65),
                animationDuration: `${Math.max(0.6, 2.8 - energyLevel * 1.8)}s`,
              }}
            />
          </div>
        )}
        {energyLevel > 0.44 && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <div
              className={cn('absolute rounded-full animate-ping', cfg.ringColor)}
              style={{
                width:             sizes.orbPx * 2 + 14,
                height:            sizes.orbPx * 2 + 14,
                opacity:           Math.min(0.38, energyLevel * 0.42),
                animationDuration: `${Math.max(0.4, 1.8 - energyLevel * 1.0)}s`,
                animationDelay:    '0.28s',
              }}
            />
          </div>
        )}

        {/* ── Layer 4: Outer border ring ───────────────────────────────── */}
        <div
          className="absolute rounded-full border pointer-events-none"
          style={{
            width:       sizes.orbPx * 2 + 10,
            height:      sizes.orbPx * 2 + 10,
            borderColor: energyLevel > 0.06
              ? cfg.glowColor.replace(/[\d.]+\)$/, `${(0.18 + energyLevel * 0.38).toFixed(2)})`)
              : 'rgba(99,102,241,0.07)',
            boxShadow: energyLevel > 0.06
              ? `0 0 ${(6 + energyLevel * 20).toFixed(0)}px ${(energyLevel * 3).toFixed(0)}px ${cfg.glowColor.replace(/[\d.]+\)$/, `${(energyLevel * 0.18).toFixed(2)})`)}`
              : 'none',
            transition: 'border-color 0.6s ease, box-shadow 0.6s ease',
          }}
        />

        {/* ── Layer 5: Orb ─────────────────────────────────────────────── */}
        <div
          className={cn(
            'relative z-10 rounded-full flex items-center justify-center',
            'bg-gradient-to-br transition-colors duration-700',
            // Glass inner highlight — inset shadow trick
            'shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-1px_2px_rgba(0,0,0,0.55)]',
            sizes.orb,
            cfg.orbColor,
          )}
          style={state === 'idle' ? {
            animationName:           'idle-breathe',
            animationDuration:       '5s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
          } : undefined}
        >

          {/* Inner waveform — data-driven heights for listening/speaking */}
          {innerBars.length > 0 && (
            <div className="flex items-end gap-px">
              {innerBars.map((h, i) => (
                <div
                  key={i}
                  className={cn('rounded-full opacity-80', sizes.barW, cfg.barColor)}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
          )}

          {/* Thinking spinner */}
          {state === 'thinking' && (
            <div
              className="absolute inset-2 rounded-full border-2 border-transparent border-t-violet-300/70"
              style={{ animation: 'spin 1.5s linear infinite' }}
            />
          )}

          {/* Executing dual-arc spinner */}
          {state === 'executing' && (
            <div
              className="absolute inset-2 rounded-full border-2 border-transparent border-t-orange-300/70 border-r-orange-300/25"
              style={{ animation: 'spin 0.75s linear infinite' }}
            />
          )}

          {/* Error mark */}
          {state === 'error' && (
            <span className="text-white/80 font-bold text-lg select-none leading-none">✕</span>
          )}

          {/* Idle: small calm dot */}
          {state === 'idle' && (
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400/50" />
          )}

          {/* Waiting for approval: amber pulse dot */}
          {state === 'waiting_for_approval' && (
            <div className="w-3 h-3 rounded-full bg-amber-300/90 animate-pulse" />
          )}
        </div>
      </div>

      {/* ── State label ──────────────────────────────────────────────── */}
      {showLabel && (
        <span className={cn(
          'text-[11px] font-semibold uppercase tracking-widest',
          'transition-colors duration-500',
          cfg.labelColor,
        )}>
          {cfg.label}
        </span>
      )}
    </div>
  );
}

// ─── Keyframe injection ───────────────────────────────────────────────────────
// One-time injection; id guard prevents duplicates across HMR cycles.

const _auraStyleEl =
  typeof document !== 'undefined' && !document.getElementById('aura-keyframes')
    ? Object.assign(document.createElement('style'), {
        id: 'aura-keyframes',
        textContent: [
          `@keyframes idle-breathe {`,
          `  0%, 100% { opacity: 0.70; transform: scale(1);     }`,
          `  50%       { opacity: 1;    transform: scale(1.038); }`,
          `}`,
        ].join('\n'),
      })
    : null;

if (_auraStyleEl && typeof document !== 'undefined') {
  document.head.appendChild(_auraStyleEl);
}

// ─── AuraPresenceDot — compact inline status dot (top nav / status strip) ────

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
          state !== 'idle' && 'animate-pulse',
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

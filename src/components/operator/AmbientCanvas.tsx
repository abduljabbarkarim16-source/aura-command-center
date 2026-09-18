/**
 * AmbientCanvas — AURA Phase 3J QA (Milestone 2)
 *
 * The "living visual work surface" behind Voice Core. Turns the previously blank
 * black center into a premium, state-reactive ambient field WITHOUT faking task
 * activity: it is calm and subtle when idle, and shifts colour/intensity to
 * reflect real voice/runtime state (listening, thinking, speaking, working).
 *
 * Implementation is GPU-light: two drifting blurred radial gradients + a faint
 * dot grid + a vignette, animated with CSS keyframes (see index.css). Honours
 * `prefers-reduced-motion`. Pointer-events: none, so it never blocks controls.
 */

import { cn } from '../../lib/utils';

export type AmbientState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'working' | 'error';

interface Theme { a: string; b: string; intensity: number; live: boolean; }

// RGB triplets (no alpha) so we can scale opacity per state.
const THEMES: Record<AmbientState, Theme> = {
  idle:      { a: '99,102,241',  b: '139,92,246',  intensity: 0.12, live: false }, // indigo / violet — calm
  listening: { a: '56,189,248',  b: '34,211,238',  intensity: 0.24, live: true  }, // sky / cyan — reactive
  thinking:  { a: '139,92,246',  b: '99,102,241',  intensity: 0.22, live: true  }, // violet — pondering
  speaking:  { a: '129,140,248', b: '52,211,153',  intensity: 0.26, live: true  }, // indigo / emerald
  working:   { a: '251,191,36',  b: '99,102,241',  intensity: 0.22, live: true  }, // amber / indigo — task
  error:     { a: '244,63,94',   b: '251,113,133', intensity: 0.20, live: false }, // rose
};

export function AmbientCanvas({ state = 'idle', className }: { state?: AmbientState; className?: string }) {
  const t = THEMES[state] ?? THEMES.idle;

  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden', className)}>
      {/* Base wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-black" />

      {/* Drifting aurora blobs — colour + intensity follow state, transitioned smoothly */}
      <div
        className={cn('ambient-blob-a absolute -top-1/4 left-1/2 h-[85vh] w-[85vh] -translate-x-1/2 rounded-full blur-3xl transition-all duration-1000', t.live && 'ambient-breathe')}
        style={{ background: `radial-gradient(circle, rgba(${t.a},${t.intensity}) 0%, rgba(${t.a},0) 62%)` }}
      />
      <div
        className="ambient-blob-b absolute bottom-[-22%] left-[22%] h-[62vh] w-[62vh] rounded-full blur-3xl transition-all duration-1000"
        style={{ background: `radial-gradient(circle, rgba(${t.b},${t.intensity * 0.85}) 0%, rgba(${t.b},0) 60%)` }}
      />

      {/* Faint dot grid — gives the dark space depth and motion without clutter */}
      <div
        className="ambient-grid absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.65) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Vignette to keep edges grounded and center readable */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.6) 100%)' }}
      />
    </div>
  );
}

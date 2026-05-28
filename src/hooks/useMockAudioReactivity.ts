/**
 * useMockAudioReactivity — Phase 2E Audio-Reactive Voice Core
 *
 * Returns mock audio-reactivity data driven by requestAnimationFrame.
 * Each VisualizerState produces a distinct energy profile so the visualizer
 * reacts differently to idle, listening, speaking, thinking, etc.
 *
 * ─── WEB AUDIO API HOOKUP (future) ───────────────────────────────────────────
 *
 * When real microphone or TTS audio access is added, replace the mock
 * tick() body with real analyser data:
 *
 *   // 1. Capture audio stream
 *   const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
 *
 *   // 2. Build Web Audio pipeline
 *   const audioCtx = new AudioContext();
 *   const source   = audioCtx.createMediaStreamSource(stream);
 *   const analyser = audioCtx.createAnalyser();
 *   analyser.fftSize              = NUM_BANDS * 2; // e.g. 64 → 32 frequency bins
 *   analyser.smoothingTimeConstant = 0.8;          // 0 = instant, 1 = infinite hold
 *   source.connect(analyser);
 *
 *   // 3. In tick(), read frequency data each frame:
 *   const dataArray = new Uint8Array(analyser.frequencyBinCount); // length = NUM_BANDS
 *   analyser.getByteFrequencyData(dataArray);   // fills 0–255 per frequency bin
 *   // For waveform: analyser.getByteTimeDomainData(dataArray); // 128 = silence center
 *
 *   const freqBands  = Array.from(dataArray).map(v => v / 255);  // normalize to 0–1
 *   const amplitude  = freqBands.reduce((a, b) => a + b, 0) / freqBands.length;
 *   setData({ amplitude, frequencyBands: freqBands, energyLevel: amplitude, isActive: amplitude > 0.02 });
 *
 *   // 4. In cleanup:
 *   stream.getTracks().forEach(t => t.stop());  // release microphone
 *   audioCtx.close();
 *
 * The hook's return type (AudioReactivityData) stays identical — only the
 * data source changes. The visualizer requires no modification.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react';

// TYPE-ONLY import — erased at compile time, no circular runtime dependency.
import type { VisualizerState } from '../components/operator/AuraVoiceVisualizer';

/** Number of simulated frequency bins. Mirrors a real analyser with fftSize=64. */
const NUM_BANDS = 32;

export interface AudioReactivityData {
  /** Overall normalized amplitude 0–1 */
  amplitude: number;
  /** Per-band frequency magnitudes, normalized 0–1, length = NUM_BANDS */
  frequencyBands: number[];
  /** Smoothed overall energy level 0–1 */
  energyLevel: number;
  /** True when audio is meaningfully active (amplitude above silence threshold) */
  isActive: boolean;
}

/** Energy profile per visualizer state — controls mock data character */
interface StateProfile {
  baseEnergy: number;   // resting energy floor
  variance:   number;   // energy fluctuation range
  oscSpeed:   number;   // oscillation speed multiplier (0 = still)
}

const STATE_PROFILE: Record<VisualizerState, StateProfile> = {
  idle:                 { baseEnergy: 0,    variance: 0,    oscSpeed: 0   },
  listening:            { baseEnergy: 0.38, variance: 0.32, oscSpeed: 1.6 },
  thinking:             { baseEnergy: 0.13, variance: 0.09, oscSpeed: 0.5 },
  speaking:             { baseEnergy: 0.62, variance: 0.35, oscSpeed: 2.2 },
  waiting_for_approval: { baseEnergy: 0.07, variance: 0.05, oscSpeed: 0.3 },
  executing:            { baseEnergy: 0.28, variance: 0.20, oscSpeed: 1.1 },
  error:                { baseEnergy: 0.08, variance: 0.04, oscSpeed: 0.2 },
};

export function useMockAudioReactivity(state: VisualizerState = 'idle'): AudioReactivityData {
  const [data, setData] = useState<AudioReactivityData>({
    amplitude:      0,
    frequencyBands: Array(NUM_BANDS).fill(0) as number[],
    energyLevel:    0,
    isActive:       false,
  });

  const frameRef = useRef<number | null>(null);

  // Mutable internal values — updated each frame without triggering extra renders.
  // This mirrors how a real analyser node works: data is read imperatively per frame.
  const iv = useRef({ energy: 0, bands: Array(NUM_BANDS).fill(0) as number[] });

  useEffect(() => {
    const profile = STATE_PROFILE[state];

    function tick() {
      const t = performance.now() / 1000; // elapsed seconds
      const { energy, bands } = iv.current;

      let nextEnergy: number;
      let nextBands: number[];

      if (profile.baseEnergy === 0) {
        // Idle — decay smoothly to silence
        nextEnergy = energy * 0.88;
        nextBands  = bands.map(b => b * 0.85);
      } else {
        // Target energy: base + oscillation + noise
        const osc    = Math.sin(t * profile.oscSpeed * Math.PI) * 0.5 + 0.5;
        const noise  = (Math.random() - 0.5) * profile.variance * 0.5;
        const target = Math.max(0, Math.min(1,
          profile.baseEnergy + osc * profile.variance * 0.6 + noise,
        ));

        // Asymmetric smoothing — fast attack, slow release (real audio envelope)
        const attack  = state === 'speaking' ? 0.28 : state === 'listening' ? 0.22 : 0.10;
        const release = attack * 0.45;
        nextEnergy = energy + (target - energy) * (target > energy ? attack : release);

        // Per-band simulation
        // Low frequency bands (bass) are louder and slower.
        // High frequency bands (treble) are quieter and faster.
        nextBands = bands.map((prev, i) => {
          const bandPos   = i / NUM_BANDS;
          const bassBoost = 1 - bandPos * 0.55;
          const bandPhase = t * profile.oscSpeed * (2.2 + i * 0.45);
          const bandOsc   = Math.sin(bandPhase) * 0.5 + 0.5;
          const bandNoise = (Math.random() - 0.5) * profile.variance * 0.35;
          const bandTarget = Math.max(0,
            nextEnergy * bassBoost * (0.38 + bandOsc * 0.62) + bandNoise,
          );
          // Faster smoothing for high-energy states (speech sounds more reactive)
          const bf = state === 'speaking' ? 0.30 : state === 'listening' ? 0.22 : 0.12;
          return Math.max(0, prev + (bandTarget - prev) * bf);
        });
      }

      iv.current.energy = nextEnergy;
      iv.current.bands  = nextBands;

      const amplitude = Math.min(1, Math.max(0, nextEnergy));
      setData({
        amplitude,
        frequencyBands: [...nextBands],
        energyLevel:    amplitude,
        isActive:       amplitude > 0.04,
      });

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [state]);

  return data;
}

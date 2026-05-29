/**
 * VoiceAudioBridge — AURA Milestone H
 *
 * Documents and stubs the audio analysis bridge between real voice providers
 * and the AuraVoiceVisualizer component.
 *
 * Currently: returns mock frame data (same as useMockAudioReactivity).
 * Phase 3: replaces mock data with real WebAudio analyser output.
 *
 * NEVER: request microphone permission, create AudioContext, capture audio.
 */

export interface AudioFrame {
  /** Normalized frequency bands 0-1, length matches NUM_BANDS in visualizer */
  frequencyBands: number[];
  amplitude: number;
  energyLevel: number;
  isActive: boolean;
  /** 'mock' until Phase 3 wires real audio */
  source: 'mock' | 'microphone' | 'tts-output';
}

export type AudioFrameListener = (frame: AudioFrame) => void;

class VoiceAudioBridge {
  private listeners = new Set<AudioFrameListener>();
  private isActive = false;
  private frameTimer: ReturnType<typeof setInterval> | null = null;

  readonly NUM_BANDS = 32;

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(fn: AudioFrameListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Phase 3 connection points ─────────────────────────────────────────────

  /**
   * Phase 3: Connect a real AudioContext analyser node.
   * Not implemented yet — no audio context created.
   *
   * @example (Phase 3 implementation)
   * const ctx = new AudioContext();
   * const analyser = ctx.createAnalyser();
   * analyser.fftSize = 64; // 32 frequency bins
   * analyser.smoothingTimeConstant = 0.8;
   * bridge.connectAnalyser(analyser);
   */
  connectAnalyser(_analyser: unknown): void {
    // Not implemented until Phase 3
    console.warn('[VoiceAudioBridge] connectAnalyser() not yet implemented. Using mock data.');
  }

  /**
   * Phase 3: Connect a media stream (from getUserMedia).
   * Not implemented — no microphone permission requested.
   */
  connectMediaStream(_stream: unknown): void {
    // Not implemented until Phase 3
    console.warn('[VoiceAudioBridge] connectMediaStream() not yet implemented. Microphone access not requested.');
  }

  // ── Mock mode (current) ───────────────────────────────────────────────────

  /** Start emitting mock audio frames at ~60fps. Used only for testing. */
  startMockBroadcast(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.frameTimer = setInterval(() => {
      if (this.listeners.size === 0) return;
      const frame = this.generateMockFrame();
      for (const fn of this.listeners) fn(frame);
    }, 16); // ~60fps
  }

  stopMockBroadcast(): void {
    this.isActive = false;
    if (this.frameTimer !== null) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }

  private generateMockFrame(): AudioFrame {
    const bands = Array.from({ length: this.NUM_BANDS }, (_, i) => {
      const bassBoost = 1 - (i / this.NUM_BANDS) * 0.5;
      return Math.random() * 0.3 * bassBoost;
    });
    const amplitude = bands.reduce((a, b) => a + b, 0) / bands.length;
    return {
      frequencyBands: bands,
      amplitude,
      energyLevel: amplitude,
      isActive: amplitude > 0.04,
      source: 'mock',
    };
  }

  // ── Bridge documentation ───────────────────────────────────────────────────

  getArchitectureDescription(): string {
    return `
VoiceAudioBridge — Architecture (Phase 3 target)

Current (Phase 2):
  useMockAudioReactivity(state)
  → simulated frequencyBands
  → AuraVoiceVisualizer props

Phase 3 STT path:
  getUserMedia({ audio: true })          ← requires user permission
  → MediaStreamSourceNode
  → AnalyserNode (fftSize=64)
  → getByteFrequencyData() per frame
  → normalize [0-255] → [0-1]
  → VoiceAudioBridge.emit(frame)
  → AuraVoiceVisualizer.frequencyBands

Phase 3 TTS path:
  TTS audio buffer
  → AudioBufferSourceNode
  → AnalyserNode (same pipeline)
  → VoiceAudioBridge.emit(frame)
  → AuraVoiceVisualizer.frequencyBands
    (source='tts-output' → indigo color accent)

The visualizer component requires NO changes — it accepts real frequencyBands
externally if provided, otherwise falls back to useMockAudioReactivity.
`.trim();
  }
}

export const voiceAudioBridge = new VoiceAudioBridge();

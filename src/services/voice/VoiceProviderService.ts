/**
 * VoiceProviderService — AURA Milestone H
 *
 * Configuration and status layer for STT/TTS providers.
 * No real audio, no microphone access, no API calls.
 *
 * This service prepares the foundation for Phase 3 voice integration:
 * - Tracks configured STT/TTS providers
 * - Validates provider availability
 * - Produces dry-run descriptions of voice pipeline operations
 * - Documents the audio → visualizer bridge for future real audio
 *
 * NEVER: request microphone permission, call TTS APIs, play audio
 */

import type {
  STTProviderType,
  TTSProviderType,
  VoiceProviderStatus,
  VoiceProviderHealth,
  VoiceSynthesisRequest,
  VoiceTranscriptionRequest,
} from '../../types/voice-provider';

// ─── Env var mapping ──────────────────────────────────────────────────────────

const STT_KEY_MAP: Partial<Record<STTProviderType, string | undefined>> = {
  'openai-whisper':  'VITE_OPENAI_API_KEY',
  'openai-realtime': 'VITE_OPENAI_REALTIME_KEY',
  'browser-speech-api': undefined, // No key needed
};

const TTS_KEY_MAP: Partial<Record<TTSProviderType, string | undefined>> = {
  'openai-tts':          'VITE_OPENAI_API_KEY',
  'elevenlabs':          'VITE_ELEVENLABS_API_KEY',
  'browser-speech-synth': undefined, // No key needed
};

// ─── Service ──────────────────────────────────────────────────────────────────

class VoiceProviderService {
  private preferredSTT: STTProviderType = 'none';
  private preferredTTS: TTSProviderType = 'none';

  // ── Key presence check (never reads value) ────────────────────────────────

  private hasKey(envVar: string | null | undefined): boolean {
    if (!envVar) return false;
    return Boolean((import.meta.env as Record<string, unknown>)[envVar]);
  }

  // ── Provider status ───────────────────────────────────────────────────────

  getSTTStatus(provider: STTProviderType): VoiceProviderStatus {
    if (provider === 'none') return 'disabled';
    if (provider === 'browser-speech-api') return 'planned'; // Not yet implemented
    const keyVar = STT_KEY_MAP[provider];
    if (!keyVar) return 'no_key_needed';
    return this.hasKey(keyVar) ? 'configured' : 'missing_key';
  }

  getTTSStatus(provider: TTSProviderType): VoiceProviderStatus {
    if (provider === 'none') return 'disabled';
    if (provider === 'browser-speech-synth') return 'planned'; // Not yet enabled
    const keyVar = TTS_KEY_MAP[provider];
    if (!keyVar) return 'no_key_needed';
    return this.hasKey(keyVar) ? 'configured' : 'missing_key';
  }

  listSTTProviders(): Array<{ provider: STTProviderType; status: VoiceProviderStatus; keyEnvVar: string | null }> {
    const providers: STTProviderType[] = ['openai-whisper', 'openai-realtime', 'browser-speech-api'];
    return providers.map(p => ({
      provider: p,
      status: this.getSTTStatus(p),
      keyEnvVar: STT_KEY_MAP[p] ?? null,
    }));
  }

  listTTSProviders(): Array<{ provider: TTSProviderType; status: VoiceProviderStatus; keyEnvVar: string | null }> {
    const providers: TTSProviderType[] = ['openai-tts', 'elevenlabs', 'browser-speech-synth'];
    return providers.map(p => ({
      provider: p,
      status: this.getTTSStatus(p),
      keyEnvVar: TTS_KEY_MAP[p] ?? null,
    }));
  }

  getVoiceProviderHealth(): VoiceProviderHealth {
    const bestSTT = this.getBestSTTProvider();
    const bestTTS = this.getBestTTSProvider();

    return {
      stt: {
        provider: bestSTT,
        status: this.getSTTStatus(bestSTT),
        keyEnvVar: STT_KEY_MAP[bestSTT] ?? null,
        hasKey: this.hasKey(STT_KEY_MAP[bestSTT]),
        notes: bestSTT === 'none'
          ? 'No STT provider configured. Set VITE_OPENAI_API_KEY for Whisper.'
          : `Using ${bestSTT}.`,
      },
      tts: {
        provider: bestTTS,
        status: this.getTTSStatus(bestTTS),
        keyEnvVar: TTS_KEY_MAP[bestTTS] ?? null,
        hasKey: this.hasKey(TTS_KEY_MAP[bestTTS]),
        notes: bestTTS === 'none'
          ? 'No TTS provider configured. Set VITE_OPENAI_API_KEY or VITE_ELEVENLABS_API_KEY.'
          : `Using ${bestTTS}.`,
      },
      realtimeAvailable: this.hasKey('VITE_OPENAI_REALTIME_KEY'),
      micPermissionRequested: false, // Never true until Phase 3
    };
  }

  // ── Dry-run descriptions ──────────────────────────────────────────────────

  /**
   * Dry-run TTS: describes what would happen without synthesising audio.
   * No API call, no audio output.
   */
  createTTSRequestPlaceholder(data: Omit<VoiceSynthesisRequest, 'dryRun'>): VoiceSynthesisRequest {
    return { ...data, dryRun: true };
  }

  describeTTSDryRun(req: VoiceSynthesisRequest): string {
    const status = this.getTTSStatus(req.provider);
    if (req.provider === 'none') return 'TTS disabled — no output.';
    if (status === 'missing_key') {
      return `[DRY RUN] ${req.provider} TTS would fail — API key not configured. Text: "${req.text.slice(0, 50)}..."`;
    }
    return `[DRY RUN] ${req.provider} TTS would synthesise: "${req.text.slice(0, 50)}..." at speed ${req.speed ?? 1.0}`;
  }

  /**
   * Dry-run STT: describes what would happen without capturing audio.
   * No microphone permission requested.
   */
  createSTTRequestPlaceholder(data: Omit<VoiceTranscriptionRequest, 'dryRun'>): VoiceTranscriptionRequest {
    return { ...data, dryRun: true };
  }

  describeSTTDryRun(req: VoiceTranscriptionRequest): string {
    if (req.provider === 'none') return 'STT disabled — no transcription.';
    if (req.provider === 'browser-speech-api') {
      return '[DRY RUN] Browser SpeechRecognition would listen — microphone permission not yet requested.';
    }
    const status = this.getSTTStatus(req.provider);
    if (status === 'missing_key') {
      return `[DRY RUN] ${req.provider} STT would fail — API key not configured.`;
    }
    return `[DRY RUN] ${req.provider} STT would transcribe audio${req.audioDescription ? ': ' + req.audioDescription : ''}.`;
  }

  // ── Visualizer bridge documentation ──────────────────────────────────────

  /**
   * Returns a description of how real audio frames will connect to the visualizer.
   * Phase 3 implementation notes.
   */
  connectVisualizerToAudioFrame(): string {
    return `
Voice → Visualizer Bridge (Phase 3 implementation plan):

STT Path:
  navigator.mediaDevices.getUserMedia({ audio: true })
  → MediaStream → AudioContext.createMediaStreamSource()
  → AnalyserNode (fftSize=64, smoothingTimeConstant=0.8)
  → analyser.getByteFrequencyData(dataArray) [each frame]
  → Array.from(dataArray).map(v => v / 255)  [normalize 0-1]
  → AuraVoiceVisualizer.frequencyBands prop
  → useMockAudioReactivity is bypassed when real frequencyBands provided

TTS Path:
  TTS provider → AudioBuffer → AudioBufferSourceNode
  → AnalyserNode (same pipeline as above)
  → frequencyBands → AuraVoiceVisualizer

No microphone permission is requested until Phase 3.
useMockAudioReactivity continues to drive the visualizer in all current phases.
`.trim();
  }

  dryRunVoicePipeline(): string {
    const health = this.getVoiceProviderHealth();
    const lines = [
      `Voice Pipeline Dry-Run (${new Date().toLocaleTimeString()})`,
      `STT: ${health.stt.provider} — ${health.stt.status}`,
      `TTS: ${health.tts.provider} — ${health.tts.status}`,
      `Realtime: ${health.realtimeAvailable ? 'key configured' : 'key missing'}`,
      `Microphone: NOT requested (Phase 3)`,
      health.stt.status === 'missing_key' ? `  → Add ${health.stt.keyEnvVar} to .env to enable STT` : '',
      health.tts.status === 'missing_key' ? `  → Add ${health.tts.keyEnvVar} to .env to enable TTS` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }

  // ── Preferred provider selection ──────────────────────────────────────────

  private getBestSTTProvider(): STTProviderType {
    if (this.preferredSTT !== 'none') return this.preferredSTT;
    if (this.hasKey('VITE_OPENAI_API_KEY')) return 'openai-whisper';
    if (this.hasKey('VITE_OPENAI_REALTIME_KEY')) return 'openai-realtime';
    return 'none';
  }

  private getBestTTSProvider(): TTSProviderType {
    if (this.preferredTTS !== 'none') return this.preferredTTS;
    if (this.hasKey('VITE_ELEVENLABS_API_KEY')) return 'elevenlabs';
    if (this.hasKey('VITE_OPENAI_API_KEY')) return 'openai-tts';
    return 'none';
  }

  setPreferredSTT(provider: STTProviderType): void { this.preferredSTT = provider; }
  setPreferredTTS(provider: TTSProviderType): void { this.preferredTTS = provider; }
}

export const voiceProviderService = new VoiceProviderService();

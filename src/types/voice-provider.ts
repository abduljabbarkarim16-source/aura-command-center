/**
 * AURA Voice Provider Types — Milestone H
 *
 * Defines the type vocabulary for STT/TTS provider integration.
 * No real microphone, no real API calls. All types are stubs for Phase 3.
 *
 * Audio flow (Phase 3):
 * Mic → STT Provider → transcript → AURA → response text → TTS Provider → audio → speaker
 *
 * Visualizer bridge:
 * TTS audio stream → WebAudio analyser → frequencyBands → AuraVoiceVisualizer
 */

// ─── Provider identifiers ─────────────────────────────────────────────────────

export type STTProviderType =
  | 'openai-whisper'        // OpenAI Whisper (requires VITE_OPENAI_API_KEY)
  | 'openai-realtime'       // OpenAI Realtime API (requires VITE_OPENAI_REALTIME_KEY)
  | 'browser-speech-api'   // Web SpeechRecognition (built-in, no key, no permission yet)
  | 'none';                 // Disabled

export type TTSProviderType =
  | 'openai-tts'            // OpenAI TTS (requires VITE_OPENAI_API_KEY)
  | 'elevenlabs'            // ElevenLabs (requires VITE_ELEVENLABS_API_KEY)
  | 'browser-speech-synth' // Web speechSynthesis (built-in, no key)
  | 'none';                 // Disabled

// ─── Status ───────────────────────────────────────────────────────────────────

export type VoiceProviderStatus =
  | 'configured'    // Key present and provider enabled
  | 'missing_key'   // Env var known but value absent
  | 'no_key_needed' // Browser built-in
  | 'planned'       // Not yet implemented
  | 'disabled';     // Explicitly off

// ─── Quality tiers ────────────────────────────────────────────────────────────

export type VoiceQualityTier = 'low' | 'medium' | 'high' | 'ultra';

// ─── Requests and events (shape only — no real execution) ─────────────────────

export interface VoiceSynthesisRequest {
  text: string;
  provider: TTSProviderType;
  voice?: string;       // Provider-specific voice name
  speed?: number;       // 0.5–2.0
  quality?: VoiceQualityTier;
  /** DRY RUN: if true, describe what would happen without synthesising */
  dryRun: boolean;
}

export interface VoiceTranscriptionRequest {
  provider: STTProviderType;
  /** DRY RUN: describes expected input, no actual audio captured */
  audioDescription?: string;
  language?: string;
  dryRun: boolean;
}

export interface VoiceAudioEvent {
  id: string;
  type: 'tts_started' | 'tts_ended' | 'stt_started' | 'stt_result' | 'stt_ended' | 'error';
  timestamp: number;
  provider: STTProviderType | TTSProviderType;
  /** Audio frame data — only populated when real audio bridge is active (Phase 3) */
  frequencyBands?: number[];
  amplitude?: number;
  transcript?: string;
  error?: string;
}

// ─── Provider health ──────────────────────────────────────────────────────────

export interface VoiceProviderHealth {
  stt: {
    provider: STTProviderType;
    status: VoiceProviderStatus;
    keyEnvVar: string | null;
    hasKey: boolean;
    notes: string;
  };
  tts: {
    provider: TTSProviderType;
    status: VoiceProviderStatus;
    keyEnvVar: string | null;
    hasKey: boolean;
    notes: string;
  };
  realtimeAvailable: boolean;
  micPermissionRequested: boolean;  // Always false until Phase 3
}

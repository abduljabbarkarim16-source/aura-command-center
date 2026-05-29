/**
 * voice-session.ts — AURA Phase 3B
 *
 * Type vocabulary for voice session management.
 * Supports: OpenAI STT/TTS (request-based), OpenAI Realtime (future WebRTC),
 *            ElevenLabs TTS (optional), browser fallback, and local mock mode.
 *
 * Security invariants:
 * - API keys are never stored here — only presence flags and session tokens
 * - Session tokens are ephemeral and scoped to a single voice turn
 * - No audio data is ever stored in these types
 */

// ─── Session mode ─────────────────────────────────────────────────────────────

export type VoiceSessionMode =
  | 'mock'           // No real API, local simulation
  | 'request_based'  // STT via Whisper, TTS via OpenAI/ElevenLabs — per-request
  | 'realtime'       // Full-duplex WebRTC (OpenAI Realtime API — future)
  | 'locked';        // Requires approval before any voice call

export type VoiceSessionStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'transcribing'
  | 'generating_response'
  | 'playing_audio'
  | 'error'
  | 'locked';

// ─── Provider config (no key values) ─────────────────────────────────────────

export type VoiceSTTProvider =
  | 'openai-whisper'   // POST to /v1/audio/transcriptions — uses VITE_OPENAI_API_KEY
  | 'openai-realtime'  // WebRTC session — uses ephemeral client secret
  | 'browser-speech'   // SpeechRecognition API — no key
  | 'mock';

export type VoiceTTSProvider =
  | 'openai-tts'       // POST to /v1/audio/speech — uses VITE_OPENAI_API_KEY
  | 'elevenlabs'       // ElevenLabs API — uses VITE_ELEVENLABS_API_KEY
  | 'browser-synth'    // speechSynthesis — no key
  | 'mock';

export interface VoiceProviderConfig {
  stt: VoiceSTTProvider;
  tts: VoiceTTSProvider;
  /** True if provider has a key configured */
  sttReady: boolean;
  ttsReady: boolean;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface VoiceSession {
  id: string;
  mode: VoiceSessionMode;
  status: VoiceSessionStatus;
  providerConfig: VoiceProviderConfig;
  /** Ephemeral client secret for Realtime sessions — never persisted */
  ephemeralToken?: string;
  createdAt: string;
  lastActivity: string;
  error?: string;
}

// ─── Transcript events ────────────────────────────────────────────────────────

export type VoiceTranscriptEventType =
  | 'admin_speech_started'
  | 'admin_transcript_partial'
  | 'admin_transcript_final'
  | 'aura_response_started'
  | 'aura_response_audio_started'
  | 'aura_response_audio_completed'
  | 'voice_error';

export interface VoiceTranscriptEvent {
  id: string;
  sessionId: string;
  type: VoiceTranscriptEventType;
  timestamp: string;
  /** Sanitised transcript text — no secrets */
  text?: string;
  /** Partial or final */
  isFinal?: boolean;
  /** Duration of audio in ms, if known */
  audioDurationMs?: number;
  error?: string;
}

// ─── Readiness snapshot ───────────────────────────────────────────────────────

export interface VoiceReadinessSnapshot {
  mode: VoiceSessionMode;
  openaiKeyPresent: boolean;
  elevenLabsKeyPresent: boolean;
  sttProvider: VoiceSTTProvider;
  ttsProvider: VoiceTTSProvider;
  sttReady: boolean;
  ttsReady: boolean;
  realtimeReady: boolean;       // Requires separate realtime key or session service
  microphonePermission: 'pending' | 'granted' | 'denied' | 'not_requested';
  liveVoiceLocked: boolean;     // Stays true until explicit approval gate is passed
  notes: string[];
}

// ─── OpenAI session create request/response ───────────────────────────────────

export interface OpenAIRealtimeSessionRequest {
  model: string;
  voice?: 'alloy' | 'echo' | 'shimmer' | 'ash' | 'ballad' | 'coral' | 'sage' | 'verse';
  instructions?: string;
}

export interface OpenAIRealtimeSessionResponse {
  id: string;
  object: 'realtime.session';
  model: string;
  client_secret: {
    value: string;   // Ephemeral — use once, never store
    expires_at: number;
  };
}

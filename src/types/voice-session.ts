/**
 * voice-session.ts — AURA Phase 3D
 *
 * Type vocabulary for voice session management.
 * Phase 3D adds VAD-lite, barge-in, wake phrase, and response style settings.
 *
 * Security invariants:
 * - API keys are never stored here
 * - Transcripts are stored in memory only; never contain secrets
 * - No audio data is ever stored in these types
 */

// ─── Session mode ─────────────────────────────────────────────────────────────

export type VoiceSessionMode =
  | 'mock'           // No real API, local simulation
  | 'request_based'  // STT/TTS via OpenAI per-request — Phase 3C active mode
  | 'realtime'       // Full-duplex WebRTC (OpenAI Realtime — future)
  | 'locked';        // Requires approval before any voice call

export type VoiceSessionStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'responding'
  | 'speaking'
  | 'error'
  | 'locked';

// ─── Recording state ──────────────────────────────────────────────────────────

export type MicPermission = 'not_requested' | 'pending' | 'granted' | 'denied' | 'unsupported';

export interface VoiceRecordingState {
  isRecording: boolean;
  durationMs: number;
  micPermission: MicPermission;
  error?: string;
}

// ─── Provider config ──────────────────────────────────────────────────────────

export type VoiceSTTProvider =
  | 'openai-whisper'   // POST to /v1/audio/transcriptions — via Tauri backend
  | 'openai-realtime'  // WebRTC session — future
  | 'browser-speech'   // SpeechRecognition API — no key
  | 'mock';

export type VoiceTTSProvider =
  | 'openai-tts'       // POST to /v1/audio/speech — via Tauri backend
  | 'elevenlabs'       // ElevenLabs — optional
  | 'browser-synth'    // speechSynthesis — no key
  | 'mock';

export interface VoiceProviderConfig {
  stt: VoiceSTTProvider;
  tts: VoiceTTSProvider;
  sttReady: boolean;
  ttsReady: boolean;
}

// ─── Conversation turn ────────────────────────────────────────────────────────

export interface VoiceConversationTurn {
  id: string;
  userText: string;
  auraText: string;
  timestamp: string;
  sttLatencyMs?: number;
  chatLatencyMs?: number;
  ttsLatencyMs?: number;
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface VoiceTranscriptionResult {
  success: boolean;
  text?: string;
  latencyMs?: number;
  error?: string;
}

export interface VoiceChatResult {
  success: boolean;
  text?: string;
  latencyMs?: number;
  error?: string;
}

export interface VoiceSpeechResult {
  success: boolean;
  audioBlobUrl?: string;  // Object URL — caller revokes after playback
  audioBytes?: ArrayBuffer; // Raw MP3 bytes — used by Web Audio API decoder to skip fetch round-trip
  latencyMs?: number;
  error?: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface VoiceConversationSettings {
  enabled: boolean;
  maxRecordingDurationMs: number;   // default 30_000 (Phase 3D: raised from 15s)
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  persistTranscripts: boolean;      // default false
  // Phase 3D additions
  autoStopEnabled: boolean;         // VAD-lite auto-stop on silence, default true
  silenceThresholdMs: number;       // ms of silence before auto-stop, default 1200
  interruptEnabled: boolean;        // allow barge-in while AURA is speaking, default true
  wakePhrase: boolean;              // continuous wake phrase listening, default false
  responseStyle: 'brief' | 'normal' | 'detailed';  // controls AURA response length, default 'normal'
  // Phase 3E QA3 additions — segmented voice session
  segmentLengthMs?: number;   // rolling segment size, default 8000
  maxThoughtMs?: number;      // max full thought duration, default 90000
  cleanupEnabled?: boolean;   // apply filler/vocab cleanup per segment, default true
  removeFillerWords?: boolean; // subset of cleanup: remove um/uh/etc, default true
  // Phase 3F additions — fast response
  fastResponseMode?: boolean;  // generate 1-sentence reply first, then full, default false
  sentenceFirstTTS?: boolean;  // start TTS after first sentence, default true
  fastAcknowledgementEnabled?: boolean; // show instant visual ack when speech captured, default true
  autoMemoryEnabled?: boolean; // auto-save extracted long-term memories after turns, default false
  // Phase 3H — tool dispatch
  toolDispatchEnabled?: boolean; // AURA calls approved tools autonomously, default true
}

export const DEFAULT_VOICE_SETTINGS: VoiceConversationSettings = {
  enabled: true,
  maxRecordingDurationMs: 30_000,
  ttsVoice: 'alloy',
  persistTranscripts: false,
  // Phase 3D
  autoStopEnabled: true,
  silenceThresholdMs: 1200,
  interruptEnabled: true,
  wakePhrase: false,
  responseStyle: 'normal',
  // Phase 3E QA3
  segmentLengthMs: 8_000,
  maxThoughtMs: 90_000,
  cleanupEnabled: true,
  removeFillerWords: true,
  // Phase 3F
  fastResponseMode: false,
  sentenceFirstTTS: true,
  fastAcknowledgementEnabled: true,
  autoMemoryEnabled: false,
  // Phase 3H
  toolDispatchEnabled: true,
};

// ─── Session ──────────────────────────────────────────────────────────────────

export interface VoiceSession {
  id: string;
  mode: VoiceSessionMode;
  status: VoiceSessionStatus;
  providerConfig: VoiceProviderConfig;
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
  text?: string;
  isFinal?: boolean;
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
  realtimeReady: boolean;
  microphonePermission: MicPermission;
  liveVoiceLocked: boolean;
  notes: string[];
}

// ─── OpenAI Realtime (future) ─────────────────────────────────────────────────

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
    value: string;
    expires_at: number;
  };
}

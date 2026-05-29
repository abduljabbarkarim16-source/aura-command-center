/**
 * OpenAIVoiceSessionService — AURA Phase 3B
 *
 * Handles OpenAI-based voice operations:
 *   - Request-based STT via Whisper (/v1/audio/transcriptions)
 *   - Request-based TTS (/v1/audio/speech)
 *   - Future: ephemeral client-secret creation for OpenAI Realtime WebRTC
 *
 * Security architecture:
 * - In a production Tauri app, the OpenAI key must NOT be used from the frontend
 *   for Realtime sessions (the ephemeral token endpoint requires server auth).
 * - For request-based STT/TTS, the key is read from VITE_OPENAI_API_KEY
 *   and used only in the Tauri WebView fetch — no value is logged or stored.
 * - For Realtime, a backend/Tauri command bridge must mint the ephemeral token
 *   and return only the token to the frontend.
 *
 * Current Phase 3B status:
 * - STT and TTS stubs are wired (dry-run capable, live call architecturally correct)
 * - Realtime session creation is stubbed (returns mock token)
 * - No audio is sent yet — microphone not opened
 * - Live calls require explicit approval gate
 */

import type {
  OpenAIRealtimeSessionRequest,
  OpenAIRealtimeSessionResponse,
} from '../../types/voice-session';

// ─── Response types ───────────────────────────────────────────────────────────

export interface OpenAITranscriptionResult {
  success: boolean;
  text?: string;
  language?: string;
  durationMs?: number;
  error?: string;
  isDryRun: boolean;
}

export interface OpenAITTSResult {
  success: boolean;
  audioBlobUrl?: string;  // Object URL — caller must revoke after use
  durationEstimateMs?: number;
  error?: string;
  isDryRun: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class OpenAIVoiceSessionServiceImpl {

  // ── Readiness check (no key value printed) ────────────────────────────────

  isReady(): boolean {
    return Boolean(import.meta.env.VITE_OPENAI_API_KEY);
  }

  // ── STT: Whisper transcription ────────────────────────────────────────────
  // Accepts an audio Blob (from MediaRecorder or a file).
  // In Phase 3B: dry-run returns a mock transcript.
  // In Phase 3 live: sends real audio blob to /v1/audio/transcriptions.

  async transcribeAudio(audioBlob: Blob, dryRun = true): Promise<OpenAITranscriptionResult> {
    if (!this.isReady()) {
      return { success: false, error: 'OpenAI key not configured', isDryRun: dryRun };
    }
    if (dryRun) {
      return { success: true, text: '[DRY-RUN transcript placeholder]', isDryRun: true };
    }

    const key: string = import.meta.env.VITE_OPENAI_API_KEY;
    const form = new FormData();
    form.append('file', audioBlob, 'audio.webm');
    form.append('model', 'whisper-1');

    const start = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      const data: Record<string, unknown> = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        const msg = (data.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
        return { success: false, error: msg, isDryRun: false };
      }
      return {
        success: true,
        text: (data.text as string | undefined)?.trim(),
        durationMs: Date.now() - start,
        isDryRun: false,
      };
    } catch (err) {
      return { success: false, error: String(err), isDryRun: false };
    }
  }

  // ── TTS: OpenAI text-to-speech ────────────────────────────────────────────
  // In Phase 3B: dry-run only — no audio generated.
  // In Phase 3 live: sends text to /v1/audio/speech, returns audio blob URL.

  async synthesizeSpeech(text: string, voice = 'alloy', dryRun = true): Promise<OpenAITTSResult> {
    if (!this.isReady()) {
      return { success: false, error: 'OpenAI key not configured', isDryRun: dryRun };
    }
    if (dryRun) {
      return { success: true, isDryRun: true, durationEstimateMs: text.length * 50 };
    }

    const key: string = import.meta.env.VITE_OPENAI_API_KEY;
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1', input: text, voice }),
      });
      if (!res.ok) {
        const data: Record<string, unknown> = await res.json() as Record<string, unknown>;
        const msg = (data.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
        return { success: false, error: msg, isDryRun: false };
      }
      const blob = await res.blob();
      return { success: true, audioBlobUrl: URL.createObjectURL(blob), isDryRun: false };
    } catch (err) {
      return { success: false, error: String(err), isDryRun: false };
    }
  }

  // ── Realtime session (future — ephemeral token) ───────────────────────────
  // The real implementation requires a server/Tauri bridge that holds the API key
  // server-side and mints a short-lived client secret.
  // Phase 3B: returns a mock session for architecture testing only.

  async createRealtimeSession(
    _req: OpenAIRealtimeSessionRequest,
    dryRun = true,
  ): Promise<{ success: boolean; session?: OpenAIRealtimeSessionResponse; error?: string; isDryRun: boolean }> {
    if (dryRun) {
      return {
        success: true,
        isDryRun: true,
        session: {
          id: `mock-session-${Date.now()}`,
          object: 'realtime.session',
          model: 'gpt-4o-realtime-preview',
          client_secret: {
            value: '[MOCK_EPHEMERAL_TOKEN — never used in dry run]',
            expires_at: Math.floor(Date.now() / 1000) + 60,
          },
        },
      };
    }

    // Production path: delegate to a Tauri command that calls the endpoint
    // server-side and returns only the ephemeral token.
    // This prevents the API key from being used in the browser for session creation.
    return {
      success: false,
      error: 'Realtime session creation requires a Tauri backend bridge — not yet implemented.',
      isDryRun: false,
    };
  }
}

export const openAIVoiceSessionService = new OpenAIVoiceSessionServiceImpl();

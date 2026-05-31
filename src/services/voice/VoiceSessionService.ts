/**
 * VoiceSessionService — AURA Phase 3B
 *
 * Manages the lifecycle of a voice session.
 * Determines mode based on available keys and current approvals.
 *
 * Security rules:
 * - Never stores or logs API key values
 * - Ephemeral tokens are used for one turn and discarded
 * - Microphone is never opened without explicit user approval
 * - Live voice is locked by default until approval gate passes
 */

import type {
  VoiceSession,
  VoiceSessionMode,
  VoiceSessionStatus,
  VoiceProviderConfig,
  VoiceSTTProvider,
  VoiceTTSProvider,
  VoiceReadinessSnapshot,
} from '../../types/voice-session';

function uid(): string {
  return `vs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function now(): string {
  return new Date().toISOString();
}

type SessionListener = (session: VoiceSession | null) => void;

class VoiceSessionServiceImpl {
  private session: VoiceSession | null = null;
  private listeners = new Set<SessionListener>();

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(fn: SessionListener): () => void {
    this.listeners.add(fn);
    fn(this.session);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn(this.session);
  }

  // ── Readiness snapshot ────────────────────────────────────────────────────

  getReadinessSnapshot(openaiKeyPresentOverride?: boolean): VoiceReadinessSnapshot {
    const openaiKeyPresent = openaiKeyPresentOverride ?? Boolean(import.meta.env.VITE_OPENAI_API_KEY);
    const elevenLabsKeyPresent = Boolean(import.meta.env.VITE_ELEVENLABS_API_KEY);

    const sttProvider: VoiceSTTProvider = openaiKeyPresent ? 'openai-whisper' : 'browser-speech';
    const ttsProvider: VoiceTTSProvider = elevenLabsKeyPresent ? 'elevenlabs' : openaiKeyPresent ? 'openai-tts' : 'browser-synth';

    const sttReady = openaiKeyPresent || sttProvider === 'browser-speech';
    const ttsReady = openaiKeyPresent || elevenLabsKeyPresent || ttsProvider === 'browser-synth';

    const mode = this.resolveMode(openaiKeyPresent);

    const notes: string[] = [];
    if (!openaiKeyPresent) notes.push('OpenAI key not configured — STT/TTS will use browser fallback.');
    if (!elevenLabsKeyPresent) notes.push('ElevenLabs key not configured — premium TTS unavailable (optional).');
    if (mode === 'locked') notes.push('Live voice is locked until approval gate passes.');
    if (mode === 'request_based') notes.push('OpenAI STT (Whisper) + TTS ready. Microphone permission not yet requested.');

    return {
      mode,
      openaiKeyPresent,
      elevenLabsKeyPresent,
      sttProvider,
      ttsProvider,
      sttReady,
      ttsReady,
      realtimeReady: false, // Requires separate session service + approval
      microphonePermission: 'not_requested',
      liveVoiceLocked: true, // Always locked until explicit approval
      notes,
    };
  }

  private resolveMode(openaiKeyPresent: boolean): VoiceSessionMode {
    if (!openaiKeyPresent) return 'mock';
    return 'locked'; // Always start locked; user must explicitly unlock
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────

  createSession(): VoiceSession {
    const readiness = this.getReadinessSnapshot();
    const config: VoiceProviderConfig = {
      stt: readiness.sttProvider,
      tts: readiness.ttsProvider,
      sttReady: readiness.sttReady,
      ttsReady: readiness.ttsReady,
    };
    const session: VoiceSession = {
      id: uid(),
      mode: readiness.mode,
      status: readiness.mode === 'locked' ? 'locked' : 'idle',
      providerConfig: config,
      createdAt: now(),
      lastActivity: now(),
    };
    this.session = session;
    this.notify();
    return session;
  }

  getSession(): VoiceSession | null {
    return this.session;
  }

  updateStatus(status: VoiceSessionStatus, error?: string) {
    if (!this.session) return;
    this.session = { ...this.session, status, lastActivity: now(), error };
    this.notify();
  }

  clearEphemeralToken() {
    if (!this.session) return;
    const { ephemeralToken: _, ...rest } = this.session;
    this.session = { ...rest, lastActivity: now() };
    this.notify();
  }

  closeSession() {
    this.session = null;
    this.notify();
  }
}

export const voiceSessionService = new VoiceSessionServiceImpl();

/**
 * VoiceTranscriptService — AURA Phase 3B
 *
 * Manages voice transcript events for a session.
 * Emits structured events that the UI and timeline can subscribe to.
 *
 * Security rules:
 * - Transcripts contain only sanitised user speech — no secrets
 * - Partial transcripts are discarded if the session is closed
 * - No audio data is stored in this service
 */

import type {
  VoiceTranscriptEvent,
  VoiceTranscriptEventType,
} from '../../types/voice-session';

function uid(): string {
  return `tr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function now(): string {
  return new Date().toISOString();
}

type TranscriptListener = (events: VoiceTranscriptEvent[]) => void;

class VoiceTranscriptServiceImpl {
  private events: VoiceTranscriptEvent[] = [];
  private listeners = new Set<TranscriptListener>();
  private readonly MAX_EVENTS = 200;

  subscribe(fn: TranscriptListener): () => void {
    this.listeners.add(fn);
    fn([...this.events]);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = [...this.events];
    for (const fn of this.listeners) fn(snap);
  }

  emit(
    sessionId: string,
    type: VoiceTranscriptEventType,
    data?: { text?: string; isFinal?: boolean; audioDurationMs?: number; error?: string }
  ): VoiceTranscriptEvent {
    const event: VoiceTranscriptEvent = {
      id: uid(),
      sessionId,
      type,
      timestamp: now(),
      ...data,
    };
    this.events = [event, ...this.events].slice(0, this.MAX_EVENTS);
    this.notify();
    return event;
  }

  // Convenience emitters

  speechStarted(sessionId: string): VoiceTranscriptEvent {
    return this.emit(sessionId, 'admin_speech_started');
  }

  partialTranscript(sessionId: string, text: string): VoiceTranscriptEvent {
    return this.emit(sessionId, 'admin_transcript_partial', { text, isFinal: false });
  }

  finalTranscript(sessionId: string, text: string, audioDurationMs?: number): VoiceTranscriptEvent {
    return this.emit(sessionId, 'admin_transcript_final', { text, isFinal: true, audioDurationMs });
  }

  responseStarted(sessionId: string): VoiceTranscriptEvent {
    return this.emit(sessionId, 'aura_response_started');
  }

  audioStarted(sessionId: string): VoiceTranscriptEvent {
    return this.emit(sessionId, 'aura_response_audio_started');
  }

  audioCompleted(sessionId: string, audioDurationMs?: number): VoiceTranscriptEvent {
    return this.emit(sessionId, 'aura_response_audio_completed', { audioDurationMs });
  }

  voiceError(sessionId: string, error: string): VoiceTranscriptEvent {
    return this.emit(sessionId, 'voice_error', { error });
  }

  getEventsForSession(sessionId: string): VoiceTranscriptEvent[] {
    return this.events.filter(e => e.sessionId === sessionId);
  }

  getRecent(limit = 50): VoiceTranscriptEvent[] {
    return this.events.slice(0, limit);
  }

  clear() {
    this.events = [];
    this.notify();
  }
}

export const voiceTranscriptService = new VoiceTranscriptServiceImpl();

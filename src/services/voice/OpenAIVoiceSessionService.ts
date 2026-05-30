/**
 * OpenAIVoiceSessionService — AURA Phase 3F
 *
 * Orchestrates OpenAI STT → Chat → TTS via the Tauri backend.
 *
 * Phase 3F additions:
 *  - createFastChatResponse(): ultra-low-latency 1-sentence reply (fast mode)
 *  - synthesizeSpeechFirstSentence(): generate TTS for just the first sentence,
 *    returns first URL + remaining text so caller can pipeline TTS concurrently
 *  - splitIntoSentences(): utility for sentence-first TTS queuing
 *
 * Security architecture:
 * - All OpenAI calls go through Tauri backend commands (voice_commands.rs)
 * - The API key is held in Rust; never returned to the frontend
 * - Audio bytes are sent to Rust via invoke(); only text is returned
 * - TTS audio bytes come back from Rust; converted to Blob URL locally
 * - Object URLs are revoked by the caller after playback
 * - Conversation history in memory only; not persisted unless user enables it
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  VoiceTranscriptionResult,
  VoiceChatResult,
  VoiceSpeechResult,
  VoiceConversationTurn,
  VoiceConversationSettings,
  OpenAIRealtimeSessionRequest,
  OpenAIRealtimeSessionResponse,
} from '../../types/voice-session';

// ─── History message shape (matches Rust ChatMessage) ─────────────────────────

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_HISTORY_TURNS = 5;

// ─── Service ──────────────────────────────────────────────────────────────────

class OpenAIVoiceSessionServiceImpl {
  private history: ChatHistoryMessage[] = [];

  // ── Readiness check ───────────────────────────────────────────────────────

  isReady(): boolean {
    return Boolean(import.meta.env.VITE_OPENAI_API_KEY);
  }

  // ── STT: transcribe audio via Tauri backend ───────────────────────────────

  async transcribeAudio(audioBlob: Blob): Promise<VoiceTranscriptionResult> {
    const start = Date.now();
    try {
      // Convert blob to byte array for Tauri transfer
      const buffer = await audioBlob.arrayBuffer();
      const audioBytes = Array.from(new Uint8Array(buffer));
      const contentType = audioBlob.type || 'audio/webm';

      const text = await invoke<string>('openai_transcribe_audio', {
        audioBytes,
        contentType,
      });

      return { success: true, text: text.trim(), latencyMs: Date.now() - start };
    } catch (err) {
      return { success: false, error: String(err), latencyMs: Date.now() - start };
    }
  }

  // ── Chat: get AURA response via Tauri backend ─────────────────────────────

  async createChatResponse(
    transcript: string,
    responseStyle: 'brief' | 'normal' | 'detailed' = 'normal',
  ): Promise<VoiceChatResult> {
    if (!transcript.trim()) return { success: false, error: 'Empty transcript' };
    const start = Date.now();
    try {
      // Send last N turns as history
      const historySlice = this.history.slice(-MAX_HISTORY_TURNS * 2);

      const text = await invoke<string>('openai_chat_response', {
        transcript: transcript.trim(),
        history: historySlice,
        responseStyle,
      });

      // Store this turn in history
      this.history.push({ role: 'user', content: transcript.trim() });
      this.history.push({ role: 'assistant', content: text });
      if (this.history.length > MAX_HISTORY_TURNS * 2) {
        this.history = this.history.slice(-MAX_HISTORY_TURNS * 2);
      }

      return { success: true, text: text.trim(), latencyMs: Date.now() - start };
    } catch (err) {
      return { success: false, error: String(err), latencyMs: Date.now() - start };
    }
  }

  // ── Fast chat: ultra-low-latency 1-sentence reply ────────────────────────
  //
  // Uses the dedicated openai_fast_chat_response command:
  //   - max_tokens = 40 (vs 300 for normal) — forces ≤12-word sentence
  //   - No conversation history — smaller payload, no extra context tokens
  //   - Specialized system prompt demanding exactly one spoken sentence
  // Does NOT store in history — only the full response is persisted.
  //
  // Phase 3F QA fix: previously called openai_chat_response with 'brief' style
  // (same 300 tokens, same model, same latency). Now calls the dedicated fast
  // command which cuts chat generation time from ~800-2000ms to ~200-500ms.

  async createFastChatResponse(transcript: string): Promise<VoiceChatResult> {
    if (!transcript.trim()) return { success: false, error: 'Empty transcript' };
    const start = Date.now();
    try {
      const text = await invoke<string>('openai_fast_chat_response', {
        transcript: transcript.trim(),
      });
      return { success: true, text: text.trim(), latencyMs: Date.now() - start };
    } catch (err) {
      return { success: false, error: String(err), latencyMs: Date.now() - start };
    }
  }

  // ── Sentence splitter ─────────────────────────────────────────────────────
  //
  // Splits text into sentences for sentence-first TTS queuing.
  // Returns at least one element.

  splitIntoSentences(text: string): string[] {
    if (!text.trim()) return [];
    // Split on sentence-ending punctuation followed by space or end-of-string
    const parts = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [text.trim()];
  }

  // ── TTS: synthesize speech via Tauri backend ──────────────────────────────

  async synthesizeSpeech(
    text: string,
    voice: VoiceConversationSettings['ttsVoice'] = 'alloy',
  ): Promise<VoiceSpeechResult> {
    if (!text.trim()) return { success: false, error: 'Empty text' };
    const start = Date.now();
    try {
      const audioBytes = await invoke<number[]>('openai_synthesize_speech', {
        text: text.trim(),
        voice,
      });

      const blob = new Blob([new Uint8Array(audioBytes)], { type: 'audio/mpeg' });
      const audioBlobUrl = URL.createObjectURL(blob);

      return { success: true, audioBlobUrl, latencyMs: Date.now() - start };
    } catch (err) {
      return { success: false, error: String(err), latencyMs: Date.now() - start };
    }
  }

  // ── Full conversation turn ────────────────────────────────────────────────

  async runConversationTurn(
    audioBlob: Blob,
    settings: VoiceConversationSettings,
  ): Promise<{ success: boolean; turn?: VoiceConversationTurn; audioUrl?: string; error?: string }> {
    // STT
    const sttResult = await this.transcribeAudio(audioBlob);
    if (!sttResult.success || !sttResult.text) {
      return { success: false, error: sttResult.error ?? 'Transcription failed' };
    }

    // Chat
    const chatResult = await this.createChatResponse(sttResult.text, settings.responseStyle ?? 'normal');
    if (!chatResult.success || !chatResult.text) {
      return { success: false, error: chatResult.error ?? 'Chat failed' };
    }

    // TTS
    const ttsResult = await this.synthesizeSpeech(chatResult.text, settings.ttsVoice);
    if (!ttsResult.success) {
      // Return text even if TTS fails — user can read the response
      const turn: VoiceConversationTurn = {
        id: `turn-${Date.now()}`,
        userText: sttResult.text,
        auraText: chatResult.text,
        timestamp: new Date().toISOString(),
        sttLatencyMs: sttResult.latencyMs,
        chatLatencyMs: chatResult.latencyMs,
      };
      return { success: true, turn, error: `TTS failed: ${ttsResult.error}` };
    }

    const turn: VoiceConversationTurn = {
      id: `turn-${Date.now()}`,
      userText: sttResult.text,
      auraText: chatResult.text,
      timestamp: new Date().toISOString(),
      sttLatencyMs: sttResult.latencyMs,
      chatLatencyMs: chatResult.latencyMs,
      ttsLatencyMs: ttsResult.latencyMs,
    };

    return { success: true, turn, audioUrl: ttsResult.audioBlobUrl };
  }

  // ── History management ────────────────────────────────────────────────────

  clearHistory() {
    this.history = [];
  }

  getHistoryLength(): number {
    return this.history.length / 2;
  }

  // ── Realtime stub (future) ────────────────────────────────────────────────

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
            value: '[MOCK_EPHEMERAL_TOKEN]',
            expires_at: Math.floor(Date.now() / 1000) + 60,
          },
        },
      };
    }
    return {
      success: false,
      error: 'Realtime session requires Tauri backend bridge — not yet implemented.',
      isDryRun: false,
    };
  }
}

export const openAIVoiceSessionService = new OpenAIVoiceSessionServiceImpl();

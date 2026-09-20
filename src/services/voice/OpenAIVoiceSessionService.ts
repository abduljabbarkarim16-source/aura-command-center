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
import type { MemoryExtractionResult } from '../../types/aura-memory';

// ─── History message shape (matches Rust ChatMessage) ─────────────────────────

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_HISTORY_TURNS = 5;

// ─── Transcription vocabulary hint ────────────────────────────────────────────
// Passed to Whisper as `prompt` so domain terms and the operator's name transcribe
// correctly (Whisper biases toward spellings it has just "seen" in the prompt).

// Project-domain vocabulary for Whisper biasing — no user names here.
// The saved name is appended dynamically at call time from UserProfileMemoryService.
const TRANSCRIPTION_VOCAB =
  'AURA, Claude, Codex, Antigravity, Tauri, Make.com, OpenAI, Whisper, Gemini, VAD, RuntimeTask, WebView2, ai-build-memory, agent-command-center';

/**
 * Peak amplitude (0..1) below which a capture is treated as containing no speech.
 *
 * Room tone and a quiet mic floor sit well under this; ordinary speech peaks far above
 * it. Deliberately permissive — the cost of letting marginal audio through is one API
 * call, whereas rejecting real speech loses the user's words.
 */
const SPEECH_PEAK_THRESHOLD = 0.035;

/**
 * Decode recorded audio and return its peak amplitude (0..1), or null if it cannot be
 * decoded. Returning null deliberately fails open: an undecodable buffer is still sent
 * for transcription rather than silently dropped.
 */
async function measurePeakLevel(buffer: ArrayBuffer): Promise<number | null> {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    try {
      const decoded = await ctx.decodeAudioData(buffer);
      let peak = 0;
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const data = decoded.getChannelData(ch);
        // Stride the samples: a peak survives sub-sampling and this keeps the check
        // cheap on long captures.
        for (let i = 0; i < data.length; i += 16) {
          const v = Math.abs(data[i]);
          if (v > peak) peak = v;
        }
      }
      return peak;
    } finally {
      try { await ctx.close(); } catch { /* ignore */ }
    }
  } catch {
    return null;
  }
}

function buildTranscriptionPrompt(savedName?: string): string {
  const base = `AURA operator console. Domain terms: ${TRANSCRIPTION_VOCAB}.`;
  // Append the stored name so Whisper biases toward it — dynamic, not hardcoded.
  return savedName?.trim() ? `${base} The operator's name is ${savedName.trim()}.` : base;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class OpenAIVoiceSessionServiceImpl {
  private history: ChatHistoryMessage[] = [];

  // ── Readiness check ───────────────────────────────────────────────────────

  async isReady(): Promise<boolean> {
    try {
      return await invoke<boolean>('openai_key_is_configured');
    } catch {
      return Boolean(import.meta.env.VITE_OPENAI_API_KEY);
    }
  }

  // ── STT: transcribe audio via Tauri backend ───────────────────────────────

  async transcribeAudio(audioBlob: Blob, promptOverride?: string): Promise<VoiceTranscriptionResult> {
    const start = Date.now();

    // Build vocabulary hint (domain terms + saved name).
    let prompt = promptOverride;
    if (prompt === undefined) {
      try {
        const { userProfileMemoryService } = await import('../memory/UserProfileMemoryService');
        prompt = buildTranscriptionPrompt(userProfileMemoryService.getDisplayName());
      } catch {
        prompt = buildTranscriptionPrompt();
      }
    }

    const buffer = await audioBlob.arrayBuffer();
    const audioBytes = Array.from(new Uint8Array(buffer));
    const contentType = audioBlob.type || 'audio/webm';

    // ── Speech-energy gate ───────────────────────────────────────────────────
    //
    // Do not send audio that contains no speech. Whisper conditions on `prompt`, so
    // given silence, a mouse click or background music it emits the most probable
    // continuation of that conditioning — the vocabulary hint itself. Because the hint
    // ends with the operator's name, the characteristic symptom is AURA "hearing" the
    // user's name when nothing was said.
    //
    // Byte length alone cannot catch this: a webm/opus container holding several
    // seconds of silence comfortably exceeds the backend's MIN_AUDIO_BYTES floor. The
    // Rust side also has a prompt-echo filter, but refusing to make the call at all is
    // better — it removes the failure mode at source and costs nothing.
    const level = await measurePeakLevel(buffer.slice(0));
    if (level !== null && level < SPEECH_PEAK_THRESHOLD) {
      return {
        success: true,
        text: '',
        latencyMs: Date.now() - start,
        skippedReason: 'no-speech-energy',
      };
    }

    // ── Try local Whisper first (free, private, often more accurate) ──────────
    if ('__TAURI_INTERNALS__' in window) {
      try {
        const localText = await invoke<string>('local_transcribe_audio', {
          audioBytes,
          contentType,
          prompt,
        });
        if (localText !== undefined && localText !== null) {
          return { success: true, text: localText.trim(), latencyMs: Date.now() - start };
        }
      } catch {
        // Local STT unavailable (faster-whisper not installed, script not found, etc.)
        // Fall through to API path — no error surfaced to the user.
      }
    }

    // ── Fall back to OpenAI Whisper API ───────────────────────────────────────
    try {
      const text = await invoke<string>('openai_transcribe_audio', {
        audioBytes,
        contentType,
        prompt,
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
    systemPromptOverride?: string,
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
        systemPromptOverride: systemPromptOverride ?? null,
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

  // ── Memory extraction — runs async after a turn, never blocks voice ────────

  async extractMemory(userText: string, auraText: string): Promise<MemoryExtractionResult> {
    try {
      const raw = await invoke<string>('openai_extract_memory', {
        userText: userText.trim(),
        auraText: auraText.trim(),
      });
      const parsed = JSON.parse(raw) as
        | Array<{ category: string; content: string }>
        | { facts?: Array<{ category: string; content: string }> };
      const facts = Array.isArray(parsed) ? parsed : (parsed.facts ?? []);
      return {
        facts: facts
          .filter(f => (f.category === 'personal' || f.category === 'task') && f.content?.trim())
          .map(f => ({ category: f.category as 'personal' | 'task', content: f.content.trim() })),
      };
    } catch {
      return { facts: [] };
    }
  }

  // ── Sentence splitter ─────────────────────────────────────────────────────
  //
  // Splits text into sentences for parallel TTS synthesis queuing.
  // Returns at least one element. Short fragments are merged into the next
  // sentence so we don't fire too many tiny TTS requests.

  splitIntoSentences(text: string): string[] {
    if (!text.trim()) return [];

    // Collapse ellipsis (...) so it never triggers a false split.
    const ELLIPSIS = '…';
    const protected_ = text.replace(/\.{2,}/g, ELLIPSIS);

    const raw = protected_
      .split(/(?<=[.!?])\s+/)
      .map(s => s.replace(new RegExp(ELLIPSIS, 'g'), '...').trim())
      .filter(Boolean);

    if (raw.length === 0) return [text.trim()];

    // Merge short leading/trailing fragments (< 40 chars) into the adjacent
    // sentence to avoid hammering TTS with trivial one-word chunks.
    const merged: string[] = [];
    let buf = '';
    for (const part of raw) {
      buf = buf ? `${buf} ${part}` : part;
      if (buf.length >= 40) {
        merged.push(buf);
        buf = '';
      }
    }
    if (buf) {
      // Append any leftover to the last merged sentence if it exists and is short,
      // otherwise push as its own chunk.
      if (merged.length > 0 && buf.length < 40) {
        merged[merged.length - 1] += ` ${buf}`;
      } else {
        merged.push(buf);
      }
    }

    return merged.length > 0 ? merged : [text.trim()];
  }

  // ── TTS: synthesize speech via Tauri backend ──────────────────────────────

  async synthesizeSpeech(
    text: string,
    voice: VoiceConversationSettings['ttsVoice'] = 'alloy',
  ): Promise<VoiceSpeechResult> {
    if (!text.trim()) return { success: false, error: 'Empty text' };
    const start = Date.now();
    try {
      const bytes = await invoke<number[]>('openai_synthesize_speech', {
        text: text.trim(),
        voice,
      });

      const uint8 = new Uint8Array(bytes);
      // Return the underlying ArrayBuffer alongside the blob URL so the Web
      // Audio API path can decode it directly without an extra fetch() call.
      const audioBytes = uint8.buffer;
      const blob = new Blob([uint8], { type: 'audio/mpeg' });
      const audioBlobUrl = URL.createObjectURL(blob);

      return { success: true, audioBlobUrl, audioBytes, latencyMs: Date.now() - start };
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

  /** Get the last N history messages (for tool dispatch service) */
  getHistorySlice(n: number): Array<{ role: string; content: string }> {
    return this.history.slice(-n);
  }

  /** Manually push a turn to history (used when bypassing createChatResponse) */
  pushHistory(userText: string, auraText: string) {
    this.history.push({ role: 'user', content: userText.trim() });
    this.history.push({ role: 'assistant', content: auraText.trim() });
    if (this.history.length > MAX_HISTORY_TURNS * 2) {
      this.history = this.history.slice(-MAX_HISTORY_TURNS * 2);
    }
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

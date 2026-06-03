/**
 * voice-latency.ts — AURA Phase 3F
 *
 * Types for voice pipeline latency instrumentation.
 * Helps identify whether delay is in STT, Chat, TTS, or playback.
 */

export interface VoiceLatencyMetrics {
  id: string;
  timestamp: string;

  /** How long recording was active (ms) */
  recordingMs: number;
  /** How many segments were transcribed */
  segmentCount: number;

  /** Total time to assemble final transcript across all segments (ms) */
  sttTotalMs: number;
  /** Average per-segment STT time (ms) */
  sttAvgSegmentMs: number;

  /** Time from final transcript assembled to chat response start (ms) */
  chatRequestMs: number;
  /** Total chat response latency including server thinking (ms) */
  chatTotalMs: number;

  /** Time to synthesize TTS audio (ms) */
  ttsSynthesisMs: number;
  /** Time from TTS response to first audio sample played (ms) */
  audioPlaybackStartMs: number;

  /** Total perceived latency: final pause → first audio byte (ms) */
  perceivedLatencyMs: number;
  /** Total round-trip: first word spoken → full answer heard (ms) */
  totalRoundTripMs: number;

  // Sentence-first TTS instrumentation (Phase 3F QA)
  /** Time from transcript ready to first sentence text extracted (ms) */
  firstSentenceTextReadyMs?: number;
  /** Time from first sentence text to first sentence TTS audio ready (ms) */
  firstSentenceTtsReadyMs?: number;
  /** Time from transcript ready to first audio byte played (ms) — the key metric */
  firstAudioStartMs?: number;
  /** Time from transcript ready to all audio ready (ms) */
  fullAudioReadyMs?: number;

  responseStyle: 'fast' | 'brief' | 'normal' | 'detailed';
  segmentedMode: boolean;
  sentenceFirstTTS: boolean;

  /** Stage where the pipeline failed, if it did */
  failureStage?: LatencyStage;
  /** Whether a fallback path was used (e.g. fast-chat fallback to normal chat) */
  fallbackPath?: boolean;
}

export type LatencyStage =
  | 'recording'
  | 'stt_segment'
  | 'transcript_assembly'
  | 'chat_request'
  | 'tts_synthesis'
  | 'audio_playback';

/** Running timing context built up during a single voice turn */
export interface LatencyContext {
  turnId: string;
  recordingStartedAt: number;
  recordingEndedAt?: number;
  sttSegmentTimes: number[];   // ms per segment
  chatStartedAt?: number;
  chatEndedAt?: number;
  ttsStartedAt?: number;
  ttsEndedAt?: number;
  audioStartedAt?: number;
  // Sentence-first TTS granular markers (Phase 3F QA)
  firstSentenceTextReadyAt?: number;
  firstSentenceTtsReadyAt?: number;
  firstAudioStartAt?: number;
  fullAudioReadyAt?: number;
  segmentCount: number;
  responseStyle: 'fast' | 'brief' | 'normal' | 'detailed';
  segmentedMode: boolean;
  sentenceFirstTTS: boolean;
  failureStage?: LatencyStage;
  fallbackPath?: boolean;
}

/**
 * transcript-log.ts — AURA Phase 3E
 *
 * Types for persistent voice transcript logging.
 * Security: no raw audio, no API keys, no secrets stored.
 */

export type TranscriptLogStatus = 'success' | 'error' | 'partial' | 'no_speech';

export interface TranscriptLogEntry {
  id: string;
  /** ISO timestamp */
  timestamp: string;
  userText: string;
  auraText: string;
  provider: string;
  durationMs?: number;
  status: TranscriptLogStatus;
  errorSummary?: string;
  sttLatencyMs?: number;
  chatLatencyMs?: number;
  ttsLatencyMs?: number;
}

export interface TranscriptLogStore {
  entries: TranscriptLogEntry[];
  /** Total turns stored (may exceed what's in entries due to cap) */
  totalCount: number;
  /** ISO timestamp of last entry */
  lastUpdated: string | null;
}

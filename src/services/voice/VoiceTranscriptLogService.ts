/**
 * VoiceTranscriptLogService — AURA Phase 3E
 *
 * Stores voice conversation turns locally in localStorage.
 * Only stores text — no raw audio.
 * Requires persistTranscripts setting to be true.
 *
 * Security:
 *  - No raw audio stored
 *  - No API keys stored
 *  - Privacy toggle: persistTranscripts must be true to write
 *  - History cleared on user request
 */

import type { TranscriptLogEntry, TranscriptLogStore } from '../../types/transcript-log';

const STORAGE_KEY = 'aura.transcript.log';
const MAX_ENTRIES = 200;

type LogListener = (store: TranscriptLogStore) => void;

function uid(): string {
  return `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyStore(): TranscriptLogStore {
  return { entries: [], totalCount: 0, lastUpdated: null };
}

function loadStore(): TranscriptLogStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return emptyStore();
    return parsed as TranscriptLogStore;
  } catch {
    return emptyStore();
  }
}

function saveStore(store: TranscriptLogStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full — skip silently
  }
}

class VoiceTranscriptLogServiceImpl {
  private store: TranscriptLogStore = emptyStore();
  private listeners = new Set<LogListener>();
  private persistEnabled = false;

  constructor() {
    this.store = loadStore();
  }

  setPersistEnabled(enabled: boolean): void {
    this.persistEnabled = enabled;
  }

  subscribe(fn: LogListener): () => void {
    this.listeners.add(fn);
    fn({ ...this.store });
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const snap = { ...this.store, entries: [...this.store.entries] };
    for (const fn of this.listeners) fn(snap);
  }

  /** Log a successful conversation turn */
  logTurn(data: {
    userText: string;
    auraText: string;
    provider?: string;
    durationMs?: number;
    sttLatencyMs?: number;
    chatLatencyMs?: number;
    ttsLatencyMs?: number;
  }): void {
    if (!this.persistEnabled) return;

    const entry: TranscriptLogEntry = {
      id:           uid(),
      timestamp:    new Date().toISOString(),
      userText:     data.userText,
      auraText:     data.auraText,
      provider:     data.provider ?? 'openai',
      durationMs:   data.durationMs,
      status:       'success',
      sttLatencyMs: data.sttLatencyMs,
      chatLatencyMs:data.chatLatencyMs,
      ttsLatencyMs: data.ttsLatencyMs,
    };

    this.store = {
      entries:    [entry, ...this.store.entries].slice(0, MAX_ENTRIES),
      totalCount: this.store.totalCount + 1,
      lastUpdated:entry.timestamp,
    };

    saveStore(this.store);
    this.notify();
  }

  /** Log a failed/no-speech turn */
  logError(data: {
    userText?: string;
    errorSummary: string;
    durationMs?: number;
    status?: TranscriptLogEntry['status'];
  }): void {
    if (!this.persistEnabled) return;

    const entry: TranscriptLogEntry = {
      id:           uid(),
      timestamp:    new Date().toISOString(),
      userText:     data.userText ?? '',
      auraText:     '',
      provider:     'openai',
      durationMs:   data.durationMs,
      status:       data.status ?? 'error',
      errorSummary: data.errorSummary,
    };

    this.store = {
      entries:    [entry, ...this.store.entries].slice(0, MAX_ENTRIES),
      totalCount: this.store.totalCount + 1,
      lastUpdated:entry.timestamp,
    };

    saveStore(this.store);
    this.notify();
  }

  getStore(): TranscriptLogStore {
    return { ...this.store, entries: [...this.store.entries] };
  }

  getRecent(limit = 50): TranscriptLogEntry[] {
    return this.store.entries.slice(0, limit);
  }

  clear(): void {
    this.store = emptyStore();
    saveStore(this.store);
    this.notify();
  }

  exportJSON(): string {
    return JSON.stringify(this.store, null, 2);
  }

  exportMarkdown(): string {
    if (this.store.entries.length === 0) return '# AURA Voice Transcript Log\n\n_No entries._\n';
    const lines = ['# AURA Voice Transcript Log\n'];
    for (const e of this.store.entries) {
      lines.push(`## ${e.timestamp}`);
      lines.push(`**Status:** ${e.status}`);
      if (e.userText) lines.push(`**You:** ${e.userText}`);
      if (e.auraText) lines.push(`**AURA:** ${e.auraText}`);
      if (e.errorSummary) lines.push(`**Error:** ${e.errorSummary}`);
      lines.push('');
    }
    return lines.join('\n');
  }
}

export const voiceTranscriptLogService = new VoiceTranscriptLogServiceImpl();

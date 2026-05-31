/**
 * VoiceDiagnosticsService — AURA Phase 3J QA (Milestone 5)
 *
 * Compact, in-memory record of how recent voice/console turns were interpreted,
 * so the operator (and future agents) can tell whether a voice failure was in
 * STT, cleanup, intent detection, or the memory save — not guess.
 *
 * Privacy: stores only short transcript text (already non-secret operator
 * speech). No raw audio, no API keys. Session-only; not persisted.
 */

export type VoiceDiagnosticIntent =
  | 'name.save'
  | 'name.confirm'
  | 'name.query'
  | 'name.committed'
  | 'chat'
  | 'tool'
  | 'other';

export interface VoiceDiagnosticEntry {
  id: string;
  at: string;
  source: 'voice' | 'typed';
  rawText: string;
  cleanedText: string;
  intent: VoiceDiagnosticIntent;
  spellingMode: boolean;
  savedValue?: string;
  confidence?: string;
  sttDurationMs?: number;
  segmentCount?: number;
  audioDurationMs?: number;
  note?: string;
}

type Listener = (entries: VoiceDiagnosticEntry[]) => void;

const MAX_ENTRIES = 30;

class VoiceDiagnosticsServiceImpl {
  private entries: VoiceDiagnosticEntry[] = [];
  private listeners = new Set<Listener>();

  record(entry: Omit<VoiceDiagnosticEntry, 'id' | 'at'>): void {
    const full: VoiceDiagnosticEntry = {
      ...entry,
      id: `vd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
    };
    this.entries = [full, ...this.entries].slice(0, MAX_ENTRIES);
    this.notify();
  }

  getEntries(): VoiceDiagnosticEntry[] { return [...this.entries]; }

  clear(): void { this.entries = []; this.notify(); }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn([...this.entries]);
    return () => { this.listeners.delete(fn); };
  }

  private notify(): void {
    const snap = [...this.entries];
    for (const fn of this.listeners) fn(snap);
  }
}

export const voiceDiagnosticsService = new VoiceDiagnosticsServiceImpl();

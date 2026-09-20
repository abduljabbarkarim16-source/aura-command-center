/**
 * EventLogService — AURA Event Log
 *
 * One chronological, disk-backed stream of everything AURA does: what the operator
 * clicked, what the microphone did, what was sent to the transcription model, what came
 * back before and after filtering, how long each stage took, which tools ran, and every
 * error. Written as JSON Lines to
 * %APPDATA%\com.aura.commandcenter\logs\aura-events.jsonl.
 *
 * Why this exists: AURA already had RuntimeTimelineService, VoiceTranscriptLogService and
 * IncidentService, but each kept a different slice in localStorage — capped, scoped to a
 * profile, and unreadable from outside the running app. The Tauri log plugin was
 * configured but never written to (0 bytes across a full session). So when voice
 * misbehaved, the only evidence was a screen recording. This service replaces guesswork
 * with a record.
 *
 * Durability strategy: events are buffered in memory and flushed in batches, because one
 * IPC round-trip per event would add measurable latency to the voice path. Errors flush
 * immediately — the events most worth having are the ones written just before a crash.
 *
 * Security invariants:
 * - Never log API keys, tokens, or audio bytes. Only sizes, durations and MIME types.
 * - Transcripts ARE logged: diagnosing mis-transcription is the point. They stay in
 *   local AppData and are never transmitted.
 * - The Rust writer redacts key-shaped strings as an independent backstop.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  AuraEvent,
  EventLogCategory,
  EventLogInfo,
  EventLogLevel,
} from '../../types/event-log';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Flush when the buffer reaches this many events. */
const FLUSH_AT_COUNT = 40;
/** Flush at least this often while events are pending. */
const FLUSH_INTERVAL_MS = 1500;
/** In-memory ring for the live viewer. Disk holds the full history. */
const MEMORY_RING_SIZE = 500;

function shortId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

class EventLogServiceImpl {
  private seq = 0;
  private readonly runId = shortId('run');
  private turnId: string | undefined;
  private buffer: string[] = [];
  private ring: AuraEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(e: AuraEvent) => void>();
  private flushing = false;
  /** Set if the disk write fails, so the UI can say the log is incomplete rather than lie. */
  private lastWriteError: string | null = null;

  // ─── Turn correlation ───────────────────────────────────────────────────────

  /**
   * Open a new turn. Every event logged until `endTurn` carries this id, which is what
   * makes a single voice exchange readable end to end.
   *
   * A still-open turn is closed automatically as `superseded`. The voice pipeline has
   * roughly a dozen exit paths, several of them in audio callbacks, so requiring every
   * one to call `endTurn` would guarantee leaks. Self-closing here means a missed call
   * costs one imprecise outcome label rather than silently attributing the next turn's
   * events to the previous turn.
   */
  beginTurn(kind = 'voice'): string {
    if (this.turnId) this.endTurn('superseded');
    this.turnId = shortId('turn');
    this.log('info', 'state', 'turn.begin', { kind });
    return this.turnId;
  }

  endTurn(outcome: string, data?: Record<string, unknown>): void {
    if (!this.turnId) return;
    this.log('info', 'state', 'turn.end', { outcome, ...data });
    this.turnId = undefined;
  }

  currentTurn(): string | undefined {
    return this.turnId;
  }

  /**
   * Start a monotonic stopwatch. Returns a function that logs the elapsed time.
   *
   * Durations come from performance.now(), which cannot go backwards. AURA previously
   * reported latencies like -5666ms by subtracting wall-clock timestamps captured in
   * different places; any duration measured through this helper is structurally
   * incapable of being negative.
   */
  startTimer(category: EventLogCategory, event: string, data?: Record<string, unknown>) {
    const t0 = performance.now();
    this.log('debug', category, `${event}.start`, data);
    return (endData?: Record<string, unknown>) => {
      const ms = Math.round(performance.now() - t0);
      this.log('info', category, `${event}.done`, { ms, ...endData });
      return ms;
    };
  }

  // ─── Core write path ────────────────────────────────────────────────────────

  log(
    level: EventLogLevel,
    category: EventLogCategory,
    event: string,
    data?: Record<string, unknown>,
  ): void {
    const entry: AuraEvent = {
      seq: ++this.seq,
      ts: new Date().toISOString(),
      mono: Math.round(performance.now()),
      runId: this.runId,
      ...(this.turnId ? { turnId: this.turnId } : {}),
      level,
      category,
      event,
      ...(data && Object.keys(data).length > 0 ? { data } : {}),
    };

    this.ring.push(entry);
    if (this.ring.length > MEMORY_RING_SIZE) this.ring.shift();
    for (const fn of this.listeners) {
      try { fn(entry); } catch { /* a bad subscriber must not break logging */ }
    }

    try {
      this.buffer.push(JSON.stringify(entry));
    } catch {
      // Unserialisable payload (a cycle, a DOM node). Record that it happened rather
      // than dropping the event silently — a gap in the log is itself a clue.
      this.buffer.push(JSON.stringify({ ...entry, data: { unserialisable: true } }));
    }

    if (level === 'error' || this.buffer.length >= FLUSH_AT_COUNT) {
      void this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  info(category: EventLogCategory, event: string, data?: Record<string, unknown>) {
    this.log('info', category, event, data);
  }

  warn(category: EventLogCategory, event: string, data?: Record<string, unknown>) {
    this.log('warn', category, event, data);
  }

  /** Accepts a thrown value of any shape; extracts a message without losing the rest. */
  error(category: EventLogCategory, event: string, err?: unknown, data?: Record<string, unknown>) {
    const message =
      err instanceof Error ? err.message : err === undefined ? undefined : String(err);
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 4).join(' | ') : undefined;
    this.log('error', category, event, { ...data, ...(message ? { message } : {}), ...(stack ? { stack } : {}) });
  }

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Write pending events to disk. Safe to call concurrently: a second call while a write
   * is in flight returns immediately, and the interval timer picks up the remainder.
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    if (!isTauri()) {
      // Browser preview has no disk. Keep the memory ring; drop the write queue so it
      // cannot grow without bound during a long dev session.
      this.buffer = [];
      return;
    }
    this.flushing = true;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await invoke<number>('append_event_log_batch', { lines: batch });
      this.lastWriteError = null;
    } catch (e) {
      this.lastWriteError = e instanceof Error ? e.message : String(e);
      // Put the batch back so nothing is lost to a transient failure, but bound the
      // retry queue: an unavailable log must not become a memory leak.
      this.buffer = [...batch.slice(-FLUSH_AT_COUNT * 4), ...this.buffer];
      console.warn('[EventLog] write failed:', this.lastWriteError);
    } finally {
      this.flushing = false;
    }
  }

  // ─── Reading ────────────────────────────────────────────────────────────────

  /** Recent events held in memory. Synchronous, for live UI. */
  recent(limit = MEMORY_RING_SIZE): AuraEvent[] {
    return this.ring.slice(-limit);
  }

  /** Read back from disk, including events from earlier runs. */
  async readFromDisk(limit = 1000): Promise<AuraEvent[]> {
    if (!isTauri()) return this.recent(limit);
    await this.flush();
    const lines = await invoke<string[]>('read_event_log', { limit });
    const out: AuraEvent[] = [];
    for (const line of lines) {
      try { out.push(JSON.parse(line) as AuraEvent); } catch { /* skip a torn line */ }
    }
    return out;
  }

  async info_(): Promise<EventLogInfo | null> {
    if (!isTauri()) return null;
    try { return await invoke<EventLogInfo>('event_log_info'); } catch { return null; }
  }

  writeError(): string | null {
    return this.lastWriteError;
  }

  subscribe(fn: (e: AuraEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ─── Global capture ─────────────────────────────────────────────────────────

  /**
   * Record operator interactions and uncaught faults.
   *
   * Clicks are captured at the document level rather than wired into each component:
   * the requirement is that *everything* clicked is logged, and per-component
   * instrumentation would drift out of date the moment a new control is added.
   */
  attachGlobalCapture(): void {
    if (typeof window === 'undefined') return;

    document.addEventListener(
      'click',
      (ev) => {
        const target = ev.target as HTMLElement | null;
        if (!target) return;
        const el = target.closest('button, a, [role="button"], input, select, summary');
        if (!el) return;
        const label =
          el.getAttribute('aria-label') ??
          el.getAttribute('title') ??
          (el.textContent ?? '').trim().slice(0, 60) ??
          '';
        this.log('info', 'ui', 'click', {
          tag: el.tagName.toLowerCase(),
          label: label || undefined,
          id: el.id || undefined,
          testid: el.getAttribute('data-testid') ?? undefined,
          path: window.location.hash || window.location.pathname,
        });
      },
      { capture: true },
    );

    window.addEventListener('error', (ev) => {
      this.error('error', 'uncaught.error', ev.error ?? ev.message, {
        source: ev.filename,
        line: ev.lineno,
      });
    });

    window.addEventListener('unhandledrejection', (ev) => {
      this.error('error', 'unhandled.rejection', ev.reason);
    });

    // pagehide is the reliable last chance to persist in a WebView; beforeunload is not
    // always delivered. Neither can await, so the flush is fire-and-forget.
    window.addEventListener('pagehide', () => { void this.flush(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush();
    });

    this.log('info', 'app', 'log.attached', {
      runId: this.runId,
      userAgent: navigator.userAgent.slice(0, 120),
      online: navigator.onLine,
    });

    window.addEventListener('online', () => this.log('info', 'net', 'connectivity', { online: true }));
    window.addEventListener('offline', () => this.warn('net', 'connectivity', { online: false }));
  }
}

export const eventLog = new EventLogServiceImpl();

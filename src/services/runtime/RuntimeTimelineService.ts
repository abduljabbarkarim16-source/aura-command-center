/**
 * RuntimeTimelineService — AURA Milestone I
 *
 * Persists important runtime events to localStorage for review.
 * Subscribes to VoiceRuntimeService events and selectively persists
 * meaningful state changes.
 *
 * Does NOT persist:
 * - Waveform data or audio frames
 * - Raw idle/listening state transitions
 * - Any secret values
 * - Raw file contents or payloads
 *
 * Storage: localStorage via PersistenceService (key: 'runtime.timeline')
 * Cap: 500 events max to avoid localStorage bloat.
 */

import type {
  RuntimeTimelineEvent,
  RuntimeTimelineFilter,
  RuntimeTimelineExport,
  RuntimeTimelineSeverity,
  RuntimeTimelineCategory,
} from '../../types/runtime-timeline';
import { voiceRuntimeService } from '../voice/VoiceRuntimeService';
import { defaultAdapter } from '../persistence/PersistenceService';
import type { VoiceRuntimeEvent } from '../../types/voice-runtime';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const STORAGE_KEY = 'runtime.timeline';
const MAX_EVENTS = 500;

// ─── Event mapping from VoiceRuntime ──────────────────────────────────────────

type PersistedEventTypes = Set<string>;

const PERSISTED_EVENT_TYPES: PersistedEventTypes = new Set([
  'approval_requested',
  'approval_resolved',
  'relay_ready',
  'handoff_created',
  'memory_updated',
  'tool_locked',
  'tool_running',
  'tool_completed',
  'error',
  'notification_created',
  'aura_ready',
]);

function mapVoiceEventToTimeline(event: VoiceRuntimeEvent): RuntimeTimelineEvent | null {
  if (!PERSISTED_EVENT_TYPES.has(event.type)) return null;

  let severity: RuntimeTimelineSeverity = 'info';
  let category: RuntimeTimelineCategory = 'system';
  let title = event.type.replace(/_/g, ' ');

  switch (event.type) {
    case 'approval_requested':
      severity = 'warning';
      category = 'approval';
      title = `Approval requested: ${(event.payload?.title as string) ?? 'Unknown'}`;
      break;
    case 'approval_resolved':
      severity = event.payload?.decision === 'approved' ? 'success' : 'info';
      category = 'approval';
      title = `Approval ${event.payload?.decision as string}: ${(event.payload?.title as string) ?? ''}`;
      break;
    case 'relay_ready':
      severity = 'info';
      category = 'relay';
      title = 'Relay packet ready';
      break;
    case 'handoff_created':
      severity = 'success';
      category = 'handoff';
      title = 'Agent handoff created';
      break;
    case 'memory_updated':
      severity = 'info';
      category = 'memory';
      title = 'Memory entry updated';
      break;
    case 'tool_locked':
      severity = 'warning';
      category = 'tool';
      title = `Tool locked: ${(event.payload?.toolName as string) ?? ''}`;
      break;
    case 'tool_running':
      severity = 'info';
      category = 'tool';
      title = `Tool running: ${(event.payload?.toolName as string) ?? ''}`;
      break;
    case 'tool_completed':
      severity = 'success';
      category = 'tool';
      title = `Tool completed: ${(event.payload?.toolName as string) ?? ''}`;
      break;
    case 'error':
      severity = 'error';
      category = 'error';
      title = `Error: ${(event.payload?.message as string) ?? 'Unknown error'}`;
      break;
    case 'aura_ready':
      severity = 'success';
      category = 'system';
      title = 'AURA runtime ready';
      break;
  }

  return {
    id: uid(),
    timestamp: event.timestamp,
    severity,
    category,
    title,
    detail: event.payload ? JSON.stringify(
      // Strip any payload fields that could contain sensitive data
      Object.fromEntries(
        Object.entries(event.payload).filter(([k]) =>
          !['apiKey', 'secret', 'token', 'password', 'value', 'raw'].includes(k),
        ),
      ),
    ) : undefined,
    persisted: false,
    read: false,
    source: 'voice-runtime',
    entityId: event.payload?.id as string | undefined,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

type TimelineListener = (events: RuntimeTimelineEvent[]) => void;

class RuntimeTimelineService {
  private events: RuntimeTimelineEvent[] = [];
  private listeners = new Set<TimelineListener>();
  private unsubscribeFromRuntime: (() => void) | null = null;

  constructor() {
    // Load persisted events from storage
    this.loadFromStorage();
    // Subscribe to VoiceRuntimeService
    this.startListening();
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(fn: TimelineListener): () => void {
    this.listeners.add(fn);
    fn([...this.events]);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = [...this.events];
    for (const fn of this.listeners) fn(snap);
  }

  // ── Runtime bridge ────────────────────────────────────────────────────────

  private startListening(): void {
    this.unsubscribeFromRuntime = voiceRuntimeService.subscribe(snapshot => {
      const recent = snapshot.recentEvents.slice(0, 1); // Only new events (newest first)
      for (const event of recent) {
        if (!this.events.some(e => e.entityId === event.id || e.id.includes(event.id.slice(0, 8)))) {
          const tl = mapVoiceEventToTimeline(event);
          if (tl) this.addEvent(tl);
        }
      }
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  addEvent(event: Omit<RuntimeTimelineEvent, 'id' | 'persisted' | 'read'> & { id?: string }): RuntimeTimelineEvent {
    const full: RuntimeTimelineEvent = {
      ...event,
      id: event.id ?? uid(),
      persisted: false,
      read: false,
    };

    this.events = [full, ...this.events].slice(0, MAX_EVENTS);
    this.persistAsync();
    this.notify();
    return full;
  }

  markRead(id: string): void {
    this.events = this.events.map(e => e.id === id ? { ...e, read: true } : e);
    this.persistAsync();
    this.notify();
  }

  markAllRead(): void {
    this.events = this.events.map(e => ({ ...e, read: true }));
    this.persistAsync();
    this.notify();
  }

  clearEvents(): void {
    this.events = [];
    defaultAdapter.remove(STORAGE_KEY).catch(() => {});
    this.notify();
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  getAll(): RuntimeTimelineEvent[] {
    return [...this.events];
  }

  filter(criteria: RuntimeTimelineFilter): RuntimeTimelineEvent[] {
    let result = [...this.events];

    if (criteria.categories?.length) {
      result = result.filter(e => criteria.categories!.includes(e.category));
    }
    if (criteria.severities?.length) {
      result = result.filter(e => criteria.severities!.includes(e.severity));
    }
    if (criteria.since) {
      result = result.filter(e => e.timestamp >= criteria.since!);
    }
    if (criteria.unreadOnly) {
      result = result.filter(e => !e.read);
    }
    if (criteria.searchText) {
      const q = criteria.searchText.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.detail?.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q),
      );
    }

    return result.slice(0, criteria.maxItems ?? 100);
  }

  getUnreadCount(): number {
    return this.events.filter(e => !e.read).length;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  export(filter?: RuntimeTimelineFilter): RuntimeTimelineExport {
    const events = filter ? this.filter(filter) : this.getAll();
    return {
      exportedAt: new Date().toISOString(),
      totalEvents: events.length,
      events,
      filter,
    };
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private async persistAsync(): Promise<void> {
    try {
      // Only persist high-value events to avoid localStorage bloat
      const toPersist = this.events.filter(e =>
        ['error', 'approval', 'relay', 'handoff', 'memory'].includes(e.category),
      ).slice(0, 200);
      await defaultAdapter.set(STORAGE_KEY, toPersist);
    } catch {
      // Storage failure is non-fatal
    }
  }

  private loadFromStorage(): void {
    defaultAdapter.get<RuntimeTimelineEvent[]>(STORAGE_KEY).then(stored => {
      if (stored?.length) {
        this.events = stored.map(e => ({ ...e, persisted: true }));
        this.notify();
      }
    }).catch(() => {});
  }
}

export const runtimeTimeline = new RuntimeTimelineService();

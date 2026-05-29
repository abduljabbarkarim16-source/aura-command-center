/**
 * AURA Runtime Timeline Types — Milestone I
 *
 * Defines the persistent event timeline for important AURA runtime events.
 *
 * What to persist:
 *   - approval requested/resolved
 *   - relay ready, handoff created, memory updated
 *   - tool locked/running/completed
 *   - errors
 *   - provider status changes
 *   - command proposed/resolved
 *
 * What NOT to persist:
 *   - waveform frames (too noisy)
 *   - every idle/listening state transition
 *   - secrets or raw file contents
 *   - raw tool payloads with PII
 */

// ─── Severity ─────────────────────────────────────────────────────────────────

export type RuntimeTimelineSeverity = 'info' | 'warning' | 'success' | 'error' | 'critical';

// ─── Event category ───────────────────────────────────────────────────────────

export type RuntimeTimelineCategory =
  | 'approval'
  | 'relay'
  | 'handoff'
  | 'memory'
  | 'tool'
  | 'provider'
  | 'command'
  | 'voice'
  | 'error'
  | 'system';

// ─── Event ───────────────────────────────────────────────────────────────────

export interface RuntimeTimelineEvent {
  id: string;
  timestamp: number;
  severity: RuntimeTimelineSeverity;
  category: RuntimeTimelineCategory;
  title: string;
  detail?: string;
  /** True if this event was persisted to localStorage */
  persisted: boolean;
  /** True if the event has been read by the user */
  read: boolean;
  /** Stable source identifier — who or what emitted this event */
  source: string;
  /** Optional reference to an external entity (approval id, relay id, etc.) */
  entityId?: string;
}

// ─── Filter ──────────────────────────────────────────────────────────────────

export interface RuntimeTimelineFilter {
  categories?: RuntimeTimelineCategory[];
  severities?: RuntimeTimelineSeverity[];
  since?: number;     // Timestamp threshold
  maxItems?: number;
  searchText?: string;
  unreadOnly?: boolean;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export interface RuntimeTimelineExport {
  exportedAt: string;
  totalEvents: number;
  events: RuntimeTimelineEvent[];
  filter?: RuntimeTimelineFilter;
}

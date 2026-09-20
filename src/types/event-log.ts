/**
 * event-log.ts — AURA Event Log
 *
 * Type vocabulary for the durable, append-only record of everything AURA does.
 *
 * Design notes:
 * - `seq` is monotonic within a run, so two events written in the same millisecond
 *   still have a defined order. Wall-clock timestamps alone cannot guarantee this.
 * - `mono` is `performance.now()`, immune to system clock adjustments. Latency must be
 *   derived from `mono`, never from `ts` — see DEFECT-V3, where reported latencies were
 *   negative because durations were computed from wall-clock values captured across
 *   different code paths.
 * - `turnId` correlates every event belonging to one voice exchange, so a single fault
 *   can be read end to end instead of reassembled from interleaved lines.
 *
 * Security invariants:
 * - No API keys, tokens or audio bytes in `data`. The Rust writer redacts
 *   key-shaped strings as a backstop, but callers must not rely on it.
 */

export type EventLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Coarse grouping, chosen so a reader can filter to one subsystem when chasing a fault.
 * Kept deliberately short — a long enum invites miscategorisation.
 */
export type EventLogCategory =
  | 'app'       // launch, shutdown, navigation, config load
  | 'ui'        // clicks, toggles, page changes — what the operator did
  | 'mic'       // device selection, stream open/close, permission
  | 'stt'       // energy gate, transcription request/response, filters
  | 'chat'      // model calls and replies
  | 'tts'       // speech synthesis and playback
  | 'tool'      // tool dispatch and results
  | 'task'      // sequential task runner
  | 'memory'    // memory reads and writes
  | 'state'     // voice session state transitions
  | 'net'       // outbound network calls
  | 'error';    // faults that reached the operator

export interface AuraEvent {
  /** Monotonic sequence within this app run. */
  seq: number;
  /** ISO wall-clock time. For human reading and correlation with screen recordings. */
  ts: string;
  /** performance.now() in ms. Use this, not `ts`, for any duration arithmetic. */
  mono: number;
  /** Identifies one app launch, so runs can be told apart in a rotated log. */
  runId: string;
  /** Correlates all events in one voice exchange. Absent outside a turn. */
  turnId?: string;
  level: EventLogLevel;
  category: EventLogCategory;
  /** Dotted specific name, e.g. 'stt.gate.skipped', 'mic.stream.opened'. */
  event: string;
  /** Structured detail. Must not contain secrets or audio. */
  data?: Record<string, unknown>;
}

export interface EventLogInfo {
  path: string;
  bytes: number;
  exists: boolean;
}

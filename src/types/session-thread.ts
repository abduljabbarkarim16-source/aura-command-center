/**
 * session-thread.ts — AURA Phase 3G
 *
 * Conversation thread continuity. AURA is no longer stateless: each
 * conversation has an id, a rolling summary, and links to tasks/tool calls.
 */

export interface ThreadTurn {
  role: 'user' | 'aura';
  text: string;
  at: string; // ISO
}

export interface SessionThread {
  id: string;
  title: string;
  startedAt: string;
  lastActiveAt: string;
  /** Rolling summary (heuristic or compaction output). */
  summary: string;
  messageCount: number;
  /** Recent turns kept verbatim for context + compaction input. */
  recentTurns: ThreadTurn[];
  /** Important facts surfaced in this thread (mirrors saved memories). */
  importantFacts: string[];
  /** Linked background-task / tool-execution ids. */
  linkedTaskIds: string[];
  linkedToolCalls: string[];
  /** When the thread was last compacted, if ever. */
  compactedAt?: string;
  archived: boolean;
}

export interface ThreadDescription {
  id: string;
  title: string;
  messageCount: number;
  startedAt: string;
  lastActiveAt: string;
  compactedAt?: string;
  summary: string;
  /** Plain-text, safe to speak. */
  text: string;
}

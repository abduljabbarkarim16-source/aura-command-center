/**
 * SessionThreadService — AURA Phase 3G (Milestone 4)
 *
 * Thread/session continuity. AURA can start a thread, continue it, record
 * turns, compact it when it grows, and describe what it remembers.
 *
 * Persistence: localStorage (survives restart). No secrets, no raw audio.
 * Compaction is heuristic/local (no network) — LLM-assisted compaction is a
 * documented follow-up (memory.compaction is registered as 'degraded').
 */

import type { SessionThread, ThreadTurn, ThreadDescription } from '../../types/session-thread';
import { capabilityRegistryService } from '../capabilities/CapabilityRegistryService';

const THREADS_KEY = 'aura.session.threads';
const ACTIVE_KEY = 'aura.session.activeThreadId';
const MAX_RECENT_TURNS = 24;          // verbatim turns kept per thread
const COMPACT_THRESHOLD = 40;         // auto-compact suggestion after N messages
const MAX_THREADS = 50;

type ThreadListener = (threads: SessionThread[], activeId: string | null) => void;

function uid(): string {
  return `thr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string { return new Date().toISOString(); }

class SessionThreadServiceImpl {
  private threads: SessionThread[] = [];
  private activeId: string | null = null;
  private listeners = new Set<ThreadListener>();

  constructor() {
    this.load();
    // Registry knows session threads are real once this service is alive.
    try {
      capabilityRegistryService.setStatus('memory.sessionThreads', 'available',
        `Thread service active (${this.threads.length} thread${this.threads.length === 1 ? '' : 's'}).`);
    } catch { /* registry optional */ }
  }

  private load() {
    try {
      const raw = localStorage.getItem(THREADS_KEY);
      this.threads = raw ? (JSON.parse(raw) as SessionThread[]) : [];
      this.activeId = localStorage.getItem(ACTIVE_KEY);
      if (this.activeId && !this.threads.some(t => t.id === this.activeId)) this.activeId = null;
    } catch { this.threads = []; this.activeId = null; }
  }

  private save() {
    try {
      localStorage.setItem(THREADS_KEY, JSON.stringify(this.threads.slice(0, MAX_THREADS)));
      if (this.activeId) localStorage.setItem(ACTIVE_KEY, this.activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch { /* storage full */ }
  }

  subscribe(fn: ThreadListener): () => void {
    this.listeners.add(fn);
    fn([...this.threads], this.activeId);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = [...this.threads];
    for (const fn of this.listeners) fn(snap, this.activeId);
  }

  getAll(): SessionThread[] { return [...this.threads]; }
  getActiveId(): string | null { return this.activeId; }
  get(id: string): SessionThread | undefined { return this.threads.find(t => t.id === id); }

  getActive(): SessionThread | null {
    if (!this.activeId) return null;
    return this.threads.find(t => t.id === this.activeId) ?? null;
  }

  /** Start a new thread and make it active. */
  startThread(title?: string): SessionThread {
    const thread: SessionThread = {
      id: uid(),
      title: title?.trim().slice(0, 80) || `Session ${new Date().toLocaleString()}`,
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
      summary: '',
      messageCount: 0,
      recentTurns: [],
      importantFacts: [],
      linkedTaskIds: [],
      linkedToolCalls: [],
      archived: false,
    };
    this.threads = [thread, ...this.threads].slice(0, MAX_THREADS);
    this.activeId = thread.id;
    this.save();
    this.notify();
    return thread;
  }

  /** Ensure there is an active thread (create on first use). */
  ensureActive(): SessionThread {
    return this.getActive() ?? this.startThread();
  }

  continueThread(id: string): SessionThread | null {
    const t = this.threads.find(x => x.id === id);
    if (!t) return null;
    this.activeId = id;
    t.lastActiveAt = nowIso();
    t.archived = false;
    this.save();
    this.notify();
    return t;
  }

  /** Record a conversation turn on the active (or given) thread. */
  recordTurn(userText: string, auraText: string, opts: { threadId?: string; toolCallId?: string } = {}) {
    const id = opts.threadId ?? this.activeId;
    const thread = id ? this.threads.find(t => t.id === id) : null;
    const target = thread ?? this.ensureActive();

    const turns: ThreadTurn[] = [];
    if (userText.trim()) turns.push({ role: 'user', text: userText.trim().slice(0, 500), at: nowIso() });
    if (auraText.trim()) turns.push({ role: 'aura', text: auraText.trim().slice(0, 500), at: nowIso() });

    target.recentTurns = [...target.recentTurns, ...turns].slice(-MAX_RECENT_TURNS);
    target.messageCount += turns.length;
    target.lastActiveAt = nowIso();
    if (opts.toolCallId) target.linkedToolCalls = [...new Set([...target.linkedToolCalls, opts.toolCallId])];
    if (!target.summary && target.recentTurns.length > 0) {
      target.summary = this.buildHeuristicSummary(target);
    }
    this.save();
    this.notify();
  }

  addFact(fact: string, threadId?: string) {
    const id = threadId ?? this.activeId;
    const t = id ? this.threads.find(x => x.id === id) : null;
    if (!t || !fact.trim()) return;
    t.importantFacts = [...new Set([...t.importantFacts, fact.trim().slice(0, 200)])].slice(-30);
    this.save();
    this.notify();
  }

  linkTask(taskId: string, threadId?: string) {
    const id = threadId ?? this.activeId;
    const t = id ? this.threads.find(x => x.id === id) : null;
    if (!t) return;
    t.linkedTaskIds = [...new Set([...t.linkedTaskIds, taskId])];
    this.save();
    this.notify();
  }

  setTitle(id: string, title: string) {
    const t = this.threads.find(x => x.id === id);
    if (!t) return;
    t.title = title.trim().slice(0, 80) || t.title;
    this.save();
    this.notify();
  }

  archive(id: string) {
    const t = this.threads.find(x => x.id === id);
    if (!t) return;
    t.archived = true;
    if (this.activeId === id) this.activeId = null;
    this.save();
    this.notify();
  }

  delete(id: string) {
    this.threads = this.threads.filter(t => t.id !== id);
    if (this.activeId === id) this.activeId = null;
    this.save();
    this.notify();
  }

  /** Whether the active thread is large enough to suggest compaction. */
  shouldCompact(id?: string): boolean {
    const t = (id ?? this.activeId) ? this.threads.find(x => x.id === (id ?? this.activeId)) : null;
    return !!t && t.messageCount >= COMPACT_THRESHOLD;
  }

  /** Compact a thread: fold recent turns into the summary and trim. */
  compact(id?: string): SessionThread | null {
    const tid = id ?? this.activeId;
    const t = tid ? this.threads.find(x => x.id === tid) : null;
    if (!t) return null;
    t.summary = this.buildHeuristicSummary(t);
    // Keep only the last few turns verbatim after compaction.
    t.recentTurns = t.recentTurns.slice(-4);
    t.compactedAt = nowIso();
    this.save();
    this.notify();
    return t;
  }

  /** Heuristic, local summary — no network. */
  private buildHeuristicSummary(t: SessionThread): string {
    const userTurns = t.recentTurns.filter(x => x.role === 'user').map(x => x.text);
    const topics = userTurns.slice(-6).map(x => x.length > 60 ? x.slice(0, 57) + '…' : x);
    const base = topics.length
      ? `Discussed: ${topics.join(' | ')}`
      : 'No user turns recorded yet.';
    const facts = t.importantFacts.length ? ` Facts: ${t.importantFacts.slice(-4).join('; ')}.` : '';
    return (base + facts).slice(0, 600);
  }

  /** Spoken/printed description of a thread. */
  describe(id?: string): ThreadDescription | null {
    const tid = id ?? this.activeId;
    const t = tid ? this.threads.find(x => x.id === tid) : null;
    if (!t) return null;
    const started = new Date(t.startedAt).toLocaleString();
    const compacted = t.compactedAt ? new Date(t.compactedAt).toLocaleString() : null;
    const text = [
      `This is thread ${t.id} ("${t.title}"), started ${started}.`,
      `${t.messageCount} message${t.messageCount === 1 ? '' : 's'} so far.`,
      compacted ? `Last compacted ${compacted}.` : 'Not compacted yet.',
      t.summary ? `Summary: ${t.summary}` : '',
    ].filter(Boolean).join(' ');
    return {
      id: t.id, title: t.title, messageCount: t.messageCount,
      startedAt: t.startedAt, lastActiveAt: t.lastActiveAt, compactedAt: t.compactedAt,
      summary: t.summary, text,
    };
  }
}

export const sessionThreadService = new SessionThreadServiceImpl();

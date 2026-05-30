/**
 * ReminderService — AURA Phase 3E
 *
 * Local reminder scheduler with localStorage persistence.
 * Checks due reminders every 60 seconds.
 * Integrates with NotificationService to surface triggered reminders.
 *
 * Security: no secrets stored in reminders.
 */

import type { Reminder, ReminderCategory, ReminderStatus } from '../../types/reminders';
import { notificationService } from '../notifications/NotificationService';

const STORAGE_KEY = 'aura.reminders';
const MAX_REMINDERS = 100;

type ReminderListener = (reminders: Reminder[]) => void;

function uid(): string {
  return `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Reminder[];
  } catch { return []; }
}

function saveReminders(reminders: Reminder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders.slice(0, MAX_REMINDERS)));
  } catch { /* localStorage full */ }
}

class ReminderServiceImpl {
  private reminders: Reminder[] = [];
  private listeners = new Set<ReminderListener>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.reminders = loadReminders();
    this.startPolling();
  }

  // ── Subscribe ──────────────────────────────────────────────────────────────

  subscribe(fn: ReminderListener): () => void {
    this.listeners.add(fn);
    fn([...this.reminders]);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const snap = [...this.reminders];
    for (const fn of this.listeners) fn(snap);
  }

  // ── Add ────────────────────────────────────────────────────────────────────

  add(data: {
    category: ReminderCategory;
    title: string;
    message?: string;
    triggerAt: string | Date;
    linkedId?: string;
    source?: string;
  }): Reminder {
    const r: Reminder = {
      id:        uid(),
      category:  data.category,
      title:     data.title,
      message:   data.message,
      triggerAt: data.triggerAt instanceof Date ? data.triggerAt.toISOString() : data.triggerAt,
      status:    'scheduled',
      createdAt: new Date().toISOString(),
      linkedId:  data.linkedId,
      source:    data.source,
    };
    this.reminders = [r, ...this.reminders].slice(0, MAX_REMINDERS);
    saveReminders(this.reminders);
    this.notify();
    return r;
  }

  /** Shortcut: create a usage-limit-reset reminder */
  addUsageLimitReminder(cli: string, resetAt: Date | string, linkedId?: string): Reminder {
    const resetDate = resetAt instanceof Date ? resetAt : new Date(resetAt);
    return this.add({
      category: 'usage_limit_reset',
      title:    `${cli} usage limit reset`,
      message:  `${cli} should be available again at ${resetDate.toLocaleString()}`,
      triggerAt: resetDate,
      linkedId,
      source:   'AgentSessionService',
    });
  }

  // ── Update status ──────────────────────────────────────────────────────────

  updateStatus(id: string, status: ReminderStatus): void {
    this.reminders = this.reminders.map(r =>
      r.id === id ? { ...r, status } : r
    );
    saveReminders(this.reminders);
    this.notify();
  }

  dismiss(id: string): void { this.updateStatus(id, 'dismissed'); }
  complete(id: string): void { this.updateStatus(id, 'completed'); }

  // ── Query ──────────────────────────────────────────────────────────────────

  getAll(): Reminder[]       { return [...this.reminders]; }
  getDue(): Reminder[]       { return this.reminders.filter(r => r.status === 'triggered'); }
  getScheduled(): Reminder[] { return this.reminders.filter(r => r.status === 'scheduled'); }

  // ── Polling ────────────────────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.checkDue(), 60_000);
  }

  private checkDue(): void {
    const now = Date.now();
    let changed = false;

    this.reminders = this.reminders.map(r => {
      if (r.status !== 'scheduled') return r;
      if (new Date(r.triggerAt).getTime() <= now) {
        changed = true;
        notificationService.add({
          type:    'info',
          title:   r.title,
          message: r.message,
          ttl:     0, // persistent until dismissed
        });
        return { ...r, status: 'triggered' as ReminderStatus };
      }
      return r;
    });

    if (changed) {
      saveReminders(this.reminders);
      this.notify();
    }
  }

  destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const reminderService = new ReminderServiceImpl();

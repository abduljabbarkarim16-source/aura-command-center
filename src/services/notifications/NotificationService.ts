/**
 * NotificationService — AURA Phase 3E
 *
 * Phase 3E additions over Phase 2E:
 *  - Extended severity: info | success | warning | error | approval_required |
 *    task_update | voice_event
 *  - localStorage persistence (key: aura.notification.history), cap 500
 *  - export to JSON
 *  - user can clear persistent history
 *
 * Security: no API keys, no raw audio, no webhook URLs stored in notifications.
 */

import type { AuraNotification, NotificationType, RiskLevel, NotificationAction } from '../../types/notifications';

export type ExtendedNotificationType =
  | NotificationType
  | 'error'
  | 'approval_required'
  | 'task_update'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_blocked'
  | 'usage_limit_detected'
  | 'voice_event';

type Listener = (notifications: AuraNotification[]) => void;

type AddPayload = {
  type: ExtendedNotificationType;
  title: string;
  message?: string;
  riskLevel?: RiskLevel;
  ttl?: number;
  actions?: NotificationAction[];
};

const STORAGE_KEY = 'aura.notification.history';
const MAX_HISTORY = 500;
const MAX_IN_MEMORY = 100;

function loadFromStorage(): AuraNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as AuraNotification[];
  } catch {
    return [];
  }
}

function saveToStorage(notifications: AuraNotification[]): void {
  try {
    // Only persist non-dismissed, capped at MAX_HISTORY
    const toStore = notifications.slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // localStorage full or unavailable — skip silently
  }
}

class NotificationService {
  private notifications: AuraNotification[] = [];
  private listeners = new Set<Listener>();
  private persistenceEnabled = true;

  constructor() {
    // Hydrate from storage on init
    const stored = loadFromStorage();
    // Mark all stored notifications as dismissed so they don't re-toast
    this.notifications = stored.map(n => ({ ...n, dismissed: true })).slice(0, MAX_IN_MEMORY);
  }

  // ─── Subscribe ──────────────────────────────────────────────────────────────

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = [...this.notifications];
    for (const fn of this.listeners) fn(snap);
  }

  // ─── Add ────────────────────────────────────────────────────────────────────

  add(payload: AddPayload): AuraNotification {
    // Coerce extended types to the core NotificationType for display
    const coreType = this.coerceType(payload.type);
    const n: AuraNotification = {
      ...payload,
      type:      coreType,
      id:        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      dismissed: false,
    };

    this.notifications = [n, ...this.notifications].slice(0, MAX_IN_MEMORY);
    this.notify();

    if (this.persistenceEnabled) {
      const allForStorage = loadFromStorage();
      const updated = [n, ...allForStorage].slice(0, MAX_HISTORY);
      saveToStorage(updated);
    }

    if (n.ttl && n.ttl > 0) {
      setTimeout(() => this.dismiss(n.id), n.ttl);
    }

    return n;
  }

  private coerceType(t: ExtendedNotificationType): NotificationType {
    const map: Record<string, NotificationType> = {
      error:             'danger',
      approval_required: 'approval',
      task_update:       'tool',
      task_started:      'info',
      task_completed:    'success',
      task_failed:       'danger',
      task_blocked:      'warning',
      usage_limit_detected: 'warning',
      voice_event:       'relay',
    };
    return (map[t] ?? t) as NotificationType;
  }

  // ─── Dismiss ────────────────────────────────────────────────────────────────

  dismiss(id: string) {
    this.notifications = this.notifications.map(n =>
      n.id === id ? { ...n, dismissed: true } : n
    );
    this.notify();
  }

  dismissAll() {
    this.notifications = this.notifications.map(n => ({ ...n, dismissed: true }));
    this.notify();
  }

  /** Clear in-memory and persisted history */
  clear() {
    this.notifications = [];
    if (this.persistenceEnabled) saveToStorage([]);
    this.notify();
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  getAll(): AuraNotification[]    { return [...this.notifications]; }
  getActive(): AuraNotification[] { return this.notifications.filter(n => !n.dismissed); }
  getUnreadCount(): number        { return this.getActive().length; }

  /** Returns full persisted history (up to MAX_HISTORY) */
  getPersistentHistory(): AuraNotification[] {
    return loadFromStorage();
  }

  /** Export history as JSON string */
  exportJSON(): string {
    return JSON.stringify(this.getPersistentHistory(), null, 2);
  }
}

export const notificationService = new NotificationService();

// ─── Convenience helpers ──────────────────────────────────────────────────────

export function notify(payload: AddPayload) {
  return notificationService.add(payload);
}

export function notifyVoiceError(message: string) {
  return notificationService.add({
    type: 'voice_event',
    title: 'Voice error',
    message,
    riskLevel: 'low',
    ttl: 6000,
  });
}

export function notifyVoiceSuccess(message: string) {
  return notificationService.add({
    type: 'success',
    title: message,
    ttl: 3000,
  });
}

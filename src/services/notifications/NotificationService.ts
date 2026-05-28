/**
 * NotificationService — AURA Phase 2E
 *
 * Lightweight pub/sub notification singleton.
 * No external dependencies, no API calls, no secrets.
 * Stores recent notifications in memory only (not localStorage).
 */

import type { AuraNotification, NotificationType, RiskLevel, NotificationAction } from '../../types/notifications';

type Listener = (notifications: AuraNotification[]) => void;

type AddPayload = {
  type: NotificationType;
  title: string;
  message?: string;
  riskLevel?: RiskLevel;
  ttl?: number;
  actions?: NotificationAction[];
};

class NotificationService {
  private notifications: AuraNotification[] = [];
  private listeners = new Set<Listener>();
  private readonly MAX_HISTORY = 50;

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
    const n: AuraNotification = {
      ...payload,
      id:        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      dismissed: false,
    };

    this.notifications = [n, ...this.notifications].slice(0, this.MAX_HISTORY);
    this.notify();

    if (n.ttl && n.ttl > 0) {
      setTimeout(() => this.dismiss(n.id), n.ttl);
    }

    return n;
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

  clear() {
    this.notifications = [];
    this.notify();
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  getAll(): AuraNotification[]        { return [...this.notifications]; }
  getActive(): AuraNotification[]     { return this.notifications.filter(n => !n.dismissed); }
  getUnreadCount(): number            { return this.getActive().length; }
}

export const notificationService = new NotificationService();

// ─── Convenience helpers ──────────────────────────────────────────────────────

export function notify(payload: AddPayload) {
  return notificationService.add(payload);
}

/**
 * NotificationCenter — AURA Phase 2E
 *
 * Bell icon button + slide-in notification history panel.
 * Rendered inside Voice Core's Zone 1 status strip.
 *
 * No external services. Notification history is in-memory only.
 */

import React, { useEffect, useState, useRef, Fragment } from 'react';
import {
  Bell, X, Check, XCircle, Trash2,
  Info, CheckCircle2, AlertTriangle, AlertCircle,
  ShieldAlert, Wrench, Radio, Database, Settings2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { notificationService } from '../../services/notifications/NotificationService';
import { NOTIFICATION_DISPLAY } from '../../types/notifications';
import type { AuraNotification, NotificationType } from '../../types/notifications';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  info:     <Info         className="w-3.5 h-3.5" />,
  success:  <CheckCircle2 className="w-3.5 h-3.5" />,
  warning:  <AlertTriangle className="w-3.5 h-3.5" />,
  danger:   <AlertCircle  className="w-3.5 h-3.5" />,
  approval: <ShieldAlert  className="w-3.5 h-3.5" />,
  tool:     <Wrench       className="w-3.5 h-3.5" />,
  relay:    <Radio        className="w-3.5 h-3.5" />,
  memory:   <Database     className="w-3.5 h-3.5" />,
  system:   <Settings2    className="w-3.5 h-3.5" />,
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)  return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

// ─── Individual row ───────────────────────────────────────────────────────────

function NotificationRow({ n }: { n: AuraNotification }) {
  const cfg = NOTIFICATION_DISPLAY[n.type];
  return (
    <div className={cn(
      'flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors',
      n.dismissed ? 'opacity-40' : '',
      cfg.border, 'bg-zinc-900/40',
    )}>
      <span className={cn('flex-shrink-0 mt-0.5', cfg.iconColor)}>
        {TYPE_ICON[n.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[12px] font-semibold leading-snug', cfg.titleColor)}>
          {n.title}
        </p>
        {n.message && (
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug truncate">
            {n.message}
          </p>
        )}
        {n.actions && n.actions.length > 0 && !n.dismissed && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {n.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  action.onClick();
                  notificationService.dismiss(n.id);
                }}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors',
                  action.variant === 'approve'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                    : action.variant === 'reject'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700',
                )}
              >
                {action.variant === 'approve' && <Check className="w-2.5 h-2.5" />}
                {action.variant === 'reject'  && <XCircle className="w-2.5 h-2.5" />}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[10px] text-zinc-600">{timeAgo(n.timestamp)}</span>
        {!n.dismissed && (
          <button
            onClick={() => notificationService.dismiss(n.id)}
            className="text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── NotificationCenter ───────────────────────────────────────────────────────

export function NotificationCenter() {
  const [isOpen,        setIsOpen]        = useState(false);
  const [notifications, setNotifications] = useState<AuraNotification[]>([]);
  const [unread,        setUnread]        = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return notificationService.subscribe(all => {
      setNotifications(all);
      setUnread(all.filter(n => !n.dismissed).length);
    });
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className={cn(
          'relative flex items-center justify-center w-8 h-8 rounded-full border transition-all',
          isOpen
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
            : 'bg-zinc-900/70 border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
        )}
        aria-label="Notifications"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[9px] font-bold rounded-full bg-amber-500 text-zinc-950 px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Slide-down panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[13px] font-semibold text-zinc-200">Notifications</span>
                {unread > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/25 text-amber-400 rounded-full">
                    {unread}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button
                    onClick={() => notificationService.clear()}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
              {notifications.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-[12px] text-zinc-600">
                  No notifications
                </div>
              ) : (
                notifications.map(n => (
                  <Fragment key={n.id}>
                    <NotificationRow n={n} />
                  </Fragment>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

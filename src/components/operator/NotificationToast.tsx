/**
 * NotificationToast — AURA Phase 2E
 *
 * Renders a stack of active (non-dismissed) toast notifications.
 * Position: bottom-right by default, configurable via prop.
 * Toasts auto-dismiss per their ttl; user can also dismiss manually.
 *
 * No external services. No secrets in notification text.
 */

import React, { useEffect, useState, Fragment } from 'react';
import {
  Info, CheckCircle2, AlertTriangle, AlertCircle,
  ShieldAlert, Wrench, Radio, Database, Settings2, X,
  Check, XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { notificationService } from '../../services/notifications/NotificationService';
import { NOTIFICATION_DISPLAY } from '../../types/notifications';
import type { AuraNotification, NotificationType } from '../../types/notifications';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  info:     <Info      className="w-4 h-4" />,
  success:  <CheckCircle2 className="w-4 h-4" />,
  warning:  <AlertTriangle className="w-4 h-4" />,
  danger:   <AlertCircle  className="w-4 h-4" />,
  approval: <ShieldAlert  className="w-4 h-4" />,
  tool:     <Wrench       className="w-4 h-4" />,
  relay:    <Radio        className="w-4 h-4" />,
  memory:   <Database     className="w-4 h-4" />,
  system:   <Settings2    className="w-4 h-4" />,
};

// ─── Single toast ─────────────────────────────────────────────────────────────

function ToastItem({ n }: { n: AuraNotification }) {
  const [visible, setVisible] = useState(false);
  const cfg = NOTIFICATION_DISPLAY[n.type];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl',
        'transition-all duration-300 w-80 max-w-full',
        cfg.bg, cfg.border,
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
      )}
    >
      {/* Icon */}
      <span className={cn('flex-shrink-0 mt-0.5', cfg.iconColor)}>
        {TYPE_ICON[n.type]}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-[13px] font-semibold leading-snug', cfg.titleColor)}>
          {n.title}
        </p>
        {n.message && (
          <p className={cn('text-[12px] mt-0.5 leading-snug', cfg.messageColor)}>
            {n.message}
          </p>
        )}

        {/* Actions */}
        {n.actions && n.actions.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            {n.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  action.onClick();
                  notificationService.dismiss(n.id);
                }}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors',
                  action.variant === 'approve'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                    : action.variant === 'reject'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                    : 'bg-zinc-800/80 border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/80',
                )}
              >
                {action.variant === 'approve' && <Check className="w-3 h-3" />}
                {action.variant === 'reject'  && <XCircle className="w-3 h-3" />}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => notificationService.dismiss(n.id)}
        className="flex-shrink-0 mt-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Toast stack ──────────────────────────────────────────────────────────────

export interface NotificationToastProps {
  /** Max simultaneous toasts visible */
  maxVisible?: number;
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
}

export function NotificationToast({
  maxVisible = 4,
  position = 'top-right',
}: NotificationToastProps) {
  const [notifications, setNotifications] = useState<AuraNotification[]>([]);

  useEffect(() => {
    return notificationService.subscribe(all => {
      setNotifications(all.filter(n => !n.dismissed).slice(0, maxVisible));
    });
  }, [maxVisible]);

  if (notifications.length === 0) return null;

  const posClass = {
    'top-right':    'top-4 right-4 flex-col',
    'bottom-right': 'bottom-20 right-4 flex-col-reverse',
    'top-left':     'top-4 left-4 flex-col',
    'bottom-left':  'bottom-20 left-4 flex-col-reverse',
  }[position];

  return (
    <div className={cn('fixed z-50 flex gap-2 pointer-events-none', posClass)}>
      {notifications.map(n => (
        <Fragment key={n.id}>
          <div className="pointer-events-auto">
            <ToastItem n={n} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

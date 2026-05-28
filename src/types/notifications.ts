/**
 * AURA Notification Types
 *
 * Color-coded by type and risk. No secrets in notification text.
 * Surfaces: toast (corner), banner (persistent), center (history).
 */

export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'approval'
  | 'tool'
  | 'relay'
  | 'memory'
  | 'system';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface NotificationAction {
  label: string;
  variant?: 'default' | 'approve' | 'reject';
  onClick: () => void;
}

export interface AuraNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  riskLevel?: RiskLevel;
  timestamp: number;
  dismissed: boolean;
  /** Auto-dismiss after N ms. Omit for persistent. */
  ttl?: number;
  actions?: NotificationAction[];
}

// ─── Display config per type ──────────────────────────────────────────────────

export interface NotificationDisplayConfig {
  border: string;
  bg: string;
  iconColor: string;
  titleColor: string;
  messageColor: string;
  dot: string;
}

export const NOTIFICATION_DISPLAY: Record<NotificationType, NotificationDisplayConfig> = {
  info:     { border: 'border-zinc-700/60',    bg: 'bg-zinc-900/90',      iconColor: 'text-zinc-400',    titleColor: 'text-zinc-200',  messageColor: 'text-zinc-400',  dot: 'bg-zinc-500'    },
  success:  { border: 'border-emerald-500/30', bg: 'bg-zinc-900/90',      iconColor: 'text-emerald-400', titleColor: 'text-zinc-100',  messageColor: 'text-zinc-400',  dot: 'bg-emerald-400' },
  warning:  { border: 'border-amber-500/30',   bg: 'bg-zinc-900/90',      iconColor: 'text-amber-400',   titleColor: 'text-zinc-100',  messageColor: 'text-zinc-400',  dot: 'bg-amber-400'   },
  danger:   { border: 'border-rose-500/40',    bg: 'bg-zinc-900/90',      iconColor: 'text-rose-400',    titleColor: 'text-rose-200',  messageColor: 'text-zinc-400',  dot: 'bg-rose-400'    },
  approval: { border: 'border-amber-500/40',   bg: 'bg-amber-950/50',     iconColor: 'text-amber-400',   titleColor: 'text-amber-100', messageColor: 'text-amber-300/70', dot: 'bg-amber-400' },
  tool:     { border: 'border-zinc-700/50',    bg: 'bg-zinc-900/90',      iconColor: 'text-zinc-500',    titleColor: 'text-zinc-200',  messageColor: 'text-zinc-500',  dot: 'bg-zinc-600'    },
  relay:    { border: 'border-sky-500/30',     bg: 'bg-zinc-900/90',      iconColor: 'text-sky-400',     titleColor: 'text-zinc-100',  messageColor: 'text-zinc-400',  dot: 'bg-sky-400'     },
  memory:   { border: 'border-indigo-500/25',  bg: 'bg-zinc-900/90',      iconColor: 'text-indigo-400',  titleColor: 'text-zinc-200',  messageColor: 'text-zinc-400',  dot: 'bg-indigo-400'  },
  system:   { border: 'border-zinc-700/40',    bg: 'bg-zinc-900/90',      iconColor: 'text-zinc-500',    titleColor: 'text-zinc-300',  messageColor: 'text-zinc-500',  dot: 'bg-zinc-600'    },
};

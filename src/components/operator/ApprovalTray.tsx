/**
 * ApprovalTray — Right-side slide-in approval panel for Voice Core
 *
 * Positioned absolutely on the right edge of the Voice Core container.
 * The center visualizer (Zone 3 orb) is never obscured at 1366×768 —
 * the tray is 288px wide anchored to the right edge; the orb is centred
 * in a container that is typically 900-1300px wide, so there is no overlap.
 *
 * Opened by clicking the "1 Approval" badge in Zone 1.
 * Returns null when `isOpen` is false (no layout impact while hidden).
 *
 * Risk → color mapping
 *   low      → emerald
 *   medium   → amber
 *   high     → red
 *   critical → rose
 */

import React from 'react';
import { X, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ApprovalCard, type ApprovalCardProps } from './ApprovalCard';

// ─── Risk color tokens ────────────────────────────────────────────────────────

const RISK_TRAY: Record<string, { border: string; header: string }> = {
  low:      { border: 'border-emerald-500/35', header: 'text-emerald-400' },
  medium:   { border: 'border-amber-500/40',   header: 'text-amber-400'   },
  high:     { border: 'border-red-500/45',     header: 'text-red-400'     },
  critical: { border: 'border-rose-500/50',    header: 'text-rose-400'    },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ApprovalTrayProps {
  /** When false the component returns null — no layout impact. */
  isOpen: boolean;
  onClose: () => void;
  /** Core approval data — mirrors ApprovalCardProps minus action callbacks. */
  approval: Omit<ApprovalCardProps, 'status' | 'onApprove' | 'onReject' | 'onDetails'>;
  status: 'pending' | 'approved' | 'rejected';
  onApprove?: () => void;
  onReject?: () => void;
  onDetails?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApprovalTray({
  isOpen,
  onClose,
  approval,
  status,
  onApprove,
  onReject,
  onDetails,
}: ApprovalTrayProps) {
  if (!isOpen) return null;

  const risk = RISK_TRAY[approval.riskLevel] ?? RISK_TRAY.medium;

  return (
    <div
      className={cn(
        // Absolute position — right side, clear of Zone 1 (top-14) and Zone 5 (bottom-24)
        'absolute right-3 top-14 bottom-24 z-20',
        'w-72 flex flex-col',
        // Entrance — slide in from the right
        'animate-in slide-in-from-right-4 duration-300 ease-out',
      )}
    >
      <div
        className={cn(
          'flex flex-col h-full rounded-xl border shadow-2xl overflow-hidden',
          'bg-zinc-950/90 backdrop-blur-md',
          risk.border,
        )}
      >
        {/* ── Tray header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className={cn('w-3.5 h-3.5', risk.header)} />
            <span className={cn('text-[12px] font-semibold', risk.header)}>
              Pending Approval
            </span>
            {status === 'pending' && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </div>
          <button
            onClick={onClose}
            title="Dismiss tray"
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded hover:bg-zinc-800/60"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Scrollable card body ─────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <ApprovalCard
            {...approval}
            status={status}
            onApprove={onApprove}
            onReject={onReject}
            onDetails={onDetails}
          />
        </div>
      </div>
    </div>
  );
}

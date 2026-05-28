/**
 * AuraVoiceCore — Phase 2E Voice Core
 *
 * Direct default screen — no initiation gate.
 * Startup greeting fires ONCE per browser session (sessionStorage guard).
 * TTS is disabled by default; enabled only if settings.textToSpeechEnabled.
 * Notification toasts appear top-right to avoid overlapping the visualizer.
 * Zone 3 center is reserved for the audio-reactive visualizer — no thought cards.
 *
 * Layout: 5 explicit flex zones.
 *  Zone 1 — absolute status strip (no flex height)
 *  Zone 2 — mission card (shrink-0)
 *  Zone 3 — orb + admin indicator (flex-1, center reserved for visualizer)
 *  Zone 4 — REMOVED: approval cards no longer live in the center flow.
 *            ApprovalTray renders as an absolute right-side panel instead.
 *  Zone 5 — bottom action strip (shrink-0)
 */

import React, { useState, useEffect, Fragment } from 'react';
import {
  Mic, MicOff, Terminal, Settings2, LayoutGrid,
  Shield, Bot, Database, Wrench, ChevronDown, ChevronUp, Eye,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AuraVoiceVisualizer, type VisualizerState } from './AuraVoiceVisualizer';
import { AdminVoiceIndicator, type AdminVoiceState } from './AdminVoiceIndicator';
import { ApprovalTray } from './ApprovalTray';
import type { ApprovalCardProps } from './ApprovalCard';
import { NotificationCenter } from './NotificationCenter';
import { NotificationToast } from './NotificationToast';
import { notificationService } from '../../services/notifications/NotificationService';

// ─── Session guard key ────────────────────────────────────────────────────────

/** Prevents the startup greeting from repeating on re-mount or hot reload. */
const GREETING_SESSION_KEY = 'aura_greeting_shown';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_MISSION = {
  name:     'AURA Phase 2E',
  progress:  72,
  agent:    'Claude Architect',
  phase:    'Voice Core',
};

const MOCK_STATUS_CHIPS = [
  { id: 'memory', icon: <Database className="w-3 h-3" />, label: 'Memory', value: 'Active',      color: 'text-emerald-400' },
  { id: 'relay',  icon: <Wrench   className="w-3 h-3" />, label: 'Relay',  value: 'Ready',       color: 'text-amber-400'  },
  { id: 'tools',  icon: <Shield   className="w-3 h-3" />, label: 'Tools',  value: 'Locked',      color: 'text-zinc-500'   },
  { id: 'agent',  icon: <Bot      className="w-3 h-3" />, label: 'Agent',  value: 'Standing by', color: 'text-indigo-400' },
];

const MOCK_APPROVAL: ApprovalCardProps = {
  title:           'Run read_file',
  summary:         'Claude Architect requests permission to read a local project file.',
  riskLevel:       'medium',
  requestedAction: 'read_file(path=./src/pages/Console.tsx)',
  sourceAgent:     'Claude Architect',
  targetAgent:     'local-shell',
};

// ─── Approval badge risk colors (Zone 1) ─────────────────────────────────────

const BADGE_RISK: Record<string, { bg: string; border: string; text: string }> = {
  low:      { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  medium:   { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400'  },
  high:     { bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-400'    },
  critical: { bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-400'   },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuraVoiceCoreProps {
  auraState?: VisualizerState;
  adminVoiceState?: AdminVoiceState;
  safeMonitorMode?: boolean;
  onOpenConsole: () => void;
  onOpenAdminPanel: () => void;
  onOpenTechnicalDrawer: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AuraVoiceCore({
  auraState = 'idle',
  adminVoiceState: externalAdminState,
  safeMonitorMode: externalSafeMode,
  onOpenConsole,
  onOpenAdminPanel,
  onOpenTechnicalDrawer,
}: AuraVoiceCoreProps) {
  const [isMuted,           setIsMuted]           = useState(false);
  const [isListening,       setIsListening]       = useState(false);
  const [approvalDismissed, setApprovalDismissed] = useState(false);
  const [approvalStatus,    setApprovalStatus]    = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isTrayOpen,        setIsTrayOpen]        = useState(false);
  const [missionExpanded,   setMissionExpanded]   = useState(false);
  const [safeMode,          setSafeMode]          = useState(externalSafeMode ?? false);

  const effectiveAuraState: VisualizerState =
    auraState !== 'idle' ? auraState : isListening ? 'listening' : 'idle';

  const adminState: AdminVoiceState = externalAdminState ?? (
    isMuted ? 'muted' : isListening ? 'speaking' : 'idle'
  );

  const showApproval     = !approvalDismissed && approvalStatus === 'pending';
  const showPostDecision = !approvalDismissed && approvalStatus !== 'pending';

  const handleMicToggle = () => { if (!isMuted) setIsListening(p => !p); };
  const handleApprove   = () => { setApprovalStatus('approved'); setTimeout(() => setApprovalDismissed(true), 1200); };
  const handleReject    = () => { setApprovalStatus('rejected'); setTimeout(() => setApprovalDismissed(true), 1200); };

  // ── Startup greeting — fires once per browser session ─────────
  useEffect(() => {
    // sessionStorage persists for the tab lifetime; prevents repeated greetings
    // on React re-mounts, Vite HMR, or navigation back to Voice Core.
    if (sessionStorage.getItem(GREETING_SESSION_KEY)) return;
    sessionStorage.setItem(GREETING_SESSION_KEY, '1');

    notificationService.add({
      type:  'success',
      title: "I'm here. Ready to assist.",
      ttl:   5000,
    });

    // ── TTS: disabled by default in Phase 2E ──────────────────────────────
    // Browser speechSynthesis is a fallback-quality option only.
    // Do NOT enable by default — it degrades the experience on most systems.
    //
    // Future: read settings.textToSpeechEnabled && !settings.assistantMuted
    // then choose the configured provider (OpenAI TTS, ElevenLabs, Windows TTS, etc.)
    // See docs/aura-premium-ui-design-brief.md §15 for the Voice Output Quality Plan.
    //
    // const ttsEnabled = settings?.textToSpeechEnabled && !settings?.assistantMuted;
    // if (ttsEnabled) { ... }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn(
      'relative flex flex-col h-full min-h-0 w-full overflow-hidden',
      'bg-gradient-to-b from-zinc-950 via-zinc-950 to-indigo-950/10',
    )}>

      {/* ── Toast layer — top-right, does not overlap visualizer ─── */}
      <NotificationToast position="top-right" maxVisible={3} />

      {/* ── ZONE 1: Absolute status strip ───────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-2.5 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {MOCK_STATUS_CHIPS.map(chip => (
            <Fragment key={chip.id}>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/80 border border-zinc-800/60 rounded-full backdrop-blur-sm">
                <span className={chip.color}>{chip.icon}</span>
                <span className="text-[11px] text-zinc-500 font-medium">{chip.label}</span>
                <span className={cn('text-[11px] font-semibold', chip.color)}>{chip.value}</span>
              </div>
            </Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {safeMode && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full">
              <Eye className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-amber-400 font-semibold">Safe Monitor</span>
              <button
                onClick={() => setSafeMode(false)}
                className="ml-0.5 text-amber-500/60 hover:text-amber-300 transition-colors leading-none text-[12px]"
                title="Exit safe monitor mode"
              >
                ×
              </button>
            </div>
          )}
          {showApproval && (() => {
            const badge = BADGE_RISK[MOCK_APPROVAL.riskLevel] ?? BADGE_RISK.medium;
            return (
              <button
                onClick={() => setIsTrayOpen(p => !p)}
                title={isTrayOpen ? 'Hide approval' : 'Show approval'}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors',
                  badge.bg, badge.border,
                  !isTrayOpen && 'animate-pulse',
                )}
              >
                <Shield className={cn('w-3 h-3', badge.text)} />
                <span className={cn('text-[11px] font-semibold', badge.text)}>1 Approval</span>
              </button>
            );
          })()}
          {/* Notification bell */}
          <NotificationCenter />
        </div>
      </div>

      {/* ── ZONE 2: Mission card — shrink-0 ─────────────────────────── */}
      <div className="shrink-0 pt-12 pb-1 px-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setMissionExpanded(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:bg-zinc-900/80 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
              <span className="text-[12px] text-zinc-500 font-medium flex-shrink-0">Mission</span>
              <span className="text-[13px] font-semibold text-zinc-200 truncate">{MOCK_MISSION.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3 h-3 text-indigo-400" />
                <span className="text-[11px] text-indigo-400 font-medium">{MOCK_MISSION.agent}</span>
              </div>
              {missionExpanded
                ? <ChevronUp   className="w-3.5 h-3.5 text-zinc-500" />
                : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              }
            </div>
          </button>

          {missionExpanded && (
            <div className="px-4 py-3 bg-zinc-900/50 border border-zinc-800/40 border-t-0 rounded-b-xl animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-zinc-500">Phase</span>
                <span className="text-[11px] text-zinc-300 font-medium">{MOCK_MISSION.phase}</span>
                <span className="ml-auto text-[11px] text-zinc-500">{MOCK_MISSION.progress}%</span>
              </div>
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${MOCK_MISSION.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ZONE 3: Orb + admin indicator — flex-1 ──────────────────── */}
      {/* Center reserved exclusively for the audio-reactive visualizer.  */}
      {/* Thought cards are not auto-displayed here; they surface via     */}
      {/* the NotificationCenter or event-driven AuraThoughtStack calls.  */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-2">
        <div className="flex flex-col items-center gap-3 z-10">
          <AuraVoiceVisualizer
            state={effectiveAuraState}
            size="xl"
            showLabel
          />
          <AdminVoiceIndicator state={adminState} />
        </div>
      </div>

      {/* ── ZONE 4 REMOVED — approval cards no longer block the center ── */}
      {/* Approvals now surface via ApprovalTray (absolute right panel).   */}

      {/* ── ApprovalTray — absolute right-side panel, z-20 ──────────── */}
      <ApprovalTray
        isOpen={isTrayOpen && (showApproval || showPostDecision)}
        onClose={() => setIsTrayOpen(false)}
        approval={MOCK_APPROVAL}
        status={approvalStatus}
        onApprove={handleApprove}
        onReject={handleReject}
        onDetails={onOpenTechnicalDrawer}
      />

      {/* ── ZONE 5: Bottom action strip — shrink-0 ──────────────────── */}
      <div className="shrink-0 px-4 pt-2 pb-5 bg-gradient-to-t from-zinc-950/80 via-zinc-950/40 to-transparent">
        <div className="max-w-lg mx-auto flex flex-col gap-2.5">

          {/* Mute + Speak */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setIsMuted(p => !p)}
              title={isMuted ? 'Unmute' : 'Mute'}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full border transition-all flex-shrink-0',
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-zinc-900/80 border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
              )}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <MicOff className="w-4 h-4 opacity-40" />}
            </button>

            <button
              onClick={handleMicToggle}
              disabled={isMuted}
              className={cn(
                'flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-semibold text-[14px] transition-all shadow-lg',
                isMuted && 'opacity-40 cursor-not-allowed',
                isListening
                  ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25',
              )}
            >
              <Mic className="w-4 h-4" />
              {isListening ? 'Stop' : 'Speak'}
            </button>
          </div>

          {/* Secondary actions */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={onOpenConsole}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600',
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
              Console
            </button>

            <button
              onClick={onOpenAdminPanel}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600',
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Admin
            </button>

            <button
              onClick={onOpenTechnicalDrawer}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600',
              )}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Details
            </button>

            {/* Safe monitor compact toggle */}
            <button
              onClick={() => setSafeMode(p => !p)}
              title={safeMode ? 'Exit safe monitor' : 'Enter safe monitor'}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                safeMode
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 hover:border-zinc-600',
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              {safeMode ? 'Safe On' : 'Safe'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AuraVoiceCore — Phase 2F Voice Runtime Foundation
 *
 * All mutable voice state is now owned by VoiceRuntimeService and consumed
 * via useVoiceRuntime(). Local component state is limited to pure UI concerns:
 *   isTrayOpen      — approval tray visibility
 *   missionExpanded — mission card expansion
 *
 * Runtime → component mapping:
 *   runtime.state             → VisualizerState (via RUNTIME_TO_VISUALIZER)
 *   runtime.activeSpeaker     → AdminVoiceIndicator state + visualizer source
 *   runtime.pendingApprovals  → badge count, tray content
 *   runtime.isMuted           → mic button state
 *   runtime.isSafeMode        → safe monitor chip
 *   runtime.mission           → mission card data
 *
 * Notification bridge: handled inside VoiceRuntimeService — events
 * (approval_requested, error, relay_ready, etc.) fire notificationService.add()
 * automatically. This component only renders what the runtime exposes.
 *
 * Demo controls (Zone 5 secondary row):
 *   Demo ▶  — runs a full listen→think→speak→approval sequence
 *   Reset   — clears all runtime events and approvals
 *
 * Layout: 5 explicit flex zones (Zone 4 removed — approvals are in ApprovalTray).
 *  Zone 1 — absolute status strip
 *  Zone 2 — mission card (shrink-0)
 *  Zone 3 — orb + admin indicator (flex-1, center reserved for visualizer)
 *  Zone 5 — bottom action strip (shrink-0)
 */

import React, { useState, useEffect, useRef, Fragment } from 'react';
import {
  Mic, MicOff, Terminal, Settings2, LayoutGrid,
  Shield, Bot, Database, Wrench, ChevronDown, ChevronUp,
  Eye, Play, RotateCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AuraVoiceVisualizer } from './AuraVoiceVisualizer';
import type { VisualizerState } from './AuraVoiceVisualizer';
import { AdminVoiceIndicator } from './AdminVoiceIndicator';
import type { AdminVoiceState } from './AdminVoiceIndicator';
import { ApprovalTray } from './ApprovalTray';
import { NotificationCenter } from './NotificationCenter';
import { NotificationToast } from './NotificationToast';
import { useVoiceRuntime } from '../../hooks/useVoiceRuntime';
import type { VoiceRuntimeState } from '../../types/voice-runtime';

// ─── Session guard key ────────────────────────────────────────────────────────

const GREETING_SESSION_KEY = 'aura_greeting_shown';

// ─── State mapping tables ─────────────────────────────────────────────────────

/** Maps VoiceRuntimeState → VisualizerState for the orb animation */
const RUNTIME_TO_VISUALIZER: Record<VoiceRuntimeState, VisualizerState> = {
  ready:               'idle',
  muted:               'idle',
  listening:           'listening',
  thinking:            'thinking',
  speaking:            'speaking',
  waiting_for_approval:'waiting_for_approval',
  executing:           'executing',
  error:               'error',
};

/** Badge risk → color tokens for Zone 1 approval indicator */
const BADGE_RISK: Record<string, { bg: string; border: string; text: string }> = {
  low:      { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  medium:   { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400'  },
  high:     { bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-400'    },
  critical: { bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-400'   },
};

// ─── Status chips (static labels, values driven by runtime in future) ─────────

const MOCK_STATUS_CHIPS = [
  { id: 'memory', icon: <Database className="w-3 h-3" />, label: 'Memory', value: 'Active',      color: 'text-emerald-400' },
  { id: 'relay',  icon: <Wrench   className="w-3 h-3" />, label: 'Relay',  value: 'Ready',       color: 'text-amber-400'  },
  { id: 'tools',  icon: <Shield   className="w-3 h-3" />, label: 'Tools',  value: 'Locked',      color: 'text-zinc-500'   },
  { id: 'agent',  icon: <Bot      className="w-3 h-3" />, label: 'Agent',  value: 'Standing by', color: 'text-indigo-400' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuraVoiceCoreProps {
  /**
   * External visualizer state override — kept for backward compat with Console.tsx.
   * In Phase 2F the runtime state takes precedence; this prop is unused.
   * @deprecated Use VoiceRuntimeService.setState() instead.
   */
  auraState?: VisualizerState;
  /** @deprecated Runtime manages admin voice state directly. */
  adminVoiceState?: AdminVoiceState;
  /** @deprecated Runtime manages safe-mode. */
  safeMonitorMode?: boolean;
  onOpenConsole: () => void;
  onOpenAdminPanel: () => void;
  onOpenTechnicalDrawer: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AuraVoiceCore({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  auraState: _auraStateProp,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  adminVoiceState: _adminVoiceStateProp,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  safeMonitorMode: _safeModeFromProp,
  onOpenConsole,
  onOpenAdminPanel,
  onOpenTechnicalDrawer,
}: AuraVoiceCoreProps) {

  // ── Runtime ────────────────────────────────────────────────────────────────
  const runtime = useVoiceRuntime();

  // ── Local UI state (not runtime concerns) ─────────────────────────────────
  const [isTrayOpen,      setIsTrayOpen]      = useState(false);
  const [missionExpanded, setMissionExpanded] = useState(false);

  // Greeting guard — fires once per browser session
  const greetedRef = useRef(false);

  // ── Derived runtime values ─────────────────────────────────────────────────

  const visualizerState: VisualizerState =
    RUNTIME_TO_VISUALIZER[runtime.state] ?? 'idle';

  const adminState: AdminVoiceState = (() => {
    if (runtime.isMuted) return 'muted';
    if (runtime.activeSpeaker === 'admin') return 'speaking';
    return 'idle';
  })();

  // Source accent for the SVG spectrum ring (who is speaking)
  const visualizerSource: 'aura' | 'admin' | 'system' = (() => {
    if (runtime.activeSpeaker === 'admin') return 'admin';
    if (runtime.activeSpeaker === 'system') return 'system';
    return 'aura';
  })();

  // Approvals
  const allApprovals  = runtime.pendingApprovals;
  const pendingCount  = allApprovals.filter(a => a.status === 'pending').length;
  // Show the first pending one; fall back to first resolved (brief display window)
  const activeTrayApproval =
    allApprovals.find(a => a.status === 'pending') ??
    allApprovals.find(a => a.status !== 'pending');

  // Risk of the most urgent pending approval (for badge color)
  const trayRiskLevel = activeTrayApproval?.riskLevel ?? 'medium';

  // ── Side effects ───────────────────────────────────────────────────────────

  // Startup greeting — once per session
  useEffect(() => {
    if (greetedRef.current) return;
    if (sessionStorage.getItem(GREETING_SESSION_KEY)) {
      greetedRef.current = true;
      return;
    }
    greetedRef.current = true;
    sessionStorage.setItem(GREETING_SESSION_KEY, '1');

    runtime.addRuntimeNotification({
      type:  'success',
      title: "I'm here. Ready to assist.",
      ttl:   5000,
    });
    // ── TTS: disabled by default in Phase 2F ──────────────────────────────
    // Real TTS integrates via VoiceRuntimeService.startSpeaking() in a future phase.
    // See docs/voice-runtime-architecture.md §Future STT/TTS integration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-close tray when all approvals drain
  useEffect(() => {
    if (allApprovals.length === 0) setIsTrayOpen(false);
  }, [allApprovals.length]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSpeakToggle = () => {
    if (runtime.state === 'listening') {
      runtime.stopListening();
    } else {
      runtime.startListening();
    }
  };

  const handleMuteToggle = () => runtime.toggleMuted();

  const handleApprove = () => {
    if (activeTrayApproval) runtime.resolveApproval(activeTrayApproval.id, 'approved');
  };

  const handleReject = () => {
    if (activeTrayApproval) runtime.resolveApproval(activeTrayApproval.id, 'rejected');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={cn(
      'relative flex flex-col h-full min-h-0 w-full overflow-hidden',
      'bg-gradient-to-b from-zinc-950 via-zinc-950 to-indigo-950/10',
    )}>

      {/* ── Toast layer — top-right, does not overlap visualizer ─── */}
      <NotificationToast position="top-right" maxVisible={3} />

      {/* ── ZONE 1: Absolute status strip ───────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-2.5 pointer-events-none">

        {/* Left: status chips */}
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

        {/* Right: safe-mode chip, approval badge, notification bell */}
        <div className="flex items-center gap-2 pointer-events-auto">

          {/* Safe Monitor chip */}
          {runtime.isSafeMode && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full">
              <Eye className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-amber-400 font-semibold">Safe Monitor</span>
              <button
                onClick={() => runtime.toggleSafeMode()}
                className="ml-0.5 text-amber-500/60 hover:text-amber-300 transition-colors leading-none text-[12px]"
                title="Exit safe monitor mode"
              >
                ×
              </button>
            </div>
          )}

          {/* Approval badge — clickable, risk-colored, no pulse when tray is open */}
          {pendingCount > 0 && (() => {
            const badge = BADGE_RISK[trayRiskLevel] ?? BADGE_RISK.medium;
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
                <span className={cn('text-[11px] font-semibold', badge.text)}>
                  {pendingCount} Approval{pendingCount > 1 ? 's' : ''}
                </span>
              </button>
            );
          })()}

          {/* Notification history bell */}
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
              <span className="text-[13px] font-semibold text-zinc-200 truncate">
                {runtime.mission.name}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3 h-3 text-indigo-400" />
                <span className="text-[11px] text-indigo-400 font-medium">
                  {runtime.mission.agent}
                </span>
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
                <span className="text-[11px] text-zinc-300 font-medium">{runtime.mission.phase}</span>
                <span className="ml-auto text-[11px] text-zinc-500">{runtime.mission.progress}%</span>
              </div>
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${runtime.mission.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ZONE 3: Orb + admin indicator — flex-1 (center reserved) ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-2">
        <div className="flex flex-col items-center gap-3 z-10">
          <AuraVoiceVisualizer
            state={visualizerState}
            source={visualizerSource}
            size="xl"
            showLabel
          />
          <AdminVoiceIndicator state={adminState} />
        </div>
      </div>

      {/* ── ApprovalTray — absolute right-side panel, z-20 ──────────── */}
      {activeTrayApproval && (
        <ApprovalTray
          isOpen={isTrayOpen}
          onClose={() => setIsTrayOpen(false)}
          approval={activeTrayApproval}
          status={activeTrayApproval.status}
          onApprove={handleApprove}
          onReject={handleReject}
          onDetails={onOpenTechnicalDrawer}
        />
      )}

      {/* ── ZONE 5: Bottom action strip — shrink-0 ──────────────────── */}
      <div className="shrink-0 px-4 pt-2 pb-5 bg-gradient-to-t from-zinc-950/80 via-zinc-950/40 to-transparent">
        <div className="max-w-lg mx-auto flex flex-col gap-2.5">

          {/* Mute + Speak */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleMuteToggle}
              title={runtime.isMuted ? 'Unmute' : 'Mute'}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full border transition-all flex-shrink-0',
                runtime.isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-zinc-900/80 border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
              )}
            >
              {runtime.isMuted
                ? <MicOff className="w-4 h-4" />
                : <MicOff className="w-4 h-4 opacity-40" />
              }
            </button>

            <button
              onClick={handleSpeakToggle}
              disabled={runtime.isMuted}
              className={cn(
                'flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-semibold text-[14px] transition-all shadow-lg',
                runtime.isMuted && 'opacity-40 cursor-not-allowed',
                runtime.state === 'listening'
                  ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25',
              )}
            >
              <Mic className="w-4 h-4" />
              {runtime.state === 'listening' ? 'Stop' : 'Speak'}
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

            {/* Safe monitor toggle */}
            <button
              onClick={() => runtime.toggleSafeMode()}
              title={runtime.isSafeMode ? 'Exit safe monitor' : 'Enter safe monitor'}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                runtime.isSafeMode
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 hover:border-zinc-600',
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              {runtime.isSafeMode ? 'Safe On' : 'Safe'}
            </button>

            {/* ── Dev/demo controls ─────────────────────────────────── */}

            <button
              onClick={() => runtime.runDemoSequence()}
              title="Run demo sequence (listen → think → speak → approval)"
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/40 text-zinc-600 hover:bg-zinc-800 hover:text-indigo-400 hover:border-zinc-600',
              )}
            >
              <Play className="w-3 h-3" />
              Demo
            </button>

            <button
              onClick={() => runtime.clearRuntime()}
              title="Clear all runtime events and approvals"
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/40 text-zinc-600 hover:bg-zinc-800 hover:text-rose-400 hover:border-zinc-600',
              )}
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AuraVoiceCore — Phase 2E Voice Core
 *
 * The primary AURA experience surface.
 * Voice presence is the default view after launch — not the chat console.
 *
 * Principles:
 * - Large AURA voice visualizer dominates
 * - Minimal chrome by default
 * - Thought cards surface briefly
 * - Approval cards appear prominently when pending
 * - Console / Admin Panel opened only when needed
 *
 * No real microphone capture. No real agent execution. Mock state throughout.
 */

import React, { useState, Fragment } from 'react';
import {
  Mic, MicOff, Terminal, Settings2, LayoutGrid,
  Shield, Bot, Database, Wrench, ChevronDown, ChevronUp,
  Eye,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AuraVoiceVisualizer, type VisualizerState } from './AuraVoiceVisualizer';
import { AdminVoiceIndicator, type AdminVoiceState } from './AdminVoiceIndicator';
import { AuraThoughtStack } from './AuraThoughtCard';
import { ApprovalCard, type ApprovalCardProps } from './ApprovalCard';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_MISSION = {
  name:     'AURA Phase 2E',
  progress:  72,
  agent:    'Claude Architect',
  phase:    'Voice Core',
};

const MOCK_STATUS_CHIPS = [
  { id: 'memory',  icon: <Database className="w-3 h-3" />, label: 'Memory',  value: 'Online',  color: 'text-emerald-400' },
  { id: 'relay',   icon: <Wrench   className="w-3 h-3" />, label: 'Relay',   value: 'Ready',   color: 'text-amber-400'   },
  { id: 'tools',   icon: <Shield   className="w-3 h-3" />, label: 'Tools',   value: 'Locked',  color: 'text-zinc-500'    },
  { id: 'agent',   icon: <Bot      className="w-3 h-3" />, label: 'Agent',   value: 'Active',  color: 'text-indigo-400'  },
];

const MOCK_APPROVAL: ApprovalCardProps = {
  title:           'Run read_file Tool',
  summary:         'Claude Architect requests permission to read a local project file to continue the Phase 2E implementation.',
  riskLevel:       'medium',
  requestedAction: 'read_file(path=./src/pages/Console.tsx)',
  sourceAgent:     'Claude Architect',
  targetAgent:     'local-shell',
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
  safeMonitorMode = false,
  onOpenConsole,
  onOpenAdminPanel,
  onOpenTechnicalDrawer,
}: AuraVoiceCoreProps) {
  const [isMuted,            setIsMuted]            = useState(false);
  const [isListening,        setIsListening]        = useState(false);
  const [approvalDismissed,  setApprovalDismissed]  = useState(false);
  const [approvalStatus,     setApprovalStatus]     = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [missionExpanded,    setMissionExpanded]    = useState(false);

  // Derive voice state: if the parent overrides, use that; otherwise derive from local listening toggle
  const effectiveAuraState: VisualizerState =
    auraState !== 'idle'
      ? auraState
      : isListening
        ? 'listening'
        : 'idle';

  const adminState: AdminVoiceState = externalAdminState ?? (
    isMuted
      ? 'muted'
      : isListening
        ? 'speaking'
        : 'idle'
  );

  const showApproval = !approvalDismissed && approvalStatus === 'pending';

  const handleMicToggle = () => {
    if (isMuted) return;
    setIsListening(prev => !prev);
  };

  const handleApprove = () => {
    setApprovalStatus('approved');
    setTimeout(() => setApprovalDismissed(true), 1200);
  };

  const handleReject = () => {
    setApprovalStatus('rejected');
    setTimeout(() => setApprovalDismissed(true), 1200);
  };

  return (
    <div className={cn(
      'relative flex flex-col h-full min-h-0 w-full overflow-hidden',
      'bg-gradient-to-b from-zinc-950 via-zinc-950 to-indigo-950/10',
    )}>

      {/* ── Top status strip ──────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-3 bg-gradient-to-b from-zinc-950/90 to-transparent pointer-events-none">
        {/* Left: status chips */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {MOCK_STATUS_CHIPS.map(chip => (
            <Fragment key={chip.id}>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/70 border border-zinc-800/50 rounded-full backdrop-blur-sm">
                <span className={chip.color}>{chip.icon}</span>
                <span className="text-[11px] text-zinc-400 font-medium">{chip.label}</span>
                <span className={cn('text-[11px] font-semibold', chip.color)}>{chip.value}</span>
              </div>
            </Fragment>
          ))}
        </div>

        {/* Right: Safe Monitor badge */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {safeMonitorMode && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full">
              <Eye className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-amber-400 font-semibold">Safe Monitor</span>
            </div>
          )}
          {/* Pending approval badge */}
          {showApproval && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full animate-pulse">
              <Shield className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-amber-400 font-semibold">1 Approval</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main center content ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-4 py-6 pt-14">

        {/* Mission summary card (collapsible) */}
        <div className="w-full max-w-md mb-6">
          <button
            onClick={() => setMissionExpanded(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:bg-zinc-900/80 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
              <span className="text-[12px] text-zinc-400 font-medium flex-shrink-0">Mission</span>
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

          {/* Expanded mission details */}
          {missionExpanded && (
            <div className="mt-1 px-4 py-3 bg-zinc-900/50 border border-zinc-800/40 rounded-xl border-t-0 rounded-tl-none rounded-tr-none -mt-1 pt-2 animate-in slide-in-from-top-2 duration-200">
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

        {/* ── Central visualizer + thought cards ───────────────── */}
        <div className="relative flex items-center justify-center w-full max-w-2xl mb-4">

          {/* Left thought cards */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-48 hidden lg:block">
            <AuraThoughtStack maxVisible={2} />
          </div>

          {/* Central orb */}
          <div className="flex flex-col items-center gap-4 z-10">
            <AuraVoiceVisualizer
              state={effectiveAuraState}
              size="xl"
              showLabel
              amplitude={isListening ? 0.8 : 0.3}
            />

            {/* Admin voice indicator */}
            <div className="flex items-center justify-center">
              <AdminVoiceIndicator state={adminState} />
            </div>
          </div>

          {/* Right thought cards */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 hidden lg:block">
            <AuraThoughtStack maxVisible={2} />
          </div>
        </div>

        {/* Mobile thought cards (below orb, small screens) */}
        <div className="w-full max-w-xs lg:hidden mb-4">
          <AuraThoughtStack maxVisible={2} />
        </div>

        {/* ── Approval overlay ─────────────────────────────────── */}
        {showApproval && (
          <div className="w-full max-w-md mb-4 animate-in slide-in-from-bottom-4 duration-300">
            <ApprovalCard
              {...MOCK_APPROVAL}
              status="pending"
              onApprove={handleApprove}
              onReject={handleReject}
              onDetails={() => onOpenTechnicalDrawer()}
            />
          </div>
        )}

        {/* Post-decision approval fade-out */}
        {!approvalDismissed && approvalStatus !== 'pending' && (
          <div className="w-full max-w-md mb-4 animate-in fade-in duration-300">
            <ApprovalCard
              {...MOCK_APPROVAL}
              status={approvalStatus}
            />
          </div>
        )}
      </div>

      {/* ── Bottom action strip ───────────────────────────────── */}
      <div className="shrink-0 pb-8 px-4 bg-gradient-to-t from-zinc-950/90 via-zinc-950/60 to-transparent">
        <div className="max-w-lg mx-auto flex flex-col gap-3">

          {/* Primary voice action */}
          <div className="flex items-center justify-center gap-3">
            {/* Mute toggle */}
            <button
              onClick={() => setIsMuted(p => !p)}
              title={isMuted ? 'Unmute' : 'Mute'}
              className={cn(
                'flex items-center justify-center w-11 h-11 rounded-full border transition-all',
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-zinc-900/80 border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
              )}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <MicOff className="w-4 h-4 opacity-50" />}
            </button>

            {/* Speak / Push-to-Talk (main CTA) */}
            <button
              onClick={handleMicToggle}
              disabled={isMuted}
              className={cn(
                'flex items-center gap-3 px-6 py-3 rounded-2xl font-semibold text-[14px] transition-all shadow-lg',
                isMuted && 'opacity-40 cursor-not-allowed',
                isListening
                  ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25',
              )}
            >
              <Mic className="w-4 h-4" />
              {isListening ? 'Stop Listening' : 'Speak / Push to Talk'}
              {/* Placeholder notice */}
              <span className="text-[10px] opacity-60 font-normal">(placeholder)</span>
            </button>
          </div>

          {/* Secondary actions */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={onOpenConsole}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-[13px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600',
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
              Open Console
            </button>

            <button
              onClick={onOpenAdminPanel}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-[13px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600',
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Open Admin Panel
            </button>

            <button
              onClick={onOpenTechnicalDrawer}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-[13px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600',
              )}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Show Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

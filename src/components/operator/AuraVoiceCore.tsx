/**
 * AuraVoiceCore — Phase 2E Voice Core (QA Fix Pass)
 *
 * Layout: 5 explicit flex zones so the approval card is never hidden.
 *
 *  Zone 1 — absolute status strip  (no flex height, pointer-events overlay)
 *  Zone 2 — mission card           (shrink-0)
 *  Zone 3 — orb + thought + admin  (flex-1, min-h-0, centers orb)
 *  Zone 4 — approval card          (shrink-0, sits above bottom strip)
 *  Zone 5 — bottom action strip    (shrink-0, always reachable)
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
  { id: 'memory', icon: <Database className="w-3 h-3" />, label: 'Memory', value: 'Online',  color: 'text-emerald-400' },
  { id: 'relay',  icon: <Wrench   className="w-3 h-3" />, label: 'Relay',  value: 'Ready',   color: 'text-amber-400'   },
  { id: 'tools',  icon: <Shield   className="w-3 h-3" />, label: 'Tools',  value: 'Locked',  color: 'text-zinc-500'    },
  { id: 'agent',  icon: <Bot      className="w-3 h-3" />, label: 'Agent',  value: 'Active',  color: 'text-indigo-400'  },
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
  const [isMuted,           setIsMuted]           = useState(false);
  const [isListening,       setIsListening]       = useState(false);
  const [approvalDismissed, setApprovalDismissed] = useState(false);
  const [approvalStatus,    setApprovalStatus]    = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [missionExpanded,   setMissionExpanded]   = useState(false);

  const effectiveAuraState: VisualizerState =
    auraState !== 'idle' ? auraState : isListening ? 'listening' : 'idle';

  const adminState: AdminVoiceState = externalAdminState ?? (
    isMuted ? 'muted' : isListening ? 'speaking' : 'idle'
  );

  const showApproval    = !approvalDismissed && approvalStatus === 'pending';
  const showPostDecision = !approvalDismissed && approvalStatus !== 'pending';

  const handleMicToggle = () => { if (!isMuted) setIsListening(p => !p); };
  const handleApprove   = () => { setApprovalStatus('approved');  setTimeout(() => setApprovalDismissed(true), 1200); };
  const handleReject    = () => { setApprovalStatus('rejected');  setTimeout(() => setApprovalDismissed(true), 1200); };

  return (
    <div className={cn(
      'relative flex flex-col h-full min-h-0 w-full overflow-hidden',
      'bg-gradient-to-b from-zinc-950 via-zinc-950 to-indigo-950/10',
    )}>

      {/* ── ZONE 1: Absolute status strip (no flex height) ───────── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-2.5 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {MOCK_STATUS_CHIPS.map(chip => (
            <Fragment key={chip.id}>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/80 border border-zinc-800/60 rounded-full backdrop-blur-sm">
                <span className={chip.color}>{chip.icon}</span>
                <span className="text-[11px] text-zinc-400 font-medium">{chip.label}</span>
                <span className={cn('text-[11px] font-semibold', chip.color)}>{chip.value}</span>
              </div>
            </Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {safeMonitorMode && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full">
              <Eye className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-amber-400 font-semibold">Safe Monitor</span>
            </div>
          )}
          {showApproval && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full animate-pulse">
              <Shield className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-amber-400 font-semibold">1 Approval</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ZONE 2: Mission card — shrink-0, never clipped ───────── */}
      <div className="shrink-0 pt-12 pb-1 px-4">
        <div className="max-w-md mx-auto">
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

      {/* ── ZONE 3: Orb + thought cards + admin indicator — flex-1 ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-2">
        <div className="relative flex items-center justify-center w-full max-w-2xl">

          {/* Left thought cards — starts at index 0 */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-48 hidden lg:block">
            <AuraThoughtStack maxVisible={2} initialIndex={0} />
          </div>

          {/* Central orb + admin indicator */}
          <div className="flex flex-col items-center gap-3 z-10">
            <AuraVoiceVisualizer
              state={effectiveAuraState}
              size="xl"
              showLabel
              amplitude={isListening ? 0.8 : 0.3}
            />
            <AdminVoiceIndicator state={adminState} />
          </div>

          {/* Right thought cards — starts at index 4 (offset) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-48 hidden lg:block">
            <AuraThoughtStack maxVisible={2} initialIndex={4} />
          </div>
        </div>
      </div>

      {/* Mobile thought cards */}
      <div className="shrink-0 w-full max-w-xs mx-auto px-4 pb-2 lg:hidden">
        <AuraThoughtStack maxVisible={2} initialIndex={0} />
      </div>

      {/* ── ZONE 4: Approval card — shrink-0, above bottom strip ─── */}
      {showApproval && (
        <div className="shrink-0 px-4 pb-2 w-full max-w-md mx-auto animate-in slide-in-from-bottom-4 duration-300">
          <ApprovalCard
            {...MOCK_APPROVAL}
            status="pending"
            onApprove={handleApprove}
            onReject={handleReject}
            onDetails={() => onOpenTechnicalDrawer()}
          />
        </div>
      )}

      {/* Post-decision fade-out */}
      {showPostDecision && (
        <div className="shrink-0 px-4 pb-2 w-full max-w-md mx-auto animate-in fade-in duration-300">
          <ApprovalCard
            {...MOCK_APPROVAL}
            status={approvalStatus}
          />
        </div>
      )}

      {/* ── ZONE 5: Bottom action strip — shrink-0, always reachable */}
      <div className="shrink-0 px-4 pt-2 pb-5 bg-gradient-to-t from-zinc-950/80 via-zinc-950/40 to-transparent">
        <div className="max-w-lg mx-auto flex flex-col gap-2.5">

          {/* Primary: Mute + Speak */}
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
              {isListening ? 'Stop Listening' : 'Speak / Push to Talk'}
              <span className="text-[10px] opacity-50 font-normal">(placeholder)</span>
            </button>
          </div>

          {/* Secondary: Console / Admin Panel / Details */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={onOpenConsole}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600',
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
              Open Console
            </button>

            <button
              onClick={onOpenAdminPanel}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
                'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600',
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Open Admin Panel
            </button>

            <button
              onClick={onOpenTechnicalDrawer}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors',
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

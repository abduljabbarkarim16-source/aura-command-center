/**
 * AuraVoiceCore — Phase 3C Voice Conversation MVP
 *
 * Adds real voice conversation on top of the Phase 2F runtime foundation.
 * When "Voice Conversation" is enabled in settings:
 *   Speak button → record audio → STT → chat → TTS → play audio
 *
 * When disabled: existing mock/demo behaviour is preserved.
 *
 * Security: API key never appears in this component.
 * All OpenAI calls route through Tauri backend (voice_commands.rs).
 */

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import {
  Mic, MicOff, Terminal, Settings2, LayoutGrid,
  Shield, Bot, Database, Wrench, ChevronDown, ChevronUp,
  Eye, Play, RotateCcw, Radio, ChevronRight, Trash2,
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
import { useRuntimeStatus } from '../../hooks/useRuntimeStatus';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { openAIVoiceSessionService } from '../../services/voice/OpenAIVoiceSessionService';
import type { VoiceRuntimeState } from '../../types/voice-runtime';
import type { VoiceConversationTurn, VoiceConversationSettings } from '../../types/voice-session';
import { DEFAULT_VOICE_SETTINGS } from '../../types/voice-session';

// ─── Constants ────────────────────────────────────────────────────────────────

const GREETING_SESSION_KEY = 'aura_greeting_shown';
const MAX_VISIBLE_TURNS = 5;

// ─── State mapping ────────────────────────────────────────────────────────────

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

const BADGE_RISK: Record<string, { bg: string; border: string; text: string }> = {
  low:      { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  medium:   { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400'  },
  high:     { bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-400'    },
  critical: { bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-400'   },
};

function runtimeStateLabel(state: VoiceRuntimeState): string {
  switch (state) {
    case 'listening':           return 'Listening';
    case 'thinking':            return 'Thinking';
    case 'speaking':            return 'Speaking';
    case 'waiting_for_approval':return 'Awaiting';
    case 'executing':           return 'Executing';
    case 'error':               return 'Error';
    case 'muted':               return 'Muted';
    default:                    return 'Standby';
  }
}

// ─── Conversation status label ────────────────────────────────────────────────

type ConvPhase = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking' | 'error';

function convPhaseLabel(phase: ConvPhase): string {
  switch (phase) {
    case 'recording':    return 'Listening…';
    case 'transcribing': return 'Transcribing…';
    case 'thinking':     return 'Thinking…';
    case 'speaking':     return 'Speaking…';
    case 'error':        return 'Error';
    default:             return '';
  }
}

function convPhaseVisualizer(phase: ConvPhase): VisualizerState {
  switch (phase) {
    case 'recording':    return 'listening';
    case 'transcribing': return 'thinking';
    case 'thinking':     return 'thinking';
    case 'speaking':     return 'speaking';
    case 'error':        return 'error';
    default:             return 'idle';
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuraVoiceCoreProps {
  /** @deprecated Runtime takes precedence */
  auraState?: VisualizerState;
  /** @deprecated */
  adminVoiceState?: AdminVoiceState;
  /** @deprecated */
  safeMonitorMode?: boolean;
  onOpenConsole: () => void;
  onOpenAdminPanel: () => void;
  onOpenTechnicalDrawer: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuraVoiceCore({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  auraState: _a,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  adminVoiceState: _b,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  safeMonitorMode: _c,
  onOpenConsole,
  onOpenAdminPanel,
  onOpenTechnicalDrawer,
}: AuraVoiceCoreProps) {

  const runtime = useVoiceRuntime();
  const status  = useRuntimeStatus();

  // ── Voice conversation state ───────────────────────────────────────────────
  // Voice is always on by default; respect other persisted preferences (ttsVoice etc.)
  const [voiceSettings, setVoiceSettings] = useState<VoiceConversationSettings>(() => {
    try {
      const stored = localStorage.getItem('voice.conversation.settings');
      const parsed = stored ? (JSON.parse(stored) as Partial<VoiceConversationSettings>) : {};
      return { ...DEFAULT_VOICE_SETTINGS, ...parsed, enabled: true };
    } catch { return { ...DEFAULT_VOICE_SETTINGS, enabled: true }; }
  });
  const [convPhase, setConvPhase]         = useState<ConvPhase>('idle');
  const [convError, setConvError]         = useState<string | null>(null);
  const [turns, setTurns]                 = useState<VoiceConversationTurn[]>([]);
  const [convOpen, setConvOpen]           = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runningRef = useRef(false);
  // Stable ref so the one-time greeting effect can read the latest settings
  const voiceSettingsRef = useRef(voiceSettings);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);

  // ── Legacy mock state ─────────────────────────────────────────────────────
  const [isTrayOpen, setIsTrayOpen]      = useState(false);
  const [missionExpanded, setMissionExpanded] = useState(false);
  const greetedRef = useRef(false);

  // ── Recorder ──────────────────────────────────────────────────────────────
  const recorder = useVoiceRecorder(voiceSettings.maxRecordingDurationMs);

  // ── Persist voice settings ────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('voice.conversation.settings', JSON.stringify(voiceSettings)); }
    catch { /* ignore */ }
  }, [voiceSettings]);

  // ── Approval data ─────────────────────────────────────────────────────────
  const allApprovals       = runtime.pendingApprovals;
  const pendingCount       = allApprovals.filter(a => a.status === 'pending').length;
  const activeTrayApproval =
    allApprovals.find(a => a.status === 'pending') ??
    allApprovals.find(a => a.status !== 'pending');
  const trayRiskLevel = activeTrayApproval?.riskLevel ?? 'medium';

  // ── Status chips ──────────────────────────────────────────────────────────
  const agentStateLabel = runtimeStateLabel(runtime.state);
  const agentColor = runtime.state === 'error' ? 'text-rose-400'
    : runtime.state === 'listening' ? 'text-sky-400'
    : runtime.state === 'speaking'  ? 'text-indigo-400'
    : runtime.state === 'thinking'  ? 'text-violet-400'
    : 'text-indigo-400';

  const statusChips = [
    {
      id: 'memory', icon: <Database className="w-3 h-3" />, label: 'Memory',
      value: status.memoryCount !== null ? (status.memoryCount > 0 ? `${status.memoryCount} saved` : 'Empty') : 'Active',
      color: 'text-emerald-400',
    },
    {
      id: 'relay', icon: <Wrench className="w-3 h-3" />, label: 'Relay',
      value: status.relayActiveCount !== null ? (status.relayActiveCount > 0 ? `${status.relayActiveCount} active` : 'Ready') : 'Ready',
      color: 'text-amber-400',
    },
    {
      id: 'tools', icon: <Shield className="w-3 h-3" />, label: 'Tools',
      value: pendingCount > 0 ? `${pendingCount} pending` : 'Locked',
      color: pendingCount > 0 ? 'text-amber-400' : 'text-zinc-500',
    },
    {
      id: 'agent', icon: <Bot className="w-3 h-3" />, label: 'Agent',
      value: voiceSettings.enabled && convPhase !== 'idle' ? convPhaseLabel(convPhase) : agentStateLabel,
      color: agentColor,
    },
  ];

  // ── Visualizer source ─────────────────────────────────────────────────────
  const effectiveVisualizerState: VisualizerState = voiceSettings.enabled && convPhase !== 'idle'
    ? convPhaseVisualizer(convPhase)
    : RUNTIME_TO_VISUALIZER[runtime.state] ?? 'idle';

  const adminState: AdminVoiceState = (() => {
    if (runtime.isMuted) return 'muted';
    if (runtime.activeSpeaker === 'admin' || (voiceSettings.enabled && convPhase === 'recording')) return 'speaking';
    return 'idle';
  })();

  const visualizerSource: 'aura' | 'admin' | 'system' = (() => {
    if (voiceSettings.enabled && convPhase === 'recording') return 'admin';
    if (voiceSettings.enabled && (convPhase === 'speaking')) return 'aura';
    if (runtime.activeSpeaker === 'admin') return 'admin';
    if (runtime.activeSpeaker === 'system') return 'system';
    return 'aura';
  })();

  // ── Voice intro on startup (once per session) ─────────────────────────────
  useEffect(() => {
    if (greetedRef.current || sessionStorage.getItem(GREETING_SESSION_KEY)) {
      greetedRef.current = true; return;
    }
    greetedRef.current = true;
    sessionStorage.setItem(GREETING_SESSION_KEY, '1');

    const INTRO = "AURA online. I'm ready to assist. Speak anytime.";

    const timer = setTimeout(async () => {
      const settings = voiceSettingsRef.current;
      const result = await openAIVoiceSessionService.synthesizeSpeech(INTRO, settings.ttsVoice);
      if (result.success && result.audioBlobUrl) {
        setConvPhase('speaking');
        setCurrentAudioUrl(result.audioBlobUrl);
        const audio = new Audio(result.audioBlobUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setConvPhase('idle');
          URL.revokeObjectURL(result.audioBlobUrl!);
          setCurrentAudioUrl(null);
        };
        audio.onerror = () => {
          setConvPhase('idle');
          setCurrentAudioUrl(null);
          runtime.addRuntimeNotification({ type: 'success', title: "AURA online. Ready to assist.", ttl: 5000 });
        };
        audio.play().catch(() => {
          setConvPhase('idle');
          setCurrentAudioUrl(null);
          runtime.addRuntimeNotification({ type: 'success', title: "AURA online. Ready to assist.", ttl: 5000 });
        });
      } else {
        runtime.addRuntimeNotification({ type: 'success', title: "AURA online. Ready to assist.", ttl: 5000 });
      }
    }, 1200); // brief delay so the UI settles before audio starts

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (allApprovals.length === 0) setIsTrayOpen(false);
  }, [allApprovals.length]);

  // ── Cleanup audio on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    };
  }, [currentAudioUrl]);

  // ── Voice conversation handlers ───────────────────────────────────────────

  const handleSpeakStart = useCallback(async () => {
    if (runningRef.current || convPhase !== 'idle') return;
    setConvError(null);
    await recorder.startRecording();
    setConvPhase('recording');
  }, [convPhase, recorder]);

  const handleSpeakStop = useCallback(async () => {
    if (convPhase !== 'recording') return;
    if (runningRef.current) return;
    runningRef.current = true;

    setConvPhase('transcribing');
    const blob = await recorder.stopRecording();

    if (!blob || blob.size < 100) {
      setConvPhase('idle');
      setConvError('No audio captured — try again.');
      runningRef.current = false;
      return;
    }

    setConvPhase('thinking');
    const result = await openAIVoiceSessionService.runConversationTurn(blob, voiceSettings);

    if (!result.success) {
      setConvPhase('error');
      setConvError(result.error ?? 'Voice conversation failed');
      runningRef.current = false;
      setTimeout(() => setConvPhase('idle'), 3000);
      return;
    }

    if (result.turn) {
      setTurns(prev => [...prev, result.turn!].slice(-MAX_VISIBLE_TURNS));
    }

    if (result.audioUrl) {
      // Revoke previous URL
      if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl(result.audioUrl);
      setConvPhase('speaking');

      const audio = new Audio(result.audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setConvPhase('idle');
        URL.revokeObjectURL(result.audioUrl!);
        setCurrentAudioUrl(null);
        runningRef.current = false;
      };
      audio.onerror = () => {
        setConvPhase('idle');
        setConvError('Audio playback failed');
        runningRef.current = false;
      };
      audio.play().catch(() => {
        setConvPhase('idle');
        runningRef.current = false;
      });
    } else {
      // No audio (TTS failed) but we still have a text response
      setConvPhase('idle');
      runningRef.current = false;
    }
  }, [convPhase, recorder, voiceSettings, currentAudioUrl]);

  const handleStopPlayback = useCallback(() => {
    audioRef.current?.pause();
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    setCurrentAudioUrl(null);
    setConvPhase('idle');
    runningRef.current = false;
  }, [currentAudioUrl]);

  const handleClearConversation = useCallback(() => {
    setTurns([]);
    openAIVoiceSessionService.clearHistory();
  }, []);

  // ── Legacy mock handlers ──────────────────────────────────────────────────

  const handleMockSpeakToggle = () => {
    if (runtime.state === 'listening') runtime.stopListening();
    else runtime.startListening();
  };

  const handleMuteToggle = () => runtime.toggleMuted();
  const handleApprove = () => { if (activeTrayApproval) runtime.resolveApproval(activeTrayApproval.id, 'approved'); };
  const handleReject  = () => { if (activeTrayApproval) runtime.resolveApproval(activeTrayApproval.id, 'rejected'); };

  // ── Permission denied message ─────────────────────────────────────────────
  const micDenied = recorder.state.micPermission === 'denied';
  const micUnsupported = recorder.state.micPermission === 'unsupported';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn(
      'relative flex flex-col h-full min-h-0 w-full overflow-hidden',
      'bg-gradient-to-b from-zinc-950 via-zinc-950 to-indigo-950/10',
    )}>
      <NotificationToast position="top-right" maxVisible={3} />

      {/* ZONE 1: Status strip */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-2.5 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {statusChips.map(chip => (
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
          {runtime.isSafeMode && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full">
              <Eye className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] text-amber-400 font-semibold">Safe Monitor</span>
              <button onClick={() => runtime.toggleSafeMode()} className="ml-0.5 text-amber-500/60 hover:text-amber-300 text-[12px]" title="Exit safe monitor">×</button>
            </div>
          )}
          {pendingCount > 0 && (() => {
            const badge = BADGE_RISK[trayRiskLevel] ?? BADGE_RISK.medium;
            return (
              <button onClick={() => setIsTrayOpen(p => !p)} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors', badge.bg, badge.border, !isTrayOpen && 'animate-pulse')}>
                <Shield className={cn('w-3 h-3', badge.text)} />
                <span className={cn('text-[11px] font-semibold', badge.text)}>{pendingCount} Approval{pendingCount > 1 ? 's' : ''}</span>
              </button>
            );
          })()}
          <NotificationCenter />
        </div>
      </div>

      {/* ZONE 2: Mission card */}
      <div className="shrink-0 pt-12 pb-1 px-4">
        <div className="max-w-md mx-auto">
          <button onClick={() => setMissionExpanded(p => !p)} className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:bg-zinc-900/80 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
              <span className="text-[12px] text-zinc-500 font-medium flex-shrink-0">Mission</span>
              <span className="text-[13px] font-semibold text-zinc-200 truncate">{runtime.mission.name}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3 h-3 text-indigo-400" />
                <span className="text-[11px] text-indigo-400 font-medium">{runtime.mission.agent}</span>
              </div>
              {missionExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
            </div>
          </button>
          {missionExpanded && (
            <div className="px-4 py-3 bg-zinc-900/50 border border-zinc-800/40 border-t-0 rounded-b-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-zinc-500">Phase</span>
                <span className="text-[11px] text-zinc-300 font-medium">{runtime.mission.phase}</span>
                <span className="ml-auto text-[11px] text-zinc-500">{runtime.mission.progress}%</span>
              </div>
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${runtime.mission.progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ZONE 3: Orb */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-2">
        <div className="flex flex-col items-center gap-3 z-10">
          <AuraVoiceVisualizer state={effectiveVisualizerState} source={visualizerSource} size="xl" showLabel />
          <AdminVoiceIndicator state={adminState} />

          {/* Conversation phase status */}
          {voiceSettings.enabled && convPhase !== 'idle' && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold',
              convPhase === 'error' ? 'bg-rose-500/15 text-rose-400' : 'bg-indigo-500/15 text-indigo-300',
            )}>
              {convPhase === 'recording' && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
              {convPhaseLabel(convPhase)}
              {recorder.state.isRecording && (
                <span className="text-zinc-500 text-[10px] font-normal ml-1">
                  {(recorder.state.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          )}

          {/* Permission / error messages */}
          {(micDenied || micUnsupported || convError) && (
            <div className="max-w-xs text-center px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400">
              {micDenied ? 'Microphone permission denied. Allow access in browser settings.' :
               micUnsupported ? 'Microphone not supported in this browser.' :
               convError}
            </div>
          )}
        </div>
      </div>

      {/* Collapsible conversation panel */}
      {voiceSettings.enabled && turns.length > 0 && (
        <div className="shrink-0 px-4 pb-1">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setConvOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/60 border border-zinc-800/50 rounded-t-xl text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Radio className="w-3 h-3" />
                Conversation ({turns.length} turn{turns.length !== 1 ? 's' : ''})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleClearConversation(); }}
                  className="p-0.5 text-zinc-600 hover:text-rose-400 transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                {convOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </div>
            </button>

            {convOpen && (
              <div className="max-h-48 overflow-y-auto bg-zinc-950/80 border border-zinc-800/50 border-t-0 rounded-b-xl px-3 py-2 space-y-2">
                {turns.map(turn => (
                  <div key={turn.id} className="space-y-0.5">
                    <p className="text-[11px] text-zinc-500">
                      <span className="text-sky-400 font-semibold">You </span>
                      {turn.userText}
                    </p>
                    <p className="text-[11px] text-zinc-300">
                      <span className="text-indigo-400 font-semibold">AURA </span>
                      {turn.auraText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ApprovalTray */}
      {activeTrayApproval && (
        <ApprovalTray isOpen={isTrayOpen} onClose={() => setIsTrayOpen(false)} approval={activeTrayApproval} status={activeTrayApproval.status} onApprove={handleApprove} onReject={handleReject} onDetails={onOpenTechnicalDrawer} />
      )}

      {/* ZONE 5: Bottom action strip */}
      <div className="shrink-0 px-4 pt-2 pb-5 bg-gradient-to-t from-zinc-950/80 via-zinc-950/40 to-transparent">
        <div className="max-w-lg mx-auto flex flex-col gap-2.5">

          {/* Voice conversation mode toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setVoiceSettings(s => ({ ...s, enabled: !s.enabled }))}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all',
                voiceSettings.enabled
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-zinc-900/60 border-zinc-700/40 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
              )}
              title="Toggle voice conversation MVP"
            >
              <Radio className="w-3 h-3" />
              {voiceSettings.enabled ? 'Voice On' : 'Voice Off'}
            </button>
          </div>

          {/* Main speak button */}
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
              {runtime.isMuted ? <MicOff className="w-4 h-4" /> : <MicOff className="w-4 h-4 opacity-40" />}
            </button>

            {voiceSettings.enabled ? (
              <>
                {/* Real conversation speak button */}
                {convPhase === 'speaking' ? (
                  <button
                    onClick={handleStopPlayback}
                    className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-semibold text-[14px] bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition-all"
                  >
                    <MicOff className="w-4 h-4" />
                    Stop
                  </button>
                ) : convPhase === 'recording' ? (
                  <button
                    onClick={handleSpeakStop}
                    className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-semibold text-[14px] bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30 shadow-lg transition-all animate-pulse"
                  >
                    <Mic className="w-4 h-4" />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={handleSpeakStart}
                    disabled={convPhase !== 'idle' || micDenied || micUnsupported}
                    className={cn(
                      'flex items-center gap-2.5 px-5 py-2.5 rounded-2xl font-semibold text-[14px] shadow-lg transition-all',
                      convPhase !== 'idle' || micDenied || micUnsupported
                        ? 'bg-indigo-600/40 text-white/40 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25',
                    )}
                  >
                    <Mic className="w-4 h-4" />
                    {convPhase !== 'idle' ? convPhaseLabel(convPhase) : 'Speak'}
                  </button>
                )}
              </>
            ) : (
              /* Mock speak button (legacy) */
              <button
                onClick={handleMockSpeakToggle}
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
            )}
          </div>

          {/* Secondary actions */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button onClick={onOpenConsole} className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors', 'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600')}>
              <Terminal className="w-3.5 h-3.5" /> Console
            </button>
            <button onClick={onOpenAdminPanel} className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors', 'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600')}>
              <LayoutGrid className="w-3.5 h-3.5" /> Admin
            </button>
            <button onClick={onOpenTechnicalDrawer} className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors', 'bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600')}>
              <Settings2 className="w-3.5 h-3.5" /> Details
            </button>
            <button onClick={() => runtime.toggleSafeMode()} className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors', runtime.isSafeMode ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300')}>
              <Eye className="w-3.5 h-3.5" /> {runtime.isSafeMode ? 'Safe On' : 'Safe'}
            </button>
            {!voiceSettings.enabled && (
              <>
                <button onClick={() => runtime.runDemoSequence()} className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors', 'bg-zinc-900/60 border-zinc-700/40 text-zinc-600 hover:bg-zinc-800 hover:text-indigo-400')}>
                  <Play className="w-3 h-3" /> Demo
                </button>
                <button onClick={() => runtime.clearRuntime()} className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-[12px] font-medium transition-colors', 'bg-zinc-900/60 border-zinc-700/40 text-zinc-600 hover:bg-zinc-800 hover:text-rose-400')}>
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

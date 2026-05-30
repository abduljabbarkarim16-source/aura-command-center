/**
 * AuraVoiceCore — Phase 3E
 *
 * Phase 3E over Phase 3D:
 *  - VAD improvements: noise-floor calibration, N-frame speech gate, rolling RMS
 *  - Mic level meter (visual, not just text)
 *  - Keyboard hotkey: Ctrl+Shift+Space anywhere; Space/V without text focus
 *  - All voice errors routed to NotificationService (top-right tray) — no inline error banners
 *  - VoiceTranscriptLogService logs turns locally when persistTranscripts=true
 *  - Layout collision fixed: transcript panel max-height + own scroll area
 *  - Bottom controls use absolute positioning so they never overlap transcript
 *  - shouldAttemptSTT from VAD: large blobs are always sent to Whisper
 *
 * Security: API key never in this component. All OpenAI calls via Tauri.
 */

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import {
  Mic, MicOff, Terminal, Settings2, LayoutGrid,
  Eye, Radio, Trash2, ChevronDown, ChevronUp, Bot, Database,
  Wrench, Shield, Keyboard,
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
import { useVoiceActivityRecorder } from '../../hooks/useVoiceActivityRecorder';
import { useWakePhrase, DEFAULT_WAKE_PHRASES } from '../../hooks/useWakePhrase';
import { useVoiceHotkey } from '../../hooks/useVoiceHotkey';
import { openAIVoiceSessionService } from '../../services/voice/OpenAIVoiceSessionService';
import { notifyVoiceError, notifyVoiceSuccess } from '../../services/notifications/NotificationService';
import { voiceTranscriptLogService } from '../../services/voice/VoiceTranscriptLogService';
import type { VoiceRuntimeState } from '../../types/voice-runtime';
import type { VoiceConversationTurn, VoiceConversationSettings } from '../../types/voice-session';
import { DEFAULT_VOICE_SETTINGS } from '../../types/voice-session';

// ─── Constants ────────────────────────────────────────────────────────────────

const GREETING_SESSION_KEY = 'aura_greeting_shown';
const MAX_VISIBLE_TURNS = 5;
const MAX_BLOB_BYTES = 24 * 1024 * 1024; // 24 MB Whisper soft limit
const LONG_SPEECH_BLOB_BYTES = 500 * 1024;

// ─── State mapping ────────────────────────────────────────────────────────────

const RUNTIME_TO_VISUALIZER: Record<VoiceRuntimeState, VisualizerState> = {
  ready:                'idle',
  muted:                'idle',
  listening:            'listening',
  thinking:             'thinking',
  speaking:             'speaking',
  waiting_for_approval: 'waiting_for_approval',
  executing:            'executing',
  error:                'error',
};

const BADGE_RISK: Record<string, { bg: string; border: string; text: string }> = {
  low:      { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  medium:   { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400'  },
  high:     { bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-400'    },
  critical: { bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-400'   },
};

function runtimeStateLabel(state: VoiceRuntimeState): string {
  switch (state) {
    case 'listening':            return 'Listening';
    case 'thinking':             return 'Thinking';
    case 'speaking':             return 'Speaking';
    case 'waiting_for_approval': return 'Awaiting';
    case 'executing':            return 'Executing';
    case 'error':                return 'Error';
    case 'muted':                return 'Muted';
    default:                     return 'Standby';
  }
}

// ─── Conversation phase ───────────────────────────────────────────────────────

type ConvPhase =
  | 'idle'
  | 'connecting'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error';

function convPhaseLabel(phase: ConvPhase): string {
  switch (phase) {
    case 'connecting':   return 'Starting…';
    case 'recording':    return 'Listening…';
    case 'transcribing': return 'Processing…';
    case 'thinking':     return 'Thinking…';
    case 'speaking':     return 'Speaking…';
    case 'interrupted':  return 'Interrupted';
    case 'error':        return 'Error';
    default:             return '';
  }
}

function convPhaseVisualizer(phase: ConvPhase): VisualizerState {
  switch (phase) {
    case 'connecting':   return 'thinking';
    case 'recording':    return 'listening';
    case 'transcribing': return 'thinking';
    case 'thinking':     return 'thinking';
    case 'speaking':     return 'speaking';
    case 'interrupted':  return 'thinking';
    case 'error':        return 'error';
    default:             return 'idle';
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuraVoiceCoreProps {
  /** @deprecated */
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
  const [voiceSettings, setVoiceSettings] = useState<VoiceConversationSettings>(() => {
    try {
      const stored = localStorage.getItem('voice.conversation.settings');
      const parsed = stored ? (JSON.parse(stored) as Partial<VoiceConversationSettings>) : {};
      return { ...DEFAULT_VOICE_SETTINGS, ...parsed, enabled: true };
    } catch { return { ...DEFAULT_VOICE_SETTINGS, enabled: true }; }
  });
  const [convPhase, setConvPhase] = useState<ConvPhase>('idle');
  const [turns, setTurns]         = useState<VoiceConversationTurn[]>([]);
  const [convOpen, setConvOpen]   = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<{ user: string; aura: string } | null>(null);
  const [hotkeyHint, setHotkeyHint] = useState(false);

  const audioRef              = useRef<HTMLAudioElement | null>(null);
  const runningRef            = useRef(false);
  const recordStartTimeRef    = useRef<number | null>(null);
  const voiceSettingsRef      = useRef(voiceSettings);
  const [isTrayOpen, setIsTrayOpen]           = useState(false);
  const [missionExpanded, setMissionExpanded] = useState(false);
  const greetedRef            = useRef(false);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);

  // ── Recorders ─────────────────────────────────────────────────────────────
  const manualRecorder = useVoiceRecorder(voiceSettings.maxRecordingDurationMs);
  const onAutoStopRef  = useRef<(() => void) | undefined>(undefined);
  const vadRecorder    = useVoiceActivityRecorder({
    silenceThresholdMs: voiceSettings.silenceThresholdMs,
    minSpeechMs:        600,
    maxDurationMs:      voiceSettings.maxRecordingDurationMs,
    onAutoStop:         () => { onAutoStopRef.current?.(); },
  });
  const recorder = voiceSettings.autoStopEnabled ? vadRecorder : manualRecorder;

  // ── Wake phrase ────────────────────────────────────────────────────────────
  const wakePhrase = useWakePhrase({
    enabled:  voiceSettings.wakePhrase,
    phrases:  DEFAULT_WAKE_PHRASES,
    onActivated: useCallback(() => {
      if (convPhase === 'idle' && !runningRef.current) {
        setTimeout(() => {
          if (convPhase === 'idle' && !runningRef.current) handleSpeakStartRef.current?.();
        }, 100);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [convPhase]),
    onUnavailable: useCallback(() => {
      console.warn('[WakePhrase] SpeechRecognition unavailable in this environment');
    }, []),
  });
  const handleSpeakStartRef = useRef<(() => Promise<void>) | null>(null);

  // ── Sync transcript log persistence setting ────────────────────────────────
  useEffect(() => {
    voiceTranscriptLogService.setPersistEnabled(voiceSettings.persistTranscripts ?? false);
  }, [voiceSettings.persistTranscripts]);

  // ── Persist settings ───────────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('voice.conversation.settings', JSON.stringify(voiceSettings)); }
    catch { /* ignore */ }
  }, [voiceSettings]);

  // ── Wake phrase lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (voiceSettings.wakePhrase && voiceSettings.enabled && convPhase === 'idle' && !runningRef.current) {
      wakePhrase.start();
    } else if (!voiceSettings.wakePhrase || convPhase !== 'idle') {
      wakePhrase.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceSettings.wakePhrase, voiceSettings.enabled, convPhase]);

  // ── Approval data ──────────────────────────────────────────────────────────
  const allApprovals       = runtime.pendingApprovals;
  const pendingCount       = allApprovals.filter(a => a.status === 'pending').length;
  const activeTrayApproval =
    allApprovals.find(a => a.status === 'pending') ??
    allApprovals.find(a => a.status !== 'pending');
  const trayRiskLevel = activeTrayApproval?.riskLevel ?? 'medium';

  // ── Status chips ──────────────────────────────────────────────────────────
  const agentStateLabel = runtimeStateLabel(runtime.state);
  const agentColor = runtime.state === 'error'     ? 'text-rose-400'
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

  // ── Visualizer ─────────────────────────────────────────────────────────────
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
    if (voiceSettings.enabled && convPhase === 'speaking')  return 'aura';
    if (runtime.activeSpeaker === 'admin')  return 'admin';
    if (runtime.activeSpeaker === 'system') return 'system';
    return 'aura';
  })();

  // ── Voice intro ────────────────────────────────────────────────────────────
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
          notifyVoiceSuccess('AURA online. Ready to assist.');
        };
        audio.play().catch(() => {
          setConvPhase('idle');
          setCurrentAudioUrl(null);
          notifyVoiceSuccess('AURA online. Ready to assist.');
        });
      } else {
        notifyVoiceSuccess('AURA online. Ready to assist.');
      }
    }, 1200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (allApprovals.length === 0) setIsTrayOpen(false);
  }, [allApprovals.length]);

  useEffect(() => {
    const p = recorder.state.micPermission;
    if ((p === 'denied' || p === 'unsupported') &&
        (convPhase === 'connecting' || convPhase === 'recording')) {
      setConvPhase('idle');
    }
  }, [recorder.state.micPermission, convPhase]);

  useEffect(() => {
    return () => {
      if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    };
  }, [currentAudioUrl]);

  // ── Processing pipeline ───────────────────────────────────────────────────
  const processBlobRef = useRef<((blob: Blob, durationMs: number) => Promise<void>) | null>(null);

  const processBlob = useCallback(async (blob: Blob, durationMs: number) => {
    runningRef.current = true;
    setConvPhase('transcribing');
    setLiveTranscript({ user: '…', aura: '' });

    if (blob.size === 0) {
      notifyVoiceError('No audio captured. Check microphone permissions and try again.');
      setConvPhase('idle');
      setLiveTranscript(null);
      runningRef.current = false;
      return;
    }

    if (blob.size < 200 && durationMs > 500) {
      notifyVoiceError('Microphone input too quiet — speak closer to the mic or check your level.');
      setConvPhase('idle');
      setLiveTranscript(null);
      runningRef.current = false;
      return;
    }

    if (blob.size > MAX_BLOB_BYTES) {
      notifyVoiceError('Recording too long — keep responses under 45 seconds.');
      setConvPhase('idle');
      setLiveTranscript(null);
      runningRef.current = false;
      return;
    }

    if (blob.size > LONG_SPEECH_BLOB_BYTES) {
      setLiveTranscript({ user: 'Long thought captured — processing…', aura: '' });
    }

    const sttStart = Date.now();
    const sttResult = await openAIVoiceSessionService.transcribeAudio(blob);

    if (!sttResult.success) {
      notifyVoiceError(sttResult.error ?? 'Could not understand audio. Speak clearly and try again.');
      setConvPhase('idle');
      setLiveTranscript(null);
      runningRef.current = false;
      voiceTranscriptLogService.logError({
        errorSummary: sttResult.error ?? 'STT failed',
        durationMs,
        status: 'error',
      });
      return;
    }

    if (!sttResult.text?.trim()) {
      notifyVoiceError('No speech detected — speak closer to the mic or lower VAD sensitivity.');
      setConvPhase('idle');
      setLiveTranscript(null);
      runningRef.current = false;
      voiceTranscriptLogService.logError({
        errorSummary: 'No speech / silence',
        durationMs,
        status: 'no_speech',
      });
      return;
    }

    setLiveTranscript({ user: sttResult.text, aura: '' });
    setConvPhase('thinking');

    const chatStart = Date.now();
    const chatResult = await openAIVoiceSessionService.createChatResponse(
      sttResult.text,
      voiceSettingsRef.current.responseStyle ?? 'normal',
    );

    if (!chatResult.success || !chatResult.text) {
      notifyVoiceError(chatResult.error ?? 'AI response failed. Check your connection.');
      setConvPhase('idle');
      runningRef.current = false;
      return;
    }

    const turn: VoiceConversationTurn = {
      id:            `turn-${Date.now()}`,
      userText:      sttResult.text,
      auraText:      chatResult.text,
      timestamp:     new Date().toISOString(),
      sttLatencyMs:  sttResult.latencyMs,
      chatLatencyMs: chatResult.latencyMs,
    };
    setTurns(prev => [...prev, turn].slice(-MAX_VISIBLE_TURNS));
    setLiveTranscript({ user: sttResult.text, aura: chatResult.text });

    const ttsStart = Date.now();
    const ttsResult = await openAIVoiceSessionService.synthesizeSpeech(
      chatResult.text,
      voiceSettingsRef.current.ttsVoice,
    );

    voiceTranscriptLogService.logTurn({
      userText:     sttResult.text,
      auraText:     chatResult.text,
      durationMs,
      sttLatencyMs: Date.now() - sttStart,
      chatLatencyMs:Date.now() - chatStart,
      ttsLatencyMs: ttsResult.success ? Date.now() - ttsStart : undefined,
    });

    if (!ttsResult.success || !ttsResult.audioBlobUrl) {
      setConvPhase('idle');
      runningRef.current = false;
      return;
    }

    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    setCurrentAudioUrl(ttsResult.audioBlobUrl);
    setConvPhase('speaking');

    const audio = new Audio(ttsResult.audioBlobUrl);
    audioRef.current = audio;
    audio.onended = () => {
      setConvPhase('idle');
      URL.revokeObjectURL(ttsResult.audioBlobUrl!);
      setCurrentAudioUrl(null);
      runningRef.current = false;
    };
    audio.onerror = () => {
      setConvPhase('idle');
      runningRef.current = false;
    };
    audio.play().catch(() => {
      setConvPhase('idle');
      runningRef.current = false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAudioUrl]);

  useEffect(() => { processBlobRef.current = processBlob; }, [processBlob]);

  // ── handleSpeakStart ───────────────────────────────────────────────────────
  const handleSpeakStart = useCallback(async () => {
    if (convPhase === 'speaking' && voiceSettings.interruptEnabled) {
      audioRef.current?.pause();
      if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl(null);
      runningRef.current = false;
      setConvPhase('interrupted');
      await new Promise(r => setTimeout(r, 250));
      setConvPhase('idle');
      await new Promise(r => setTimeout(r, 50));
    }

    if (runningRef.current || (convPhase !== 'idle' && convPhase !== 'interrupted')) return;

    setLiveTranscript(null);
    setConvPhase('connecting');
    await recorder.startRecording();
    recordStartTimeRef.current = Date.now();
    setConvPhase('recording');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convPhase, recorder, currentAudioUrl, voiceSettings.interruptEnabled]);

  useEffect(() => { handleSpeakStartRef.current = handleSpeakStart; }, [handleSpeakStart]);

  // ── handleSpeakStop ────────────────────────────────────────────────────────
  const handleSpeakStop = useCallback(async () => {
    if (convPhase !== 'recording') return;
    if (runningRef.current) return;

    const elapsed = recordStartTimeRef.current ? Date.now() - recordStartTimeRef.current : 0;
    if (elapsed < 400) {
      notifyVoiceError('Hold Speak a moment — say your message, then click Finish.');
      return;
    }

    const blob = await recorder.stopRecording();
    if (!blob) {
      notifyVoiceError('No audio captured. Check microphone permissions and try again.');
      setConvPhase('idle');
      runningRef.current = false;
      return;
    }

    await processBlob(blob, elapsed);
  }, [convPhase, recorder, processBlob]);

  // ── VAD auto-stop ──────────────────────────────────────────────────────────
  useEffect(() => {
    onAutoStopRef.current = () => {
      if (convPhase === 'recording' && !runningRef.current) {
        handleSpeakStop();
      }
    };
  }, [convPhase, handleSpeakStop]);

  // ── Hotkey ─────────────────────────────────────────────────────────────────
  const isProcessing = convPhase === 'transcribing' || convPhase === 'thinking';
  useVoiceHotkey({
    enabled:      voiceSettings.enabled,
    isRecording:  convPhase === 'recording',
    isProcessing,
    onActivate:   () => { handleSpeakStartRef.current?.(); },
    onDeactivate: () => { handleSpeakStop(); },
  });

  // Show hotkey hint briefly on mount
  useEffect(() => {
    setHotkeyHint(true);
    const t = setTimeout(() => setHotkeyHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // ── Playback stop ──────────────────────────────────────────────────────────
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

  const handleMockSpeakToggle = () => {
    if (runtime.state === 'listening') runtime.stopListening();
    else runtime.startListening();
  };
  const handleMuteToggle = () => runtime.toggleMuted();
  const handleApprove = () => { if (activeTrayApproval) runtime.resolveApproval(activeTrayApproval.id, 'approved'); };
  const handleReject  = () => { if (activeTrayApproval) runtime.resolveApproval(activeTrayApproval.id, 'rejected'); };

  // ── Derived ────────────────────────────────────────────────────────────────
  const micDenied      = recorder.state.micPermission === 'denied';
  const micUnsupported = recorder.state.micPermission === 'unsupported';
  const vadPhase       = voiceSettings.autoStopEnabled ? vadRecorder.vadPhase : 'recording';
  const micLevel       = voiceSettings.autoStopEnabled ? vadRecorder.micLevel : 0;

  // ── You row content ────────────────────────────────────────────────────────
  function youRowContent() {
    if (convPhase === 'connecting') {
      return <span className="text-zinc-500 italic">Starting microphone…</span>;
    }
    if (convPhase === 'recording') {
      const durationSec = (recorder.state.durationMs / 1000).toFixed(1);
      if (voiceSettings.autoStopEnabled) {
        if (vadPhase === 'calibrating') {
          return (
            <span className="flex items-center gap-1.5 text-zinc-500 italic">
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse shrink-0" />
              Calibrating mic…
            </span>
          );
        }
        if (vadPhase === 'speech_detected') {
          return (
            <span className="flex items-center gap-2 text-rose-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
              Speaking…
              <span className="text-zinc-500 font-normal text-[10px]">{durationSec}s</span>
              {/* Mic level bar */}
              <span className="flex-1 max-w-[60px] h-1 bg-zinc-800 rounded-full overflow-hidden">
                <span
                  className="h-full bg-rose-500 rounded-full transition-all duration-75"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </span>
            </span>
          );
        }
        if (vadPhase === 'silence_detected') {
          return (
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              Pause detected…
              <span className="text-zinc-500 font-normal text-[10px]">{durationSec}s</span>
            </span>
          );
        }
        if (vadPhase === 'auto_stopping') {
          return (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              Processing…
            </span>
          );
        }
        return (
          <span className="flex items-center gap-1.5 text-sky-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shrink-0" />
            Listening… (auto)
            <span className="text-zinc-500 font-normal text-[10px]">{durationSec}s</span>
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1.5 text-rose-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
          Recording…
          <span className="text-zinc-500 font-normal text-[10px]">{durationSec}s — Finish when done</span>
        </span>
      );
    }
    if (liveTranscript?.user) {
      return <span className="text-zinc-200">{liveTranscript.user}</span>;
    }
    const hint = voiceSettings.autoStopEnabled
      ? 'Press Speak or Ctrl+Shift+Space, talk, then pause'
      : 'Press Speak, talk, then click Finish';
    return <span className="text-zinc-600 italic">{hint}</span>;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col h-full min-h-0 w-full bg-gradient-to-b from-zinc-950 via-zinc-950 to-indigo-950/10 overflow-hidden">
      <NotificationToast position="top-right" maxVisible={3} />

      {/* ── ZONE 1: Status strip (absolute, never shifts layout) ── */}
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
          {voiceSettings.wakePhrase && wakePhrase.status === 'listening' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] text-amber-400 font-semibold">Wake phrase active</span>
            </div>
          )}
          {voiceSettings.wakePhrase && wakePhrase.status === 'unavailable' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
              <span className="text-[11px] text-rose-400 font-medium">Wake phrase unavailable</span>
            </div>
          )}
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
              <button
                onClick={() => setIsTrayOpen(p => !p)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors', badge.bg, badge.border, !isTrayOpen && 'animate-pulse')}
              >
                <Shield className={cn('w-3 h-3', badge.text)} />
                <span className={cn('text-[11px] font-semibold', badge.text)}>{pendingCount} Approval{pendingCount > 1 ? 's' : ''}</span>
              </button>
            );
          })()}
          <NotificationCenter />
        </div>
      </div>

      {/* ── ZONE 2: Mission card ── */}
      <div className="shrink-0 pt-12 pb-1 px-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setMissionExpanded(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:bg-zinc-900/80 transition-colors"
          >
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

      {/* ── ZONE 3: Orb + transcript (scrollable, no overlap with bottom strip) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 py-2 pb-0 gap-3">
        <AuraVoiceVisualizer state={effectiveVisualizerState} source={visualizerSource} size="xl" showLabel />
        <AdminVoiceIndicator state={adminState} />

        {/* Live transcript panel */}
        {voiceSettings.enabled && (
          <div className="w-full max-w-md bg-zinc-900/70 border border-zinc-800/60 rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-start gap-2.5 min-h-[1.4rem]">
              <span className="text-sky-400 text-[11px] font-semibold shrink-0 mt-0.5 w-8">You</span>
              <span className="text-[12px] leading-relaxed flex-1">{youRowContent()}</span>
            </div>
            <div className="flex items-start gap-2.5 min-h-[1.4rem]">
              <span className="text-indigo-400 text-[11px] font-semibold shrink-0 mt-0.5 w-8">AURA</span>
              <span className="text-[12px] leading-relaxed flex-1">
                {convPhase === 'transcribing' ? (
                  <span className="text-violet-400 italic animate-pulse">Transcribing audio…</span>
                ) : convPhase === 'thinking' ? (
                  <span className="text-violet-400 italic animate-pulse">
                    {liveTranscript?.user ? `Heard: "${liveTranscript.user.slice(0, 60)}${liveTranscript.user.length > 60 ? '…' : ''}" — thinking…` : 'Thinking…'}
                  </span>
                ) : convPhase === 'speaking' ? (
                  <span className="text-indigo-300">{liveTranscript?.aura ?? '…'}</span>
                ) : convPhase === 'interrupted' ? (
                  <span className="text-amber-400 italic">Interrupted</span>
                ) : liveTranscript?.aura ? (
                  <span className="text-zinc-300">{liveTranscript.aura}</span>
                ) : (
                  <span className="text-zinc-600 italic">Response will appear here</span>
                )}
              </span>
            </div>
            {/* VAD / mic denied hint — only very brief inline indicator, errors go to toast */}
            {(micDenied || micUnsupported) && (
              <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg">
                {micDenied
                  ? 'Mic permission denied — allow access in Windows Privacy Settings.'
                  : 'Microphone not supported in this environment.'}
              </div>
            )}
            <div className="flex items-center gap-3 pt-0.5">
              {voiceSettings.autoStopEnabled && (
                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-zinc-600" />
                  Auto-stop on pause
                </span>
              )}
              {voiceSettings.wakePhrase && wakePhrase.status === 'listening' && (
                <span className="text-[10px] text-amber-500/70 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                  Wake phrase active
                </span>
              )}
              {hotkeyHint && (
                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                  <Keyboard className="w-2.5 h-2.5" />
                  Ctrl+Shift+Space
                </span>
              )}
            </div>
          </div>
        )}

        {/* History toggle */}
        {voiceSettings.enabled && turns.length > 1 && (
          <div className="w-full max-w-md">
            <button
              onClick={() => setConvOpen(p => !p)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-zinc-900/40 border border-zinc-800/40 rounded-xl text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Radio className="w-2.5 h-2.5" />
                History ({turns.length - 1} earlier)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleClearConversation(); setLiveTranscript(null); }}
                  className="p-0.5 text-zinc-600 hover:text-rose-400 transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
                {convOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </div>
            </button>
            {convOpen && (
              <div className="max-h-36 overflow-y-auto bg-zinc-950/80 border border-zinc-800/40 border-t-0 rounded-b-xl px-3 py-2 space-y-1.5">
                {turns.slice(0, -1).map(turn => (
                  <div key={turn.id} className="space-y-0.5">
                    <p className="text-[10px] text-zinc-500">
                      <span className="text-sky-400 font-semibold">You </span>{turn.userText}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      <span className="text-indigo-400 font-semibold">AURA </span>{turn.auraText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Spacer so bottom strip never overlaps last card */}
        <div className="shrink-0 h-24" aria-hidden />
      </div>

      {/* ApprovalTray — above bottom strip */}
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

      {/* ── ZONE 5: Bottom controls — fixed at bottom, never overlaps content ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <div className="px-4 pt-2 pb-4 bg-gradient-to-t from-zinc-950/95 via-zinc-950/80 to-transparent pointer-events-auto">
          <div className="max-w-lg mx-auto flex flex-col gap-2">

            {/* Row 1: mute + speak / control */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleMuteToggle}
                title={runtime.isMuted ? 'Unmute' : 'Mute'}
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-full border transition-all shrink-0',
                  runtime.isMuted
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                    : 'bg-zinc-900/80 border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
                )}
              >
                {runtime.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 opacity-30" />}
              </button>

              {voiceSettings.enabled ? (
                convPhase === 'speaking' ? (
                  <div className="flex items-center gap-2">
                    {voiceSettings.interruptEnabled && (
                      <button
                        onClick={handleSpeakStart}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-[13px] bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/40 text-rose-300 shadow-lg transition-all"
                      >
                        <Mic className="w-4 h-4" /> Interrupt
                      </button>
                    )}
                    <button
                      onClick={handleStopPlayback}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-[13px] bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition-all"
                    >
                      <MicOff className="w-4 h-4" /> Skip
                    </button>
                  </div>
                ) : convPhase === 'recording' ? (
                  voiceSettings.autoStopEnabled ? (
                    <button
                      onClick={handleSpeakStop}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30 shadow-lg transition-all"
                    >
                      <Mic className="w-4 h-4" />
                      {vadPhase === 'speech_detected' ? 'Speaking…' : vadPhase === 'silence_detected' ? 'Paused…' : 'Finish'}
                    </button>
                  ) : (
                    <button
                      onClick={handleSpeakStop}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30 shadow-lg transition-all animate-pulse"
                    >
                      <Mic className="w-4 h-4" /> Finish
                    </button>
                  )
                ) : (
                  <button
                    onClick={handleSpeakStart}
                    disabled={(convPhase !== 'idle' && convPhase !== 'speaking') || micDenied || micUnsupported}
                    className={cn(
                      'flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] shadow-lg transition-all',
                      ((convPhase !== 'idle' && convPhase !== 'speaking') || micDenied || micUnsupported)
                        ? 'bg-indigo-600/40 text-white/50 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25',
                    )}
                  >
                    <Mic className="w-4 h-4" />
                    {convPhase !== 'idle' && convPhase !== 'speaking' ? convPhaseLabel(convPhase) : 'Speak'}
                  </button>
                )
              ) : (
                <button
                  onClick={handleMockSpeakToggle}
                  disabled={runtime.isMuted}
                  className={cn(
                    'flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] transition-all shadow-lg',
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

              <button
                onClick={() => setVoiceSettings(s => ({ ...s, enabled: !s.enabled }))}
                title="Toggle voice conversation"
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all shrink-0',
                  voiceSettings.enabled
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-zinc-900/60 border-zinc-700/40 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300',
                )}
              >
                <Radio className="w-2.5 h-2.5" />
                {voiceSettings.enabled ? 'On' : 'Off'}
              </button>
            </div>

            {/* Row 2: secondary nav */}
            <div className="flex items-center justify-center gap-1.5">
              <button onClick={onOpenConsole}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
                <Terminal className="w-3 h-3" /> Console
              </button>
              <button onClick={onOpenAdminPanel}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
                <LayoutGrid className="w-3 h-3" /> Admin
              </button>
              <button onClick={onOpenTechnicalDrawer}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
                <Settings2 className="w-3 h-3" /> Details
              </button>
              <button onClick={() => runtime.toggleSafeMode()}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors',
                  runtime.isSafeMode
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300',
                )}>
                <Eye className="w-3 h-3" /> Safe
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

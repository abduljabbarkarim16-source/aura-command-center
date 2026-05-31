/**
 * AuraVoiceCore - voice-first operator surface
 *
 * Two modes:
 *  1. Conversation Mode (hands-free loop): Start -> listen -> respond -> listen...
 *     Barge-in, dormancy, stop phrases all handled automatically.
 *  2. One-Shot Speak (manual fallback): click Speak -> speak -> click Finish.
 *
 * Runtime voice behavior:
 *  - Conversation mode with auto-listen-after-response
 *  - Natural barge-in via secondary AnalyserNode while TTS plays
 *  - Wake phrase: improved status + test button
 *  - All errors -> NotificationService (no inline banners)
 *  - Keyboard hotkey Ctrl+Shift+Space
 *
 * Security: API key never in this component.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Terminal, Settings2,
  Radio, Shield,
  Keyboard, PlayCircle, StopCircle,
  AlertTriangle, Moon, Pin, Zap,
} from 'lucide-react';
import { auraMemoryService } from '../../services/memory/AuraMemoryService';
import { auraPersonalityService } from '../../services/personality/AuraPersonalityService';
import { cn } from '../../lib/utils';
import { AuraVoiceVisualizer } from './AuraVoiceVisualizer';
import type { VisualizerState } from './AuraVoiceVisualizer';
import { AmbientCanvas, type AmbientState } from './AmbientCanvas';
import { AdminVoiceIndicator } from './AdminVoiceIndicator';
import type { AdminVoiceState } from './AdminVoiceIndicator';
import { ApprovalTray } from './ApprovalTray';
import { NotificationCenter } from './NotificationCenter';
import { NotificationToast } from './NotificationToast';
import { PermissionModeSelector } from './PermissionModeSelector';
import { useVoiceRuntime } from '../../hooks/useVoiceRuntime';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useVoiceActivityRecorder } from '../../hooks/useVoiceActivityRecorder';
import { useSegmentedVoiceSession } from '../../hooks/useSegmentedVoiceSession';
import { useWakePhrase, DEFAULT_WAKE_PHRASES } from '../../hooks/useWakePhrase';
import { useVoiceHotkey } from '../../hooks/useVoiceHotkey';
import { useConversationLoop } from '../../hooks/useConversationLoop';
import { openAIVoiceSessionService } from '../../services/voice/OpenAIVoiceSessionService';
import { notifyVoiceError, notifyVoiceSuccess } from '../../services/notifications/NotificationService';
import { voiceTranscriptLogService } from '../../services/voice/VoiceTranscriptLogService';
import type { VoiceRuntimeState } from '../../types/voice-runtime';
import type { VoiceConversationTurn, VoiceConversationSettings } from '../../types/voice-session';
import { DEFAULT_VOICE_SETTINGS } from '../../types/voice-session';

// --- Constants ----------------------------------------------------------------

const GREETING_SESSION_KEY = 'aura_greeting_shown';
const MAX_VISIBLE_TURNS = 5;
const MAX_BLOB_BYTES = 24 * 1024 * 1024;
const LONG_SPEECH_BLOB_BYTES = 500 * 1024;

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

// --- One-shot conversation phase (manual mode) --------------------------------

type OneShotPhase =
  | 'idle'
  | 'connecting'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error';

function oneShotPhaseLabel(phase: OneShotPhase): string {
  switch (phase) {
    case 'connecting':   return 'Starting...';
    case 'recording':    return 'Listening...';
    case 'transcribing': return 'Processing...';
    case 'thinking':     return 'Thinking...';
    case 'speaking':     return 'Speaking...';
    case 'interrupted':  return 'Interrupted';
    case 'error':        return 'Error';
    default:             return '';
  }
}

function oneShotPhaseVisualizer(phase: OneShotPhase): VisualizerState {
  switch (phase) {
    case 'connecting':   return 'thinking';
    case 'recording':    return 'listening';
    case 'transcribing': return 'thinking';
    case 'thinking':     return 'thinking';
    case 'speaking':     return 'speaking';
    default:             return 'idle';
  }
}

// --- Conversation mode visualizer mapping -------------------------------------

import type { LoopPhase } from '../../hooks/useConversationLoop';

function loopPhaseVisualizer(phase: LoopPhase): VisualizerState {
  switch (phase) {
    case 'listening':       return 'listening';
    case 'transcribing':    return 'thinking';
    case 'acknowledging':   return 'thinking';
    case 'thinking':        return 'thinking';
    case 'preparing_voice': return 'thinking';
    case 'speaking':        return 'speaking';
    case 'dormant':         return 'idle';
    case 'error':           return 'error';
    default:                return 'idle';
  }
}

function loopPhaseLabel(phase: LoopPhase): string {
  switch (phase) {
    case 'listening':       return 'Listening...';
    case 'transcribing':    return 'Processing...';
    case 'acknowledging':   return 'Heard...';
    case 'thinking':        return 'Thinking...';
    case 'preparing_voice': return 'Preparing voice...';
    case 'speaking':        return 'Speaking...';
    case 'dormant':         return 'Dormant';
    case 'error':           return 'Error';
    default:                return '';
  }
}

// --- Props --------------------------------------------------------------------

interface AuraVoiceCoreProps {
  /** @deprecated */ auraState?: VisualizerState;
  /** @deprecated */ adminVoiceState?: AdminVoiceState;
  /** @deprecated */ safeMonitorMode?: boolean;
  onOpenConsole: () => void;
  onOpenTechnicalDrawer: () => void;
}

// --- Component ----------------------------------------------------------------

export function AuraVoiceCore({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  auraState: _a,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  adminVoiceState: _b,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  safeMonitorMode: _c,
  onOpenConsole,
  onOpenTechnicalDrawer,
}: AuraVoiceCoreProps) {

  const runtime = useVoiceRuntime();

  // -- Settings ---------------------------------------------------------------
  const [voiceSettings, setVoiceSettings] = useState<VoiceConversationSettings>(() => {
    try {
      const stored = localStorage.getItem('voice.conversation.settings');
      const parsed = stored ? (JSON.parse(stored) as Partial<VoiceConversationSettings>) : {};
      return { ...DEFAULT_VOICE_SETTINGS, ...parsed };
    } catch { return { ...DEFAULT_VOICE_SETTINGS }; }
  });

  // Conversation mode settings (extra - not in base VoiceConversationSettings yet)
  const [conversationModeEnabled, setConversationModeEnabled] = useState(false);
  const [autoListen] = useState(true);
  const [dormancyMs] = useState(90_000); // 90s default

  // -- Shared turn history ----------------------------------------------------
  const [turns, setTurns]         = useState<VoiceConversationTurn[]>([]);
  const greetedRef                = useRef(false);

  const addTurn = useCallback((turn: VoiceConversationTurn) => {
    setTurns(prev => [...prev, turn].slice(-MAX_VISIBLE_TURNS));
  }, []);

  const extractMemoryIfEnabled = useCallback((userText: string, auraText: string) => {
    if (!voiceSettingsRef.current.autoMemoryEnabled) return;
    openAIVoiceSessionService.extractMemory(userText, auraText).then(result => {
      if (result.facts.length > 0) {
        auraMemoryService.addMany(result.facts, 'auto', userText.slice(0, 100));
      }
    });
  }, []);

  // -- Conversation loop (hands-free mode) ------------------------------------
  const [loopPhaseLabel_text, setLoopPhaseLabel] = useState('');
  const loop = useConversationLoop({
    voiceSettings,
    autoListen,
    dormancyMs,
    stopPhrases: ['stop listening', 'pause conversation', "that's all", 'go idle', 'stop aura'],
    onTurnComplete: addTurn,
    onPhaseChange: (phase) => setLoopPhaseLabel(loopPhaseLabel(phase)),
    fastResponseMode:    voiceSettings.fastResponseMode ?? false,
    sentenceFirstTTS:    voiceSettings.sentenceFirstTTS ?? true,
    toolDispatchEnabled: voiceSettings.toolDispatchEnabled ?? true,
  });

  // -- One-shot manual mode ---------------------------------------------------
  const [oneShotPhase, setOneShotPhase]     = useState<OneShotPhase>('idle');
  const [liveTranscriptOS, setLiveTranscriptOS] = useState<{ user: string; aura: string } | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl]   = useState<string | null>(null);
  const audioRef         = useRef<HTMLAudioElement | null>(null);
  const runningRef       = useRef(false);
  const recordStartRef   = useRef<number | null>(null);
  const voiceSettingsRef = useRef(voiceSettings);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);

  const manualRecorder = useVoiceRecorder(voiceSettings.maxRecordingDurationMs);
  const onAutoStopRef  = useRef<(() => void) | undefined>(undefined);
  const vadRecorder    = useVoiceActivityRecorder({
    silenceThresholdMs: voiceSettings.silenceThresholdMs,
    minSpeechMs:        600,
    maxDurationMs:      voiceSettings.maxRecordingDurationMs,
    onAutoStop:         () => { onAutoStopRef.current?.(); },
  });

  // Segmented session for one-shot long speech (QA3)
  const segmentedOneShot = useSegmentedVoiceSession({
    segmentMs:          voiceSettings.segmentLengthMs ?? 8_000,
    silenceThresholdMs: voiceSettings.silenceThresholdMs,
    minSpeechMs:        600,
    maxDurationMs:      voiceSettings.maxThoughtMs ?? 90_000,
    cleanupEnabled:     voiceSettings.cleanupEnabled ?? true,
    onAutoStop:         () => { onAutoStopRef.current?.(); },
  });

  const oneshotRecorder = voiceSettings.autoStopEnabled ? vadRecorder : manualRecorder;

  // -- Wake phrase ------------------------------------------------------------
  const handleWakeActivated = useCallback(() => {
    if (conversationModeEnabled && loop.loopPhase === 'idle') {
      loop.startConversation();
    } else if (!conversationModeEnabled && oneShotPhase === 'idle' && !runningRef.current) {
      handleOneShotStartRef.current?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationModeEnabled, oneShotPhase, loop.loopPhase]);

  const wakePhrase = useWakePhrase({
    enabled:     voiceSettings.wakePhrase,
    phrases:     [...DEFAULT_WAKE_PHRASES, 'hey aurora', 'hey ora', 'aura', 'aurora'],
    onActivated: handleWakeActivated,
    onUnavailable: useCallback(() => {
      console.warn('[WakePhrase] SpeechRecognition unavailable in this environment');
    }, []),
  });

  const handleOneShotStartRef = useRef<(() => Promise<void>) | null>(null);

  // -- Sync transcript log persistence ---------------------------------------
  useEffect(() => {
    voiceTranscriptLogService.setPersistEnabled(voiceSettings.persistTranscripts ?? false);
  }, [voiceSettings.persistTranscripts]);

  useEffect(() => {
    try { localStorage.setItem('voice.conversation.settings', JSON.stringify(voiceSettings)); }
    catch { /* ignore */ }
  }, [voiceSettings]);

  // -- Wake phrase lifecycle --------------------------------------------------
  useEffect(() => {
    const isIdle = conversationModeEnabled ? loop.loopPhase === 'idle' : oneShotPhase === 'idle';
    if (voiceSettings.wakePhrase && voiceSettings.enabled && isIdle) {
      wakePhrase.start();
    } else {
      wakePhrase.stop();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceSettings.wakePhrase, voiceSettings.enabled, loop.loopPhase, oneShotPhase, conversationModeEnabled]);

  // -- Voice intro ------------------------------------------------------------
  useEffect(() => {
    if (greetedRef.current || sessionStorage.getItem(GREETING_SESSION_KEY)) {
      greetedRef.current = true; return;
    }
    greetedRef.current = true;
    sessionStorage.setItem(GREETING_SESSION_KEY, '1');

    const timer = setTimeout(async () => {
      const settings = voiceSettingsRef.current;
      const result = await openAIVoiceSessionService.synthesizeSpeech("AURA online. Ready.", settings.ttsVoice);
      if (result.success && result.audioBlobUrl) {
        setOneShotPhase('speaking');
        const audio = new Audio(result.audioBlobUrl);
        audio.onended = () => { setOneShotPhase('idle'); URL.revokeObjectURL(result.audioBlobUrl!); };
        audio.onerror = () => { setOneShotPhase('idle'); notifyVoiceSuccess('AURA online. Ready.'); };
        audio.play().catch(() => { setOneShotPhase('idle'); notifyVoiceSuccess('AURA online. Ready.'); });
      } else {
        notifyVoiceSuccess('AURA online. Ready.');
      }
    }, 1200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- One-shot processing pipeline -------------------------------------------
  const processOneShotBlob = useCallback(async (blob: Blob, durationMs: number) => {
    runningRef.current = true;
    setOneShotPhase('transcribing');
    setLiveTranscriptOS({ user: '...', aura: '' });

    if (blob.size === 0) {
      notifyVoiceError('No audio captured. Check microphone permissions.');
      setOneShotPhase('idle'); setLiveTranscriptOS(null); runningRef.current = false; return;
    }
    if (blob.size < 200 && durationMs > 500) {
      notifyVoiceError('Mic input too quiet - speak closer to the mic.');
      setOneShotPhase('idle'); setLiveTranscriptOS(null); runningRef.current = false; return;
    }
    if (blob.size > MAX_BLOB_BYTES) {
      notifyVoiceError('Recording too long - keep under 45 seconds.');
      setOneShotPhase('idle'); setLiveTranscriptOS(null); runningRef.current = false; return;
    }
    if (blob.size > LONG_SPEECH_BLOB_BYTES) setLiveTranscriptOS({ user: 'Long thought captured...', aura: '' });

    const sttResult = await openAIVoiceSessionService.transcribeAudio(blob);
    if (!sttResult.success) {
      notifyVoiceError(sttResult.error ?? 'Could not understand audio.');
      setOneShotPhase('idle'); setLiveTranscriptOS(null); runningRef.current = false; return;
    }
    if (!sttResult.text?.trim()) {
      notifyVoiceError('No speech detected - try speaking closer to the mic.');
      setOneShotPhase('idle'); setLiveTranscriptOS(null); runningRef.current = false; return;
    }

    setLiveTranscriptOS({ user: sttResult.text, aura: '' });
    setOneShotPhase('thinking');

    const style = voiceSettingsRef.current.responseStyle ?? 'normal';
    const systemPrompt = auraPersonalityService.buildSystemPrompt({ responseStyle: style });
    const chatResult = await openAIVoiceSessionService.createChatResponse(
      sttResult.text, style, systemPrompt,
    );
    if (!chatResult.success || !chatResult.text) {
      notifyVoiceError(chatResult.error ?? 'AI response failed.');
      setOneShotPhase('idle'); runningRef.current = false; return;
    }

    const turn: VoiceConversationTurn = {
      id: `turn-${Date.now()}`, userText: sttResult.text, auraText: chatResult.text,
      timestamp: new Date().toISOString(), sttLatencyMs: sttResult.latencyMs, chatLatencyMs: chatResult.latencyMs,
    };
    addTurn(turn);
    setLiveTranscriptOS({ user: sttResult.text, aura: chatResult.text });
    voiceTranscriptLogService.logTurn({ userText: sttResult.text, auraText: chatResult.text, durationMs });
    extractMemoryIfEnabled(sttResult.text, chatResult.text);

    const ttsResult = await openAIVoiceSessionService.synthesizeSpeech(chatResult.text, voiceSettingsRef.current.ttsVoice);
    if (!ttsResult.success || !ttsResult.audioBlobUrl) {
      setOneShotPhase('idle'); runningRef.current = false; return;
    }

    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    setCurrentAudioUrl(ttsResult.audioBlobUrl);
    setOneShotPhase('speaking');
    const audio = new Audio(ttsResult.audioBlobUrl);
    audioRef.current = audio;
    audio.onended = () => {
      setOneShotPhase('idle'); URL.revokeObjectURL(ttsResult.audioBlobUrl!);
      setCurrentAudioUrl(null); runningRef.current = false;
    };
    audio.onerror = () => { setOneShotPhase('idle'); runningRef.current = false; };
    audio.play().catch(() => { setOneShotPhase('idle'); runningRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAudioUrl, addTurn, extractMemoryIfEnabled]);

  // -- One-shot handlers ------------------------------------------------------
  const handleOneShotStart = useCallback(async () => {
    if (oneShotPhase === 'speaking' && voiceSettings.interruptEnabled) {
      audioRef.current?.pause();
      if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl(null); runningRef.current = false;
      setOneShotPhase('idle'); await new Promise(r => setTimeout(r, 50));
    }
    if (runningRef.current || (oneShotPhase !== 'idle' && oneShotPhase !== 'interrupted')) return;
    setLiveTranscriptOS(null); setOneShotPhase('connecting');
    // Use segmented session for VAD auto-stop; manual recorder otherwise
    if (voiceSettings.autoStopEnabled) {
      await segmentedOneShot.startSession();
    } else {
      await manualRecorder.startRecording();
    }
    recordStartRef.current = Date.now();
    setOneShotPhase('recording');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oneShotPhase, segmentedOneShot, manualRecorder, currentAudioUrl, voiceSettings.interruptEnabled, voiceSettings.autoStopEnabled]);

  useEffect(() => { handleOneShotStartRef.current = handleOneShotStart; }, [handleOneShotStart]);

  const handleOneShotStop = useCallback(async () => {
    if (oneShotPhase !== 'recording' || runningRef.current) return;
    const elapsed = recordStartRef.current ? Date.now() - recordStartRef.current : 0;
    if (elapsed < 400) { notifyVoiceError('Hold Speak a moment - say your message first.'); return; }

    if (voiceSettings.autoStopEnabled) {
      // Segmented path: stopSession() returns the assembled transcript
      setOneShotPhase('transcribing');
      setLiveTranscriptOS({ user: '...', aura: '' });
      const transcript = await segmentedOneShot.stopSession();
      if (!transcript) {
        notifyVoiceError('No speech detected. Try speaking closer to the microphone.');
        setOneShotPhase('idle'); setLiveTranscriptOS(null); return;
      }
      // Run chat + TTS with already-transcribed text
      runningRef.current = true;
      setLiveTranscriptOS({ user: transcript, aura: '' });
      setOneShotPhase('thinking');
      const style = voiceSettingsRef.current.responseStyle ?? 'normal';
      const systemPrompt = auraPersonalityService.buildSystemPrompt({ responseStyle: style });
      const chatResult = await openAIVoiceSessionService.createChatResponse(
        transcript, style, systemPrompt,
      );
      if (!chatResult.success || !chatResult.text) {
        notifyVoiceError(chatResult.error ?? 'AI response failed.');
        setOneShotPhase('idle'); runningRef.current = false; return;
      }
      const turn: VoiceConversationTurn = {
        id: `turn-${Date.now()}`, userText: transcript, auraText: chatResult.text,
        timestamp: new Date().toISOString(), chatLatencyMs: chatResult.latencyMs,
      };
      addTurn(turn);
      setLiveTranscriptOS({ user: transcript, aura: chatResult.text });
      voiceTranscriptLogService.logTurn({ userText: transcript, auraText: chatResult.text, durationMs: elapsed, chatLatencyMs: chatResult.latencyMs });
      extractMemoryIfEnabled(transcript, chatResult.text);
      const ttsResult = await openAIVoiceSessionService.synthesizeSpeech(chatResult.text, voiceSettingsRef.current.ttsVoice);
      if (!ttsResult.success || !ttsResult.audioBlobUrl) { setOneShotPhase('idle'); runningRef.current = false; return; }
      if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl(ttsResult.audioBlobUrl);
      setOneShotPhase('speaking');
      const audio = new Audio(ttsResult.audioBlobUrl);
      audioRef.current = audio;
      audio.onended = () => { setOneShotPhase('idle'); URL.revokeObjectURL(ttsResult.audioBlobUrl!); setCurrentAudioUrl(null); runningRef.current = false; };
      audio.onerror = () => { setOneShotPhase('idle'); runningRef.current = false; };
      audio.play().catch(() => { setOneShotPhase('idle'); runningRef.current = false; });
    } else {
      // Manual recorder path: use blob-based pipeline
      const blob = await manualRecorder.stopRecording();
      if (!blob) { notifyVoiceError('No audio captured.'); setOneShotPhase('idle'); return; }
      await processOneShotBlob(blob, elapsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oneShotPhase, segmentedOneShot, manualRecorder, processOneShotBlob, currentAudioUrl, voiceSettings.autoStopEnabled, addTurn, extractMemoryIfEnabled]);

  // VAD auto-stop for one-shot (segmented session fires onAutoStop)
  useEffect(() => {
    onAutoStopRef.current = () => {
      if (oneShotPhase === 'recording' && !runningRef.current) handleOneShotStop();
    };
  }, [oneShotPhase, handleOneShotStop]);

  // -- Hotkey -----------------------------------------------------------------
  const isProcessing = conversationModeEnabled
    ? (loop.loopPhase === 'transcribing' || loop.loopPhase === 'thinking')
    : (oneShotPhase === 'transcribing' || oneShotPhase === 'thinking');

  useVoiceHotkey({
    enabled:      voiceSettings.enabled,
    isRecording:  conversationModeEnabled ? loop.loopPhase === 'listening' : oneShotPhase === 'recording',
    isProcessing,
    onActivate: () => {
      if (conversationModeEnabled) {
        if (loop.loopPhase === 'idle' || loop.loopPhase === 'dormant') loop.startConversation();
        else if (loop.loopPhase === 'speaking') loop.interruptSpeech();
      } else {
        handleOneShotStartRef.current?.();
      }
    },
    onDeactivate: () => {
      if (conversationModeEnabled) loop.stopConversation();
      else handleOneShotStop();
    },
  });

  const handleStopPlayback = useCallback(() => {
    audioRef.current?.pause();
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    setCurrentAudioUrl(null); setOneShotPhase('idle'); runningRef.current = false;
  }, [currentAudioUrl]);

  // -- Approval data ----------------------------------------------------------
  const allApprovals       = runtime.pendingApprovals;
  const pendingCount       = allApprovals.filter(a => a.status === 'pending').length;
  const activeTrayApproval = allApprovals.find(a => a.status === 'pending') ?? allApprovals.find(a => a.status !== 'pending');
  const trayRiskLevel      = activeTrayApproval?.riskLevel ?? 'medium';
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  useEffect(() => { if (allApprovals.length === 0) setIsTrayOpen(false); }, [allApprovals.length]);

  const handleApprove = () => { if (activeTrayApproval) runtime.resolveApproval(activeTrayApproval.id, 'approved'); };
  const handleReject  = () => { if (activeTrayApproval) runtime.resolveApproval(activeTrayApproval.id, 'rejected'); };

  // -- Derived state ----------------------------------------------------------
  const oneshotMicPermission = voiceSettings.autoStopEnabled ? segmentedOneShot.micPermission : oneshotRecorder.state.micPermission;
  const micDenied      = conversationModeEnabled ? loop.micPermission === 'denied'      : oneshotMicPermission === 'denied';
  const micUnsupported = conversationModeEnabled ? loop.micPermission === 'unsupported' : oneshotMicPermission === 'unsupported';
  const vadPhase       = conversationModeEnabled ? loop.vadPhase  : (voiceSettings.autoStopEnabled ? segmentedOneShot.vadPhase : 'recording' as const);
  const micLevel       = conversationModeEnabled ? loop.micLevel  : (voiceSettings.autoStopEnabled ? segmentedOneShot.micLevel : 0);
  const durationMs     = conversationModeEnabled ? loop.durationMs : (voiceSettings.autoStopEnabled ? segmentedOneShot.durationMs : oneshotRecorder.state.durationMs);
  // Show partial segment transcript during one-shot long recording
  const liveTranscript = conversationModeEnabled
    ? loop.liveTranscript
    : (liveTranscriptOS ?? (segmentedOneShot.liveTranscript ? { user: segmentedOneShot.liveTranscript, aura: '' } : null));

  const effectivePhaseForVisualizer = conversationModeEnabled
    ? loopPhaseVisualizer(loop.loopPhase)
    : oneShotPhaseVisualizer(oneShotPhase);

  const isVoiceActive  = conversationModeEnabled ? loop.loopPhase !== 'idle' : oneShotPhase !== 'idle';
  const effectiveVis: VisualizerState = voiceSettings.enabled && isVoiceActive
    ? effectivePhaseForVisualizer
    : RUNTIME_TO_VISUALIZER[runtime.state] ?? 'idle';

  // Map the visualizer state onto the living ambient background behind the orb.
  const ambientState: AmbientState =
    effectiveVis === 'executing' || effectiveVis === 'waiting_for_approval' ? 'working'
      : effectiveVis === 'listening' ? 'listening'
        : effectiveVis === 'thinking' ? 'thinking'
          : effectiveVis === 'speaking' ? 'speaking'
            : effectiveVis === 'error' ? 'error'
              : 'idle';

  const adminState: AdminVoiceState = (() => {
    if (runtime.isMuted) return 'muted';
    const isRecording = conversationModeEnabled ? loop.loopPhase === 'listening' : oneShotPhase === 'recording';
    if (runtime.activeSpeaker === 'admin' || (voiceSettings.enabled && isRecording)) return 'speaking';
    return 'idle';
  })();

  // -- You row ----------------------------------------------------------------
  const isListeningState = conversationModeEnabled ? loop.loopPhase === 'listening' : oneShotPhase === 'recording';
  const isConnecting     = conversationModeEnabled ? false : oneShotPhase === 'connecting';

  function youRowContent() {
    if (isConnecting) return <span className="text-zinc-500 italic">Starting microphone...</span>;
    if (isListeningState) {
      const durationSec = (durationMs / 1000).toFixed(1);
      if (vadPhase === 'calibrating') return (
        <span className="flex items-center gap-1.5 text-zinc-500 italic">
          <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse shrink-0" />Calibrating mic...
        </span>
      );
      if (vadPhase === 'speech_detected') return (
        <span className="flex items-center gap-2 text-rose-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
          Speaking...
          <span className="text-zinc-500 font-normal text-[10px]">{durationSec}s</span>
          <span className="flex-1 max-w-[60px] h-1 bg-zinc-800 rounded-full overflow-hidden">
            <span className="h-full bg-rose-500 rounded-full block transition-all duration-75" style={{ width: `${Math.round(micLevel * 100)}%` }} />
          </span>
        </span>
      );
      if (vadPhase === 'silence_detected') return (
        <span className="flex items-center gap-1.5 text-amber-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />Pause detected...
          <span className="text-zinc-500 font-normal text-[10px]">{durationSec}s</span>
        </span>
      );
      if (vadPhase === 'auto_stopping') return (
        <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />Processing...
        </span>
      );
      const hint = conversationModeEnabled ? `Listening... ${durationSec}s` : `Recording... ${durationSec}s`;
      return (
        <span className="flex items-center gap-1.5 text-sky-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shrink-0" />{hint}
        </span>
      );
    }
    if (liveTranscript?.user && liveTranscript.user !== '...') {
      return <span className="text-zinc-200">{liveTranscript.user}</span>;
    }
    if (conversationModeEnabled && loop.loopPhase === 'dormant') {
      return <span className="text-zinc-500 italic flex items-center gap-1.5"><Moon className="w-3 h-3" />Dormant - speak to resume</span>;
    }
    const hint = conversationModeEnabled
      ? 'Start Conversation - AURA will keep listening after each response'
      : (voiceSettings.autoStopEnabled ? 'Press Speak or Ctrl+Shift+Space, talk, then pause' : 'Press Speak, talk, then click Finish');
    return <span className="text-zinc-600 italic">{hint}</span>;
  }

  // --- Render ---------------------------------------------------------------
  return (
    <div className="relative flex flex-col h-full min-h-0 w-full bg-zinc-950 overflow-hidden">
      {/* Living visual work surface — premium when idle, reactive to voice/task state */}
      <AmbientCanvas state={ambientState} />
      <NotificationToast position="top-right" maxVisible={3} />

      {/* -- Status strip: orb-centric, minimal top -- */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-2.5 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Wake-phrase pill only when actively listening/activated - no static chips */}
          {voiceSettings.wakePhrase && (wakePhrase.status === 'listening' || wakePhrase.status === 'activated') && (
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold',
              wakePhrase.status === 'listening' && 'bg-amber-500/10 border-amber-500/30 text-amber-400',
              wakePhrase.status === 'activated' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
            )}>
              {wakePhrase.status === 'listening'  && <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Wake</>}
              {wakePhrase.status === 'activated'  && <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Hey AURA!</>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
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

      {/* Mission state lives in Console and Memory. */}

      {/* -- Orb + transcript (scrollable) -- */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 pt-16 pb-0 gap-3">
        <AuraVoiceVisualizer state={effectiveVis} source={conversationModeEnabled && loop.loopPhase === 'listening' ? 'admin' : 'aura'} size="xl" showLabel />
        {isVoiceActive && <AdminVoiceIndicator state={adminState} />}

        {/* Live transcript */}
        {voiceSettings.enabled && (liveTranscript || isVoiceActive || micDenied || micUnsupported) && (
          <div className="w-full max-w-xl bg-zinc-950/70 border border-zinc-800/60 rounded-xl px-4 py-3 space-y-2 shadow-xl">
            <div className="flex items-start gap-2.5 min-h-[1.4rem]">
              <span className="text-sky-400 text-[11px] font-semibold shrink-0 mt-0.5 w-8">You</span>
              <span className="text-[12px] leading-relaxed flex-1">{youRowContent()}</span>
            </div>
            <div className="flex items-start gap-2.5 min-h-[1.4rem]">
              <span className="text-indigo-400 text-[11px] font-semibold shrink-0 mt-0.5 w-8">AURA</span>
              <span className="text-[12px] leading-relaxed flex-1">
                {(() => {
                  const ph = conversationModeEnabled ? loop.loopPhase : oneShotPhase;
                  if (ph === 'transcribing')    return <span className="text-violet-400 italic animate-pulse">Transcribing...</span>;
                  if (ph === 'acknowledging')   return <span className="text-amber-400 font-medium">{liveTranscript?.aura ?? 'Got it.'}</span>;
                  if (ph === 'thinking')        return <span className="text-violet-400 italic animate-pulse">{liveTranscript?.user ? `"${liveTranscript.user.slice(0,50)}..." - thinking...` : 'Thinking...'}</span>;
                  if (ph === 'preparing_voice') return <span className="text-sky-400 italic animate-pulse">Preparing voice...</span>;
                  if (ph === 'speaking')        return <span className="text-indigo-300">{liveTranscript?.aura ?? '...'}</span>;
                  if (liveTranscript?.aura)     return <span className="text-zinc-300">{liveTranscript.aura}</span>;
                  return <span className="text-zinc-600 italic">Ready when you speak</span>;
                })()}
              </span>
            </div>

            {/* Mic error (persistent state, not transient errors) */}
            {(micDenied || micUnsupported) && (
              <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {micDenied ? 'Mic permission denied - allow in Windows Privacy Settings.' : 'Microphone not supported in this environment.'}
              </div>
            )}

            {/* Status hints + latency display */}
            <div className="flex items-center gap-3 pt-0.5 flex-wrap">
              {conversationModeEnabled && (
                <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  Conversation mode active
                </span>
              )}
              {voiceSettings.fastResponseMode && (
                <span className="text-[10px] text-amber-500 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500" />Fast
                </span>
              )}
              {!conversationModeEnabled && voiceSettings.autoStopEnabled && (
                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-zinc-600" />Auto-stop on pause
                </span>
              )}
              {/* Remember this - save last AURA response to memory */}
              {liveTranscript?.aura && loop.loopPhase !== 'listening' && loop.loopPhase !== 'idle' && (
                <button
                  onClick={() => loop.rememberLastTurn(
                    liveTranscript.user ?? '',
                    liveTranscript.aura ?? '',
                    'task',
                  )}
                  title="Save this to AURA's memory"
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-indigo-400 transition-colors"
                >
                  <Pin className="w-2.5 h-2.5" /> Remember
                </button>
              )}

              {/* Latency display (last turn) */}
              {loop.lastLatencyMetrics && (
                <span
                  className="text-[9px] text-zinc-700 flex items-center gap-1 cursor-default"
                  title={[
                    `Perceived: ${loop.lastLatencyMetrics.perceivedLatencyMs}ms`,
                    `Chat: ${loop.lastLatencyMetrics.chatTotalMs}ms`,
                    `TTS: ${loop.lastLatencyMetrics.ttsSynthesisMs}ms`,
                    loop.lastLatencyMetrics.firstAudioStartMs != null
                      ? `First audio: ${loop.lastLatencyMetrics.firstAudioStartMs}ms`
                      : null,
                    loop.lastLatencyMetrics.fullAudioReadyMs != null
                      ? `Full audio: ${loop.lastLatencyMetrics.fullAudioReadyMs}ms`
                      : null,
                  ].filter(Boolean).join(' / ')}
                >
                  Time {loop.lastLatencyMetrics.firstAudioStartMs != null
                    ? `${loop.lastLatencyMetrics.firstAudioStartMs}ms first`
                    : `${loop.lastLatencyMetrics.perceivedLatencyMs}ms`}
                </span>
              )}
              <span className="text-[10px] text-zinc-700 flex items-center gap-1 ml-auto">
                <Keyboard className="w-2.5 h-2.5" />Ctrl+Shift+Space
              </span>
            </div>
          </div>
        )}

        {voiceSettings.enabled && turns.length > 0 && (
          <p className="text-[10px] text-zinc-700">{turns.length} voice turn{turns.length === 1 ? '' : 's'} stored in Details.</p>
        )}

        {!voiceSettings.enabled && (
          <div className="w-full max-w-md rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-4 py-3 text-center text-[12px] text-zinc-600">
            Voice is off. Enable it in Settings or use Console.
          </div>
        )}

        <div className="shrink-0 h-24" aria-hidden />
      </div>

      {/* ApprovalTray */}
      {activeTrayApproval && (
        <ApprovalTray isOpen={isTrayOpen} onClose={() => setIsTrayOpen(false)} approval={activeTrayApproval} status={activeTrayApproval.status} onApprove={handleApprove} onReject={handleReject} onDetails={onOpenTechnicalDrawer} />
      )}

      {/* -- Bottom controls (absolute, never overlaps content) -- */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <div className="px-4 pt-2 pb-4 bg-gradient-to-t from-zinc-950/95 via-zinc-950/80 to-transparent pointer-events-auto">
          <div className="max-w-lg mx-auto flex flex-col gap-2">

            {/* Row 1: primary controls */}
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => runtime.toggleMuted()} title={runtime.isMuted ? 'Unmute' : 'Mute'}
                className={cn('flex items-center justify-center w-9 h-9 rounded-full border transition-all shrink-0',
                  runtime.isMuted ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-zinc-900/80 border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300')}>
                {runtime.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 opacity-30" />}
              </button>

              {voiceSettings.enabled ? (
                conversationModeEnabled ? (
                  // -- Conversation mode controls -----------------------------
                  loop.loopPhase === 'idle' || loop.loopPhase === 'dormant' ? (
                    <button onClick={() => loop.startConversation()}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all">
                      <PlayCircle className="w-4 h-4" />
                      {loop.loopPhase === 'dormant' ? 'Resume' : 'Start Conversation'}
                    </button>
                  ) : loop.loopPhase === 'speaking' ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => loop.interruptSpeech()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-[13px] bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-lg transition-all hover:bg-rose-500/30">
                        <Mic className="w-4 h-4" /> Speak
                      </button>
                      <button onClick={() => loop.stopConversation()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-[13px] bg-zinc-800 border border-zinc-700 text-zinc-300 shadow-lg transition-all hover:bg-zinc-700">
                        <StopCircle className="w-4 h-4" /> Stop
                      </button>
                    </div>
                  ) : loop.loopPhase === 'listening' ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => loop.manualFinish()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-[13px] bg-rose-500 hover:bg-rose-400 text-white shadow-lg transition-all">
                        <Mic className="w-4 h-4" />Finish
                      </button>
                      <button onClick={() => loop.stopConversation()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-[13px] bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all">
                        <StopCircle className="w-3.5 h-3.5" />End
                      </button>
                    </div>
                  ) : (
                    <button disabled className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] bg-indigo-600/40 text-white/50 cursor-not-allowed shadow-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      {loopPhaseLabel_text || 'Processing...'}
                    </button>
                  )
                ) : (
                  // -- One-shot controls --------------------------------------
                  oneShotPhase === 'speaking' ? (
                    <div className="flex items-center gap-2">
                      {voiceSettings.interruptEnabled && (
                        <button onClick={handleOneShotStart}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-[13px] bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/40 text-rose-300 shadow-lg transition-all">
                          <Mic className="w-4 h-4" /> Interrupt
                        </button>
                      )}
                      <button onClick={handleStopPlayback}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-[13px] bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition-all">
                        <MicOff className="w-4 h-4" /> Skip
                      </button>
                    </div>
                  ) : oneShotPhase === 'recording' ? (
                    <button onClick={handleOneShotStop}
                      className={cn('flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30 shadow-lg transition-all',
                        !voiceSettings.autoStopEnabled && 'animate-pulse')}>
                      <Mic className="w-4 h-4" />
                      {vadPhase === 'speech_detected' ? 'Speaking...' : vadPhase === 'silence_detected' ? 'Paused...' : 'Finish'}
                    </button>
                  ) : (
                    <button onClick={handleOneShotStart}
                      disabled={oneShotPhase !== 'idle' || micDenied || micUnsupported}
                      className={cn('flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] shadow-lg transition-all',
                        (oneShotPhase !== 'idle' || micDenied || micUnsupported)
                          ? 'bg-indigo-600/40 text-white/50 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25')}>
                      <Mic className="w-4 h-4" />
                      {oneShotPhase !== 'idle' ? oneShotPhaseLabel(oneShotPhase) : 'Speak'}
                    </button>
                  )
                )
              ) : (
                <button
                  disabled
                  title="Enable voice conversation in Settings before using Speak."
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-semibold text-[14px] transition-all shadow-lg bg-zinc-800 text-zinc-500 cursor-not-allowed"
                >
                  <MicOff className="w-4 h-4" /> Voice Off
                </button>
              )}

              {/* Conversation mode toggle */}
              <button
                onClick={() => {
                  if (conversationModeEnabled) { loop.stopConversation(); setConversationModeEnabled(false); }
                  else { setConversationModeEnabled(true); }
                }}
                title={conversationModeEnabled ? 'Switch to one-shot mode' : 'Switch to conversation mode'}
                className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all shrink-0',
                  conversationModeEnabled ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-zinc-900/60 border-zinc-700/40 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300')}>
                <PlayCircle className="w-2.5 h-2.5" />
                {conversationModeEnabled ? 'Conv' : 'One-shot'}
              </button>
            </div>

            {/* Row 2: operator controls */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button onClick={onOpenConsole} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
                <Terminal className="w-3 h-3" /> Console
              </button>
              <button onClick={onOpenTechnicalDrawer} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
                <Settings2 className="w-3 h-3" /> Details
              </button>
              <PermissionModeSelector />
              <button
                onClick={() => setVoiceSettings(s => ({ ...s, enabled: !s.enabled }))}
                className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all',
                  voiceSettings.enabled ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-zinc-900/60 border-zinc-700/40 text-zinc-500')}>
                <Radio className="w-2.5 h-2.5" />{voiceSettings.enabled ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => setVoiceSettings(s => ({ ...s, fastResponseMode: !s.fastResponseMode }))}
                title="Fast mode: 1-sentence reply first, then full answer"
                className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all',
                  voiceSettings.fastResponseMode ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-zinc-900/60 border-zinc-700/40 text-zinc-500 hover:text-zinc-300')}>
                <Zap className="w-2.5 h-2.5" />{voiceSettings.fastResponseMode ? 'Fast' : 'Std'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

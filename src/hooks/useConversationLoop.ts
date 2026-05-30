/**
 * useConversationLoop — AURA Phase 3E QA
 *
 * Hands-free conversation state machine.
 * When active: AURA listens → transcribes → responds → listens again.
 * Stops on: user click, hotkey, stop phrase, dormancy timeout, repeated errors.
 *
 * Security:
 *  - Microphone only active when loopPhase !== 'idle' and !== 'dormant'
 *  - Stop phrases checked in transcript text only — no persistent wake word
 *  - Dormancy stops mic tracks after timeout
 *  - Raw audio never stored
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoiceActivityRecorder } from './useVoiceActivityRecorder';
import { openAIVoiceSessionService } from '../services/voice/OpenAIVoiceSessionService';
import { voiceTranscriptLogService } from '../services/voice/VoiceTranscriptLogService';
import { notifyVoiceError } from '../services/notifications/NotificationService';
import type { VoiceConversationSettings, VoiceConversationTurn } from '../types/voice-session';
import type { VADPhase } from './useVoiceActivityRecorder';

// ─── Loop phase ───────────────────────────────────────────────────────────────

export type LoopPhase =
  | 'idle'
  | 'listening'     // recorder active, VAD watching
  | 'transcribing'  // sending audio to Whisper
  | 'thinking'      // waiting for chat response
  | 'speaking'      // TTS playing
  | 'dormant'       // no speech for dormancyMs
  | 'error';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface ConversationLoopConfig {
  voiceSettings: VoiceConversationSettings;
  /** Re-start listening automatically after AURA finishes speaking */
  autoListen: boolean;
  /** ms of silence in listening state before going dormant. 0 = never. */
  dormancyMs: number;
  /** Phrases that end the conversation when spoken by user */
  stopPhrases: string[];
  onTurnComplete: (turn: VoiceConversationTurn) => void;
  onPhaseChange: (phase: LoopPhase) => void;
}

const DEFAULT_STOP_PHRASES = [
  'stop listening',
  'pause conversation',
  "that's all",
  'go idle',
  'stop aura',
  'be quiet',
];

// ─── Barge-in analyser — lightweight mic poll while TTS plays ─────────────────

interface BargeInState {
  analyser: AnalyserNode | null;
  ctx: AudioContext | null;
  stream: MediaStream | null;
  frameCount: number;
}

const BARGE_IN_THRESHOLD   = 0.025;  // Higher than VAD — avoids speaker echo
const BARGE_IN_FRAME_GATE  = 4;      // N consecutive frames before triggering

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversationLoop(config: ConversationLoopConfig) {
  const {
    voiceSettings,
    autoListen,
    dormancyMs,
    stopPhrases = DEFAULT_STOP_PHRASES,
    onTurnComplete,
    onPhaseChange,
  } = config;

  const [loopPhase, setLoopPhase] = useState<LoopPhase>('idle');
  const [liveTranscript, setLiveTranscript] = useState<{ user: string; aura: string } | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const loopPhaseRef        = useRef<LoopPhase>('idle');
  const audioRef            = useRef<HTMLAudioElement | null>(null);
  const dormancyTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bargeInRef          = useRef<BargeInState>({ analyser: null, ctx: null, stream: null, frameCount: 0 });
  const bargeInPollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef          = useRef(false);
  const settingsRef         = useRef(voiceSettings);
  const onTurnRef           = useRef(onTurnComplete);
  const onPhaseRef          = useRef(onPhaseChange);
  const stopPhrasesRef      = useRef(stopPhrases);
  const autoListenRef       = useRef(autoListen);
  const recordStartRef      = useRef<number | null>(null);

  useEffect(() => { settingsRef.current    = voiceSettings; }, [voiceSettings]);
  useEffect(() => { onTurnRef.current      = onTurnComplete; }, [onTurnComplete]);
  useEffect(() => { onPhaseRef.current     = onPhaseChange; }, [onPhaseChange]);
  useEffect(() => { stopPhrasesRef.current = stopPhrases; }, [stopPhrases]);
  useEffect(() => { autoListenRef.current  = autoListen; }, [autoListen]);

  // ── VAD recorder ──────────────────────────────────────────────────────────
  const onAutoStopRef = useRef<(() => void) | undefined>(undefined);
  const vadRecorder = useVoiceActivityRecorder({
    silenceThresholdMs: voiceSettings.silenceThresholdMs,
    minSpeechMs:        600,
    maxDurationMs:      voiceSettings.maxRecordingDurationMs,
    onAutoStop:         () => { onAutoStopRef.current?.(); },
  });

  // ── Phase helpers ─────────────────────────────────────────────────────────

  const updatePhase = useCallback((phase: LoopPhase) => {
    loopPhaseRef.current = phase;
    setLoopPhase(phase);
    onPhaseRef.current(phase);
  }, []);

  // ── Clear dormancy timer ──────────────────────────────────────────────────

  const clearDormancy = useCallback(() => {
    if (dormancyTimerRef.current) {
      clearTimeout(dormancyTimerRef.current);
      dormancyTimerRef.current = null;
    }
  }, []);

  // ── Barge-in: start lightweight analyser while TTS plays ─────────────────

  const startBargeInAnalyser = useCallback(async () => {
    if (!voiceSettings.interruptEnabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      bargeInRef.current = { analyser, ctx, stream, frameCount: 0 };

      bargeInPollRef.current = setInterval(() => {
        const bi = bargeInRef.current;
        if (!bi.analyser) return;
        bi.analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);

        if (rms > BARGE_IN_THRESHOLD) {
          bi.frameCount++;
          if (bi.frameCount >= BARGE_IN_FRAME_GATE && loopPhaseRef.current === 'speaking') {
            stopBargeInAnalyser();
            // Interrupt and start listening
            audioRef.current?.pause();
            if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
            runningRef.current = false;
            setCurrentAudioUrl(null);
            startListeningCycle();
          }
        } else {
          bi.frameCount = 0;
        }
      }, 100);
    } catch {
      // Barge-in analyser unavailable — silent fallback
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceSettings.interruptEnabled]);

  const stopBargeInAnalyser = useCallback(() => {
    if (bargeInPollRef.current) {
      clearInterval(bargeInPollRef.current);
      bargeInPollRef.current = null;
    }
    const bi = bargeInRef.current;
    if (bi.ctx) { try { bi.ctx.close(); } catch { /* ignore */ } }
    if (bi.stream) bi.stream.getTracks().forEach(t => t.stop());
    bargeInRef.current = { analyser: null, ctx: null, stream: null, frameCount: 0 };
  }, []);

  // ── Start a listening cycle ───────────────────────────────────────────────

  const startListeningCycle = useCallback(async () => {
    if (loopPhaseRef.current === 'idle') return;
    clearDormancy();
    updatePhase('listening');
    setLiveTranscript(null);
    recordStartRef.current = Date.now();

    try {
      await vadRecorder.startRecording();
    } catch {
      updatePhase('error');
    }

    // Start dormancy timer if configured
    if (dormancyMs > 0) {
      dormancyTimerRef.current = setTimeout(() => {
        if (loopPhaseRef.current === 'listening' && !runningRef.current) {
          updatePhase('dormant');
          vadRecorder.cancelRecording();
        }
      }, dormancyMs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearDormancy, dormancyMs, updatePhase]);

  // ── Process a recorded blob ───────────────────────────────────────────────

  const processBlob = useCallback(async (blob: Blob) => {
    const elapsed = recordStartRef.current ? Date.now() - recordStartRef.current : 0;
    clearDormancy();
    runningRef.current = true;
    updatePhase('transcribing');
    setLiveTranscript({ user: '…', aura: '' });

    if (blob.size < 200) {
      runningRef.current = false;
      setConsecutiveErrors(e => e + 1);
      if (autoListenRef.current && loopPhaseRef.current !== 'idle') {
        startListeningCycle();
      } else {
        updatePhase('idle');
      }
      return;
    }

    const sttResult = await openAIVoiceSessionService.transcribeAudio(blob);
    if (!sttResult.success) {
      notifyVoiceError(sttResult.error ?? 'Transcription failed.');
      runningRef.current = false;
      setConsecutiveErrors(e => e + 1);
      if (autoListenRef.current) startListeningCycle();
      else updatePhase('idle');
      return;
    }

    if (!sttResult.text?.trim()) {
      // Silence or hallucination filtered — just re-listen without noisy error
      runningRef.current = false;
      if (autoListenRef.current) startListeningCycle();
      else updatePhase('idle');
      return;
    }

    // Check stop phrases
    const lower = sttResult.text.toLowerCase();
    const isStop = stopPhrasesRef.current.some(p => lower.includes(p));
    if (isStop) {
      setLiveTranscript({ user: sttResult.text, aura: 'Conversation paused.' });
      runningRef.current = false;
      updatePhase('idle');
      vadRecorder.cancelRecording();
      return;
    }

    setLiveTranscript({ user: sttResult.text, aura: '' });
    setConsecutiveErrors(0);
    updatePhase('thinking');

    const chatResult = await openAIVoiceSessionService.createChatResponse(
      sttResult.text,
      settingsRef.current.responseStyle ?? 'normal',
    );

    if (!chatResult.success || !chatResult.text) {
      notifyVoiceError(chatResult.error ?? 'AI response failed.');
      runningRef.current = false;
      if (autoListenRef.current) startListeningCycle();
      else updatePhase('idle');
      return;
    }

    const ttsResult = await openAIVoiceSessionService.synthesizeSpeech(
      chatResult.text,
      settingsRef.current.ttsVoice,
    );

    const turn: VoiceConversationTurn = {
      id:            `turn-${Date.now()}`,
      userText:      sttResult.text,
      auraText:      chatResult.text,
      timestamp:     new Date().toISOString(),
      sttLatencyMs:  sttResult.latencyMs,
      chatLatencyMs: chatResult.latencyMs,
      ttsLatencyMs:  ttsResult.latencyMs,
    };
    onTurnRef.current(turn);

    voiceTranscriptLogService.logTurn({
      userText:     sttResult.text,
      auraText:     chatResult.text,
      durationMs:   elapsed,
      sttLatencyMs: sttResult.latencyMs,
      chatLatencyMs:chatResult.latencyMs,
      ttsLatencyMs: ttsResult.latencyMs,
    });

    setLiveTranscript({ user: sttResult.text, aura: chatResult.text });

    if (!ttsResult.success || !ttsResult.audioBlobUrl) {
      runningRef.current = false;
      if (autoListenRef.current) startListeningCycle();
      else updatePhase('idle');
      return;
    }

    setCurrentAudioUrl(ttsResult.audioBlobUrl);
    updatePhase('speaking');

    // Start barge-in analyser while AURA speaks
    startBargeInAnalyser();

    const audio = new Audio(ttsResult.audioBlobUrl);
    audioRef.current = audio;
    audio.onended = () => {
      stopBargeInAnalyser();
      URL.revokeObjectURL(ttsResult.audioBlobUrl!);
      setCurrentAudioUrl(null);
      runningRef.current = false;
      if (loopPhaseRef.current === 'speaking') {
        if (autoListenRef.current) startListeningCycle();
        else updatePhase('idle');
      }
    };
    audio.onerror = () => {
      stopBargeInAnalyser();
      runningRef.current = false;
      if (autoListenRef.current) startListeningCycle();
      else updatePhase('idle');
    };
    audio.play().catch(() => {
      stopBargeInAnalyser();
      runningRef.current = false;
      if (autoListenRef.current) startListeningCycle();
      else updatePhase('idle');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearDormancy, updatePhase, startListeningCycle, startBargeInAnalyser, stopBargeInAnalyser]);

  // ── VAD auto-stop callback ────────────────────────────────────────────────

  useEffect(() => {
    onAutoStopRef.current = async () => {
      if (loopPhaseRef.current !== 'listening' || runningRef.current) return;
      const blob = await vadRecorder.stopRecording();
      if (blob) processBlob(blob);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processBlob]);

  // ── Public API ────────────────────────────────────────────────────────────

  const startConversation = useCallback(async () => {
    if (loopPhaseRef.current !== 'idle' && loopPhaseRef.current !== 'dormant') return;
    runningRef.current = false;
    setConsecutiveErrors(0);
    updatePhase('listening');
    await startListeningCycle();
  }, [updatePhase, startListeningCycle]);

  const stopConversation = useCallback(() => {
    clearDormancy();
    stopBargeInAnalyser();
    audioRef.current?.pause();
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    setCurrentAudioUrl(null);
    setLiveTranscript(null);
    vadRecorder.cancelRecording();
    runningRef.current = false;
    updatePhase('idle');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearDormancy, stopBargeInAnalyser, currentAudioUrl, updatePhase]);

  const resumeFromDormant = useCallback(async () => {
    if (loopPhaseRef.current !== 'dormant') return;
    updatePhase('listening');
    await startListeningCycle();
  }, [updatePhase, startListeningCycle]);

  const manualFinish = useCallback(async () => {
    if (loopPhaseRef.current !== 'listening') return;
    clearDormancy();
    const blob = await vadRecorder.stopRecording();
    if (blob) processBlob(blob);
  }, [clearDormancy, vadRecorder, processBlob]);

  const interruptSpeech = useCallback(() => {
    stopBargeInAnalyser();
    audioRef.current?.pause();
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    setCurrentAudioUrl(null);
    runningRef.current = false;
    if (autoListenRef.current) startListeningCycle();
    else updatePhase('idle');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopBargeInAnalyser, currentAudioUrl, startListeningCycle, updatePhase]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearDormancy();
      stopBargeInAnalyser();
      vadRecorder.cancelRecording();
      audioRef.current?.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loopPhase,
    vadPhase:      vadRecorder.vadPhase as VADPhase,
    micLevel:      vadRecorder.micLevel,
    micPermission: vadRecorder.state.micPermission,
    durationMs:    vadRecorder.state.durationMs,
    liveTranscript,
    currentAudioUrl,
    consecutiveErrors,
    startConversation,
    stopConversation,
    resumeFromDormant,
    manualFinish,
    interruptSpeech,
  };
}

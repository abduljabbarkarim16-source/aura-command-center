/**
 * useVoiceActivityRecorder — AURA Phase 3D
 *
 * Wraps the MediaRecorder approach from useVoiceRecorder but adds
 * Web Audio API silence detection (VAD-lite) for auto-stop.
 *
 * Security rules:
 * - Microphone permission is ONLY requested after explicit user action
 * - Do NOT call startRecording() without a user gesture
 * - Raw audio Blob is returned to the caller and never stored here
 * - Recording is capped at maxDurationMs (default 30s)
 * - Blob is cleared from this hook after it is returned
 * - AudioContext is always closed on cleanup to release mic hold
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { MicPermission, VoiceRecordingState } from '../types/voice-session';

// ─── VAD config ───────────────────────────────────────────────────────────────

export interface VADConfig {
  silenceThresholdMs: number;   // ms of silence before auto-stop, default 1200
  minSpeechMs: number;          // minimum ms of recording before VAD can fire, default 400
  maxDurationMs: number;        // hard cap, default 30000
  onAutoStop?: () => void;      // called when VAD triggers stop
}

export type VADPhase =
  | 'idle'
  | 'connecting'
  | 'recording'
  | 'speech_detected'
  | 'silence_detected'
  | 'auto_stopping';

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseVoiceActivityRecorderReturn {
  state: VoiceRecordingState;
  vadPhase: VADPhase;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

// ─── RMS amplitude helper ─────────────────────────────────────────────────────

function getRMS(analyser: AnalyserNode, dataArray: Float32Array): number {
  analyser.getFloatTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  return Math.sqrt(sum / dataArray.length);
}

// VAD fires when RMS stays below this for silenceThresholdMs
const RMS_SILENCE_THRESHOLD = 0.01;

function detectMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceActivityRecorder(config: Partial<VADConfig> = {}): UseVoiceActivityRecorderReturn {
  const {
    silenceThresholdMs = 1200,
    minSpeechMs = 400,
    maxDurationMs = 30_000,
    onAutoStop,
  } = config;

  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    durationMs: 0,
    micPermission: 'not_requested',
  });
  const [vadPhase, setVadPhase] = useState<VADPhase>('idle');

  // Stable ref for onAutoStop so we don't need it in dep arrays
  const onAutoStopRef = useRef(onAutoStop);
  useEffect(() => { onAutoStopRef.current = onAutoStop; }, [onAutoStop]);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const streamRef         = useRef<MediaStream | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const dataArrayRef      = useRef<Float32Array | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadPollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveRef        = useRef<((blob: Blob | null) => void) | null>(null);
  const mimeTypeRef       = useRef<string>('');
  const startTimeRef      = useRef<number | null>(null);
  const silenceStartRef   = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const autoStopFiredRef  = useRef(false);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (timerRef.current)    { clearInterval(timerRef.current);   timerRef.current   = null; }
    if (vadPollRef.current)  { clearInterval(vadPollRef.current);  vadPollRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current);  autoStopRef.current = null; }

    // Close AudioContext first, then stop tracks
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startTimeRef.current = null;
    silenceStartRef.current = null;
    speechDetectedRef.current = false;
    autoStopFiredRef.current = false;
  }, []);

  // ── Unmount cleanup ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // ── Start recording ────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (state.isRecording) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState(s => ({ ...s, micPermission: 'unsupported' as MicPermission, error: 'getUserMedia not supported' }));
      setVadPhase('idle');
      return;
    }

    setVadPhase('connecting');
    setState(s => ({ ...s, micPermission: 'pending' as MicPermission, error: undefined }));

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      const isDenied = err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      setState(s => ({
        ...s,
        micPermission: (isDenied ? 'denied' : 'unsupported') as MicPermission,
        error: isDenied ? 'Microphone permission denied' : String(err),
      }));
      setVadPhase('idle');
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    mimeTypeRef.current = detectMimeType();
    speechDetectedRef.current = false;
    autoStopFiredRef.current = false;
    silenceStartRef.current = null;

    // ── Set up Web Audio API for VAD ─────────────────────────────────────────
    try {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Float32Array(analyser.fftSize);
    } catch {
      // AudioContext unavailable — fall back to manual-only stop
      audioCtxRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
    }

    // ── MediaRecorder ─────────────────────────────────────────────────────────
    const recorder = new MediaRecorder(stream, mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : {});
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(100);

    const now = Date.now();
    startTimeRef.current = now;

    // Duration timer
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, durationMs: Date.now() - (startTimeRef.current ?? Date.now()) }));
    }, 200);

    // Hard max duration stop
    autoStopRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, maxDurationMs);

    setState({ isRecording: true, durationMs: 0, micPermission: 'granted' });
    setVadPhase('recording');

    // ── VAD poll (only if AudioContext available) ──────────────────────────────
    if (analyserRef.current && dataArrayRef.current) {
      vadPollRef.current = setInterval(() => {
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;
        if (!analyser || !dataArray) return;
        if (autoStopFiredRef.current) return;

        const rms = getRMS(analyser, dataArray);
        const elapsed = Date.now() - (startTimeRef.current ?? Date.now());
        const isSpeaking = rms > RMS_SILENCE_THRESHOLD;

        if (isSpeaking) {
          speechDetectedRef.current = true;
          silenceStartRef.current = null;
          setVadPhase('speech_detected');
        } else if (speechDetectedRef.current) {
          // Speech was detected, now we have silence
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now();
            setVadPhase('silence_detected');
          } else {
            const silenceDuration = Date.now() - silenceStartRef.current;
            if (silenceDuration >= silenceThresholdMs && elapsed >= minSpeechMs) {
              // Auto-stop!
              autoStopFiredRef.current = true;
              setVadPhase('auto_stopping');
              // Fire the callback FIRST so AuraVoiceCore can call handleSpeakStop
              onAutoStopRef.current?.();
            }
          }
        }
        // else: no speech detected yet — stay in 'recording' phase
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, silenceThresholdMs, minSpeechMs, maxDurationMs]);

  // ── Stop recording ─────────────────────────────────────────────────────────

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        setState(s => ({ ...s, isRecording: false }));
        setVadPhase('idle');
        resolve(null);
        return;
      }

      resolveRef.current = resolve;

      recorder.onstop = () => {
        const mime = mimeTypeRef.current || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        cleanup();
        setState(s => ({ ...s, isRecording: false }));
        setVadPhase('idle');
        resolveRef.current?.(blob);
        resolveRef.current = null;
      };

      recorder.stop();
    });
  }, [cleanup]);

  // ── Cancel recording ───────────────────────────────────────────────────────

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    cleanup();
    setState(s => ({ ...s, isRecording: false, durationMs: 0 }));
    setVadPhase('idle');
    resolveRef.current?.(null);
    resolveRef.current = null;
  }, [cleanup]);

  return { state, vadPhase, startRecording, stopRecording, cancelRecording };
}

/**
 * useVoiceActivityRecorder — AURA Phase 3E
 *
 * Wraps MediaRecorder with Web Audio VAD-lite for auto-stop on silence.
 *
 * Phase 3E improvements over Phase 3D:
 *  - Noise-floor calibration in first 500ms (no premature VAD triggers)
 *  - N-frame sustained speech required before speechDetected = true (reduces false positives)
 *  - Rolling average RMS instead of instantaneous RMS
 *  - Dynamic silence threshold: max(BASE_THRESHOLD, noiseFloor * 2)
 *  - Silence timer resets on ANY speech frame — natural pauses handled gracefully
 *  - If blob is large (>500 KB) and VAD was uncertain, still attempt transcription
 *  - Default silence threshold raised to 1800ms; max duration raised to 45s
 *  - Mic level meter exposed for visual feedback
 *
 * Security rules:
 * - Microphone permission ONLY requested after explicit user action
 * - Raw audio Blob returned to caller and never stored here
 * - Recording capped at maxDurationMs
 * - AudioContext always closed on cleanup
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { MicPermission, VoiceRecordingState } from '../types/voice-session';

// ─── VAD config ───────────────────────────────────────────────────────────────

export interface VADConfig {
  /** ms of silence before auto-stop after speech has been detected, default 1800 */
  silenceThresholdMs: number;
  /** minimum ms of recording before VAD can fire, default 600 */
  minSpeechMs: number;
  /** hard cap, default 45000 */
  maxDurationMs: number;
  /** called when VAD triggers stop */
  onAutoStop?: () => void;
}

export type VADPhase =
  | 'idle'
  | 'connecting'
  | 'calibrating'      // Phase 3E: noise-floor calibration window
  | 'recording'
  | 'speech_detected'
  | 'silence_detected'
  | 'auto_stopping';

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseVoiceActivityRecorderReturn {
  state: VoiceRecordingState;
  vadPhase: VADPhase;
  /** 0–1 normalised mic level for visual meter */
  micLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  /** Whether the last blob should attempt STT even if VAD was uncertain */
  shouldAttemptSTT: boolean;
}

// ─── RMS helper ───────────────────────────────────────────────────────────────

function getRMS(analyser: AnalyserNode, dataArray: Float32Array): number {
  analyser.getFloatTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  return Math.sqrt(sum / dataArray.length);
}

/** Absolute floor — RMS must exceed this even with calibration */
const BASE_SPEECH_THRESHOLD = 0.008;
/** Calibration window in ms — we measure noise floor here before VAD activates */
const CALIBRATION_MS = 500;
/** Number of consecutive speech frames required before speechDetected = true */
const SPEECH_FRAME_GATE = 5;
/** Rolling average window size (in 100ms poll ticks) */
const RMS_ROLLING_WINDOW = 8;
/** Blob size above which we attempt STT even if VAD was uncertain */
const LARGE_BLOB_ATTEMPT_BYTES = 500 * 1024;

function detectMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',              // WebView2 on Windows often prefers mp4
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
    silenceThresholdMs = 1800,
    minSpeechMs = 600,
    maxDurationMs = 45_000,
    onAutoStop,
  } = config;

  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    durationMs: 0,
    micPermission: 'not_requested',
  });
  const [vadPhase, setVadPhase] = useState<VADPhase>('idle');
  const [micLevel, setMicLevel] = useState(0);

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
  const shouldAttemptSTTRef = useRef(false);

  // Phase 3E: noise calibration + frame counting
  const noiseFloorRef        = useRef<number>(BASE_SPEECH_THRESHOLD);
  const calibrationEndRef    = useRef<number | null>(null);
  const consecutiveSpeechRef = useRef(0);
  const rmsWindowRef         = useRef<number[]>([]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (timerRef.current)    { clearInterval(timerRef.current);   timerRef.current   = null; }
    if (vadPollRef.current)  { clearInterval(vadPollRef.current);  vadPollRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current);  autoStopRef.current = null; }

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
    consecutiveSpeechRef.current = 0;
    rmsWindowRef.current = [];
    setMicLevel(0);
  }, []);

  useEffect(() => {
    return () => { cleanup(); };
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
    shouldAttemptSTTRef.current = false;
    silenceStartRef.current = null;
    consecutiveSpeechRef.current = 0;
    rmsWindowRef.current = [];
    noiseFloorRef.current = BASE_SPEECH_THRESHOLD;

    // ── Web Audio API for VAD ─────────────────────────────────────────────────
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
      audioCtxRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
    }

    // ── MediaRecorder ─────────────────────────────────────────────────────────
    // Do not force a specific bitrate — WebView2 may reject very low values
    // (e.g. 16 kbps causes silent failures in some WebView2 versions).
    // Let the encoder choose its own bitrate for the detected codec.
    const recorderOptions: MediaRecorderOptions = {};
    if (mimeTypeRef.current) recorderOptions.mimeType = mimeTypeRef.current;
    const recorder = new MediaRecorder(stream, recorderOptions);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = () => {
      // MediaRecorder encoding failure — stop and surface error
      cleanup();
      setState(s => ({ ...s, isRecording: false, error: 'Audio encoding failed. Try again.' }));
      setVadPhase('idle');
      resolveRef.current?.(null);
      resolveRef.current = null;
    };
    recorder.start(100);

    const now = Date.now();
    startTimeRef.current = now;
    calibrationEndRef.current = now + CALIBRATION_MS;

    // Duration timer
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, durationMs: Date.now() - (startTimeRef.current ?? Date.now()) }));
    }, 200);

    // Hard max duration
    autoStopRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        shouldAttemptSTTRef.current = speechDetectedRef.current;
        mediaRecorderRef.current.stop();
      }
    }, maxDurationMs);

    setState({ isRecording: true, durationMs: 0, micPermission: 'granted' });
    setVadPhase('calibrating');

    // ── VAD poll ──────────────────────────────────────────────────────────────
    if (analyserRef.current && dataArrayRef.current) {
      const calibrationRmsSamples: number[] = [];

      vadPollRef.current = setInterval(() => {
        const analyser = analyserRef.current;
        const dataArray = dataArrayRef.current;
        if (!analyser || !dataArray || autoStopFiredRef.current) return;

        const rms = getRMS(analyser, dataArray);

        // Update mic level meter (normalised 0–1, clamped)
        setMicLevel(Math.min(1, rms / 0.08));

        // Rolling average
        rmsWindowRef.current.push(rms);
        if (rmsWindowRef.current.length > RMS_ROLLING_WINDOW) rmsWindowRef.current.shift();
        const avgRms = rmsWindowRef.current.reduce((a, b) => a + b, 0) / rmsWindowRef.current.length;

        const elapsed = Date.now() - (startTimeRef.current ?? Date.now());

        // ── Calibration window ──────────────────────────────────────────────
        if (calibrationEndRef.current && Date.now() < calibrationEndRef.current) {
          calibrationRmsSamples.push(rms);
          return; // don't fire VAD during calibration
        }

        // After calibration, compute noise floor once
        if (calibrationRmsSamples.length > 0 && noiseFloorRef.current === BASE_SPEECH_THRESHOLD) {
          const sorted = [...calibrationRmsSamples].sort((a, b) => a - b);
          // 75th percentile of calibration noise as floor (not max, to ignore spikes)
          const p75 = sorted[Math.floor(sorted.length * 0.75)];
          noiseFloorRef.current = Math.max(BASE_SPEECH_THRESHOLD, p75 * 1.5);
          setVadPhase('recording');
        }

        const threshold = Math.max(BASE_SPEECH_THRESHOLD, noiseFloorRef.current * 2.0);
        const isSpeaking = avgRms > threshold;

        if (isSpeaking) {
          consecutiveSpeechRef.current += 1;
          silenceStartRef.current = null; // reset silence on any speech frame

          if (consecutiveSpeechRef.current >= SPEECH_FRAME_GATE && !speechDetectedRef.current) {
            speechDetectedRef.current = true;
          }

          if (speechDetectedRef.current) {
            setVadPhase('speech_detected');
          }
        } else {
          consecutiveSpeechRef.current = 0;

          if (speechDetectedRef.current) {
            // Speech was established — now check silence duration
            if (silenceStartRef.current === null) {
              silenceStartRef.current = Date.now();
              setVadPhase('silence_detected');
            } else {
              const silenceDuration = Date.now() - silenceStartRef.current;
              if (silenceDuration >= silenceThresholdMs && elapsed >= minSpeechMs) {
                autoStopFiredRef.current = true;
                shouldAttemptSTTRef.current = true;
                setVadPhase('auto_stopping');
                onAutoStopRef.current?.();
              }
            }
          }
          // No speech detected yet — stay in 'recording' phase
        }
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
        const chunks = chunksRef.current;
        const mime = mimeTypeRef.current || 'audio/webm';
        const blob = new Blob(chunks, { type: mime });
        // If blob is large, mark shouldAttemptSTT even if speechDetected was false
        if (blob.size >= LARGE_BLOB_ATTEMPT_BYTES) {
          shouldAttemptSTTRef.current = true;
        }
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

  return {
    state,
    vadPhase,
    micLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    shouldAttemptSTT: shouldAttemptSTTRef.current,
  };
}

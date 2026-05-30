/**
 * useSegmentedVoiceSession — AURA Phase 3E QA3
 *
 * Wispr Flow-style segmented STT pipeline.
 *
 * Problem solved:
 *   Single-blob transcription fails or times out for recordings beyond ~13s because
 *   the full audio must complete before Whisper starts, and large blobs stress IPC.
 *
 * Solution:
 *   Record continuously but transcribe in rolling 8-second segments.
 *   Each segment is transcribed as it completes. Partial transcripts accumulate
 *   into a live buffer. The full thought is assembled after the final VAD silence.
 *
 * Architecture:
 *   - One MediaRecorder, always running (100 ms chunks)
 *   - initChunkRef: stores the very first chunk (WebM EBML header) for partial blob validity
 *   - Segment timer fires every SEGMENT_MS; takes a snapshot of current chunks, resets them
 *   - Each snapshot creates a blob (init + segment chunks) and queues a Whisper call
 *   - Segment results are appended in arrival order to partialTexts[]
 *   - VAD analyser runs in parallel — triggers final segment + session end after silence
 *
 * Security:
 *   - Mic only active while session is explicitly running (user-initiated)
 *   - Audio blobs discarded after transcription; never stored
 *   - Transcripts in memory only; never logged
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { openAIVoiceSessionService } from '../services/voice/OpenAIVoiceSessionService';
import { voiceCleanupService } from '../services/voice/VoiceCleanupService';
import type { MicPermission } from '../types/voice-session';
import type { VADPhase } from './useVoiceActivityRecorder';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SegmentedSessionConfig {
  /** Length of each rolling segment in ms. Default 8000. */
  segmentMs?: number;
  /** ms of silence after speech before session auto-stops. Default 1800. */
  silenceThresholdMs?: number;
  /** Minimum ms of recording before VAD can fire. Default 600. */
  minSpeechMs?: number;
  /** Hard cap for the entire session in ms. Default 90000. */
  maxDurationMs?: number;
  /** Whether to apply filler-word cleanup to each segment. Default true. */
  cleanupEnabled?: boolean;
  /** Called when VAD triggers auto-stop (so caller can stop recording). */
  onAutoStop?: () => void;
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseSegmentedVoiceSessionReturn {
  isRecording: boolean;
  micPermission: MicPermission;
  vadPhase: VADPhase;
  micLevel: number;
  durationMs: number;
  /** Partial transcript that grows segment by segment while user speaks */
  liveTranscript: string;
  /** Number of segments successfully transcribed so far */
  segmentsComplete: number;
  startSession: () => Promise<void>;
  /** Stop recording and return the assembled full transcript (or null if cancelled). */
  stopSession: () => Promise<string | null>;
  cancelSession: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_SPEECH_THRESHOLD = 0.008;
const CALIBRATION_MS        = 500;
const SPEECH_FRAME_GATE     = 5;
const RMS_ROLLING_WINDOW    = 8;
const MIN_SEGMENT_BYTES     = 3_000;

function detectMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function getRMS(analyser: AnalyserNode, data: Float32Array): number {
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSegmentedVoiceSession(config: SegmentedSessionConfig = {}): UseSegmentedVoiceSessionReturn {
  const {
    segmentMs         = 8_000,
    silenceThresholdMs = 1_800,
    minSpeechMs       = 600,
    maxDurationMs     = 90_000,
    cleanupEnabled    = true,
    onAutoStop,
  } = config;

  // ── React state (drives UI) ────────────────────────────────────────────────
  const [isRecording, setIsRecording]         = useState(false);
  const [micPermission, setMicPermission]     = useState<MicPermission>('not_requested');
  const [vadPhase, setVadPhase]               = useState<VADPhase>('idle');
  const [micLevel, setMicLevel]               = useState(0);
  const [durationMs, setDurationMs]           = useState(0);
  const [liveTranscript, setLiveTranscript]   = useState('');
  const [segmentsComplete, setSegmentsComplete] = useState(0);

  const onAutoStopRef = useRef(onAutoStop);
  useEffect(() => { onAutoStopRef.current = onAutoStop; }, [onAutoStop]);

  // ── Recorder internals ────────────────────────────────────────────────────
  const recorderRef       = useRef<MediaRecorder | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const dataArrayRef      = useRef<Float32Array | null>(null);

  // Current rolling segment chunks (reset every segmentMs)
  const chunksRef         = useRef<Blob[]>([]);
  // The very first chunk — contains WebM EBML header; prepended to every partial blob
  const initChunkRef      = useRef<Blob | null>(null);
  // Collected partial transcripts in order
  const partialTextsRef   = useRef<string[]>([]);

  const mimeTypeRef       = useRef('');
  const startTimeRef      = useRef<number | null>(null);
  const stoppedRef        = useRef(false);
  const sessionActiveRef  = useRef(false);

  // ── VAD state ─────────────────────────────────────────────────────────────
  const speechDetectedRef     = useRef(false);
  const silenceStartRef       = useRef<number | null>(null);
  const consecutiveSpeechRef  = useRef(0);
  const rmsWindowRef          = useRef<number[]>([]);
  const noiseFloorRef         = useRef(BASE_SPEECH_THRESHOLD);
  const autoStopFiredRef      = useRef(false);
  const calibrationEndRef     = useRef<number | null>(null);

  // ── Timers ────────────────────────────────────────────────────────────────
  const durationTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadPollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stop-session promise ───────────────────────────────────────────────────
  const stopResolveRef = useRef<((transcript: string | null) => void) | null>(null);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    stoppedRef.current = true;
    sessionActiveRef.current = false;

    if (durationTimerRef.current)  { clearInterval(durationTimerRef.current);  durationTimerRef.current = null; }
    if (vadPollRef.current)        { clearInterval(vadPollRef.current);         vadPollRef.current = null; }
    if (segmentTimerRef.current)   { clearInterval(segmentTimerRef.current);    segmentTimerRef.current = null; }
    if (maxDurationRef.current)    { clearTimeout(maxDurationRef.current);       maxDurationRef.current = null; }

    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    analyserRef.current  = null;
    dataArrayRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    recorderRef.current = null;
    chunksRef.current   = [];
    initChunkRef.current = null;
    startTimeRef.current = null;
    silenceStartRef.current = null;
    speechDetectedRef.current = false;
    autoStopFiredRef.current = false;
    consecutiveSpeechRef.current = 0;
    rmsWindowRef.current = [];
    noiseFloorRef.current = BASE_SPEECH_THRESHOLD;

    setMicLevel(0);
    setIsRecording(false);
    setVadPhase('idle');
  }, []);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  // ── Transcribe one segment blob ───────────────────────────────────────────

  const transcribeSegment = useCallback(async (segChunks: Blob[], label: string): Promise<string> => {
    const init = initChunkRef.current;
    const blobChunks = init ? [init, ...segChunks] : segChunks;
    const blob = new Blob(blobChunks, { type: mimeTypeRef.current || 'audio/webm' });
    if (blob.size < MIN_SEGMENT_BYTES) return '';

    const result = await openAIVoiceSessionService.transcribeAudio(blob);
    if (!result.success || !result.text?.trim()) return '';

    const text = cleanupEnabled
      ? voiceCleanupService.clean(result.text.trim())
      : result.text.trim();

    if (!text) return '';

    partialTextsRef.current.push(text);
    setLiveTranscript(partialTextsRef.current.join(' '));
    setSegmentsComplete(c => c + 1);

    void label; // used for debugging, omit in prod
    return text;
  }, [cleanupEnabled]);

  // ── Snapshot current segment and send to transcription ───────────────────

  const flushSegment = useCallback((label: string) => {
    if (stoppedRef.current) return;
    const seg = chunksRef.current.splice(0);
    if (seg.length === 0) return;
    // Fire-and-forget: transcription appends to partialTextsRef
    void transcribeSegment(seg, label);
  }, [transcribeSegment]);

  // ── Start session ─────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (sessionActiveRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermission('unsupported');
      return;
    }

    setVadPhase('connecting');
    setMicPermission('pending');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      const isDenied = err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      setMicPermission(isDenied ? 'denied' : 'unsupported');
      setVadPhase('idle');
      return;
    }

    // Reset state for new session
    stoppedRef.current       = false;
    sessionActiveRef.current = true;
    chunksRef.current        = [];
    initChunkRef.current     = null;
    partialTextsRef.current  = [];
    speechDetectedRef.current    = false;
    autoStopFiredRef.current     = false;
    silenceStartRef.current      = null;
    consecutiveSpeechRef.current = 0;
    rmsWindowRef.current         = [];
    noiseFloorRef.current        = BASE_SPEECH_THRESHOLD;

    setLiveTranscript('');
    setSegmentsComplete(0);

    streamRef.current  = stream;
    mimeTypeRef.current = detectMimeType();

    // ── Web Audio for VAD ─────────────────────────────────────────────────
    try {
      const ctx     = new AudioContext();
      const source  = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioCtxRef.current  = ctx;
      analyserRef.current  = analyser;
      dataArrayRef.current = new Float32Array(analyser.fftSize);
    } catch {
      audioCtxRef.current  = null;
      analyserRef.current  = null;
      dataArrayRef.current = null;
    }

    // ── MediaRecorder ─────────────────────────────────────────────────────
    const opts: MediaRecorderOptions = {};
    if (mimeTypeRef.current) opts.mimeType = mimeTypeRef.current;
    const recorder = new MediaRecorder(stream, opts);
    recorderRef.current = recorder;

    let firstChunk = true;
    recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      if (firstChunk) {
        // Store the init chunk (WebM EBML header) — always prepend to partial blobs
        initChunkRef.current = e.data;
        firstChunk = false;
      }
      chunksRef.current.push(e.data);
    };
    recorder.onerror = () => {
      cleanup();
      stopResolveRef.current?.(null);
      stopResolveRef.current = null;
    };
    recorder.start(100);

    const now = Date.now();
    startTimeRef.current    = now;
    calibrationEndRef.current = now + CALIBRATION_MS;

    setIsRecording(true);
    setMicPermission('granted');
    setVadPhase('calibrating');
    setDurationMs(0);

    // ── Duration timer ────────────────────────────────────────────────────
    durationTimerRef.current = setInterval(() => {
      setDurationMs(Date.now() - (startTimeRef.current ?? Date.now()));
    }, 200);

    // ── Segment boundary timer ─────────────────────────────────────────────
    segmentTimerRef.current = setInterval(() => {
      flushSegment('periodic');
    }, segmentMs);

    // ── Hard max duration ─────────────────────────────────────────────────
    maxDurationRef.current = setTimeout(() => {
      if (!stoppedRef.current) onAutoStopRef.current?.();
    }, maxDurationMs);

    // ── VAD poll ──────────────────────────────────────────────────────────
    if (analyserRef.current && dataArrayRef.current) {
      const calSamples: number[] = [];

      vadPollRef.current = setInterval(() => {
        const analyser  = analyserRef.current;
        const dataArray = dataArrayRef.current;
        if (!analyser || !dataArray || autoStopFiredRef.current || stoppedRef.current) return;

        const rms = getRMS(analyser, dataArray);
        setMicLevel(Math.min(1, rms / 0.08));

        rmsWindowRef.current.push(rms);
        if (rmsWindowRef.current.length > RMS_ROLLING_WINDOW) rmsWindowRef.current.shift();
        const avgRms = rmsWindowRef.current.reduce((a, b) => a + b, 0) / rmsWindowRef.current.length;

        const elapsed = Date.now() - (startTimeRef.current ?? Date.now());

        // Calibration window
        if (calibrationEndRef.current && Date.now() < calibrationEndRef.current) {
          calSamples.push(rms);
          return;
        }

        // After calibration: compute noise floor once
        if (calSamples.length > 0 && noiseFloorRef.current === BASE_SPEECH_THRESHOLD) {
          const sorted = [...calSamples].sort((a, b) => a - b);
          const p75    = sorted[Math.floor(sorted.length * 0.75)];
          noiseFloorRef.current = Math.max(BASE_SPEECH_THRESHOLD, p75 * 1.5);
          setVadPhase('recording');
        }

        const threshold = Math.max(BASE_SPEECH_THRESHOLD, noiseFloorRef.current * 2.0);
        const isSpeaking = avgRms > threshold;

        if (isSpeaking) {
          consecutiveSpeechRef.current++;
          silenceStartRef.current = null;
          if (consecutiveSpeechRef.current >= SPEECH_FRAME_GATE && !speechDetectedRef.current) {
            speechDetectedRef.current = true;
          }
          if (speechDetectedRef.current) setVadPhase('speech_detected');
        } else {
          consecutiveSpeechRef.current = 0;
          if (speechDetectedRef.current) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = Date.now();
              setVadPhase('silence_detected');
            } else {
              const silenceDur = Date.now() - silenceStartRef.current;
              if (silenceDur >= silenceThresholdMs && elapsed >= minSpeechMs) {
                autoStopFiredRef.current = true;
                setVadPhase('auto_stopping');
                onAutoStopRef.current?.();
              }
            }
          }
        }
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentMs, silenceThresholdMs, minSpeechMs, maxDurationMs, flushSegment, cleanup]);

  // ── Stop session ──────────────────────────────────────────────────────────

  const stopSession = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!sessionActiveRef.current) { resolve(null); return; }

      stopResolveRef.current = resolve;

      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        const text = partialTextsRef.current.join(' ').trim() || null;
        cleanup();
        resolve(text);
        stopResolveRef.current = null;
        return;
      }

      recorder.onstop = async () => {
        // Transcribe remaining chunks (the tail segment)
        const tail = chunksRef.current.splice(0);
        if (tail.length > 0) {
          await transcribeSegment(tail, 'tail');
        }
        const fullText = partialTextsRef.current.join(' ').trim() || null;
        cleanup();
        resolve(fullText);
        stopResolveRef.current = null;
      };

      // Stop the periodic segment timer so it doesn't race with the tail transcription
      if (segmentTimerRef.current) { clearInterval(segmentTimerRef.current); segmentTimerRef.current = null; }

      recorder.stop();
    });
  }, [cleanup, transcribeSegment]);

  // ── Cancel session ────────────────────────────────────────────────────────

  const cancelSession = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    cleanup();
    stopResolveRef.current?.(null);
    stopResolveRef.current = null;
    setDurationMs(0);
    setLiveTranscript('');
    setSegmentsComplete(0);
  }, [cleanup]);

  return {
    isRecording,
    micPermission,
    vadPhase,
    micLevel,
    durationMs,
    liveTranscript,
    segmentsComplete,
    startSession,
    stopSession,
    cancelSession,
  };
}

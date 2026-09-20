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
 *   - Each segment reserves a slot index at dispatch and writes its result there, so
 *     the assembled transcript follows capture order regardless of completion order
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
import { micDeviceService } from '../services/voice/MicDeviceService';
import { eventLog } from '../services/logging/EventLogService';
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

/**
 * Ceiling for the calibrated noise floor.
 *
 * Ordinary speech RMS sits around 0.02–0.15. A room floor above 0.02 is not a room
 * floor — it means calibration sampled speech. Clamping here keeps VAD insensitive
 * rather than inert. See DEFECT-V1.
 */
const MAX_NOISE_FLOOR = 0.02;

/**
 * Hard ceiling on how long `stopSession` may wait before returning what it has.
 *
 * Generous, because a long final segment legitimately takes several seconds to
 * transcribe. Its job is to bound a hang, not to race normal operation.
 */
const STOP_TIMEOUT_MS = 15_000;

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
  /**
   * Segment transcripts indexed by DISPATCH position, not arrival position.
   *
   * DEFECT-V2: these were appended with `push` as each transcription resolved. Segments
   * are dispatched fire-and-forget, so a slow one lands after a later fast one and the
   * assembled sentence comes out reordered. Writing into a reserved slot keeps capture
   * order regardless of completion order. Holes are dropped at assembly time.
   */
  const partialTextsRef   = useRef<Array<string | undefined>>([]);
  /** Next dispatch slot. Reserved synchronously so ordering cannot race. */
  const segmentDispatchRef = useRef(0);
  /**
   * Transcriptions still in flight. `stopSession` awaits these before assembling.
   *
   * Without this, `onstop` awaited only the tail segment, so any periodic segment still
   * in flight was silently missing from the final transcript — lost speech, not merely
   * reordered.
   */
  const inFlightRef       = useRef<Set<Promise<unknown>>>(new Set());

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

  /**
   * Join stored segments in capture order, skipping slots that produced nothing.
   *
   * A hole is normal — a segment can be below the byte floor, gated as silence, or
   * cleaned to nothing. What matters is that a hole does not shift later segments
   * forward, which is what `push`-on-arrival used to do.
   */
  const assembleTranscript = useCallback((): string => {
    return partialTextsRef.current
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .join(' ')
      .trim();
  }, []);

  // ── Transcribe one segment blob ───────────────────────────────────────────

  const transcribeSegment = useCallback(async (segChunks: Blob[], label: string): Promise<string> => {
    const init = initChunkRef.current;
    const blobChunks = init ? [init, ...segChunks] : segChunks;
    const blob = new Blob(blobChunks, { type: mimeTypeRef.current || 'audio/webm' });
    if (blob.size < MIN_SEGMENT_BYTES) {
      eventLog.log('debug', 'stt', 'segment.tooSmall', { label, bytes: blob.size, floor: MIN_SEGMENT_BYTES });
      return '';
    }

    // Reserve this segment's slot synchronously, before any await. Completion order is
    // then irrelevant: each result lands where it was captured.
    const slot = segmentDispatchRef.current++;
    const started = performance.now();

    const result = await openAIVoiceSessionService.transcribeAudio(blob);
    if (!result.success || !result.text?.trim()) {
      eventLog.info('stt', 'segment.empty', {
        label,
        slot,
        bytes: blob.size,
        ms: Math.round(performance.now() - started),
        skippedReason: result.skippedReason,
        error: result.error,
      });
      return '';
    }

    const raw = result.text.trim();
    const text = cleanupEnabled ? voiceCleanupService.clean(raw) : raw;

    if (!text) {
      eventLog.info('stt', 'segment.cleanedToEmpty', { label, slot, raw });
      return '';
    }

    partialTextsRef.current[slot] = text;
    setLiveTranscript(assembleTranscript());
    setSegmentsComplete(c => c + 1);

    eventLog.info('stt', 'segment.stored', {
      label,
      slot,
      bytes: blob.size,
      ms: Math.round(performance.now() - started),
      raw,
      cleaned: text,
      cleanupChanged: raw !== text,
      assembled: assembleTranscript(),
    });

    return text;
  }, [cleanupEnabled, assembleTranscript]);

  // ── Snapshot current segment and send to transcription ───────────────────

  const flushSegment = useCallback((label: string) => {
    if (stoppedRef.current) return;
    const seg = chunksRef.current.splice(0);
    if (seg.length === 0) return;
    // Dispatched without awaiting so recording is never blocked by transcription, but
    // tracked so `stopSession` can wait for it. Previously this was untracked, and any
    // segment still in flight at stop time was silently lost from the final transcript.
    const p = transcribeSegment(seg, label)
      .catch(err => {
        eventLog.error('stt', 'segment.threw', err, { label });
        return '';
      })
      .finally(() => { inFlightRef.current.delete(p); });
    inFlightRef.current.add(p);
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
      // ERR-0074: honour the user's selected input device instead of the OS default.
      stream = await micDeviceService.getStream();
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
    segmentDispatchRef.current = 0;
    inFlightRef.current.clear();
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
          // Clamp the calibrated floor.
          //
          // DEFECT-V1: calibration assumes the first 500 ms is silence. People click and
          // start talking, so it frequently samples speech instead. The floor is then set
          // from speech energy, the speech threshold becomes floor*2 — above anything the
          // user can produce — `speechDetectedRef` never flips, and the silence branch
          // that triggers auto-stop is unreachable. The session then runs to its 90s cap
          // or until stopped by hand, presenting as a turn stuck in LISTENING.
          //
          // The ceiling means a calibration polluted by speech degrades to a slightly
          // insensitive VAD rather than a disabled one.
          const raw = Math.max(BASE_SPEECH_THRESHOLD, p75 * 1.5);
          noiseFloorRef.current = Math.min(raw, MAX_NOISE_FLOOR);
          if (raw > MAX_NOISE_FLOOR) {
            eventLog.warn('mic', 'vad.calibrationClamped', {
              measured: Number(raw.toFixed(5)),
              clampedTo: MAX_NOISE_FLOOR,
              likelyCause: 'speech during the calibration window',
            });
          }
          eventLog.info('mic', 'vad.calibrated', {
            noiseFloor: Number(noiseFloorRef.current.toFixed(5)),
            speechThreshold: Number(Math.max(BASE_SPEECH_THRESHOLD, noiseFloorRef.current * 2).toFixed(5)),
            samples: calSamples.length,
          });
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

      // Resolve exactly once, from whichever path gets there first.
      //
      // DEFECT-V1: this promise previously had a single resolution path —
      // `recorder.onstop`. If the recorder never fired onstop, or the tail
      // transcription hung on a slow API call, the promise never settled and the UI sat
      // in its current phase indefinitely (observed: 31.2s in LISTENING). A voice turn
      // must always end, even badly.
      let settled = false;
      const settle = (text: string | null, how: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        eventLog.info('state', 'session.stopped', {
          how,
          chars: text?.length ?? 0,
          segments: partialTextsRef.current.length,
          stored: partialTextsRef.current.filter(Boolean).length,
        });
        cleanup();
        resolve(text);
        stopResolveRef.current = null;
      };

      const guard = setTimeout(() => {
        // Hand back whatever did arrive rather than nothing: a partial transcript is
        // more use than a hung turn.
        eventLog.warn('state', 'session.stopTimeout', {
          afterMs: STOP_TIMEOUT_MS,
          inFlight: inFlightRef.current.size,
        });
        settle(assembleTranscript() || null, 'timeout');
      }, STOP_TIMEOUT_MS);

      // Expose `settle`, not the bare `resolve`. Other paths — recorder.onerror,
      // cancelSession — resolve through this ref; routing them through settle means they
      // also clear the guard timer instead of leaving it armed to fire a spurious
      // timeout afterwards.
      stopResolveRef.current = (text) => settle(text, 'external');

      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        settle(assembleTranscript() || null, 'recorder-already-inactive');
        return;
      }

      recorder.onstop = async () => {
        // Transcribe remaining chunks (the tail segment)
        const tail = chunksRef.current.splice(0);
        const pending: Array<Promise<unknown>> = [...inFlightRef.current];
        if (tail.length > 0) {
          pending.push(transcribeSegment(tail, 'tail').catch(err => {
            eventLog.error('stt', 'segment.threw', err, { label: 'tail' });
          }));
        }
        // Wait for every dispatched segment, not just the tail. allSettled so one
        // failed segment cannot strand the rest.
        await Promise.allSettled(pending);
        settle(assembleTranscript() || null, 'clean');
      };

      // Stop the periodic segment timer so it doesn't race with the tail transcription
      if (segmentTimerRef.current) { clearInterval(segmentTimerRef.current); segmentTimerRef.current = null; }

      recorder.stop();
    });
  }, [cleanup, transcribeSegment, assembleTranscript]);

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

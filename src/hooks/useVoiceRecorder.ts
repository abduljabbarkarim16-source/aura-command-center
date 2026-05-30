/**
 * useVoiceRecorder — AURA Phase 3C
 *
 * Hook to manage microphone recording.
 *
 * Security rules:
 * - Microphone permission is ONLY requested after explicit user action
 * - Do not call startRecording() without a user gesture
 * - Raw audio Blob is returned to the caller and never stored here
 * - Recording is capped at maxDurationMs (default 15 s)
 * - Blob is cleared from this hook after it is returned
 */

import { useState, useRef, useCallback } from 'react';
import type { MicPermission, VoiceRecordingState } from '../types/voice-session';

export interface UseVoiceRecorderReturn {
  state: VoiceRecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

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

export function useVoiceRecorder(maxDurationMs = 15_000): UseVoiceRecorderReturn {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    durationMs: 0,
    micPermission: 'not_requested',
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveRef       = useRef<((blob: Blob | null) => void) | null>(null);
  const mimeTypeRef      = useRef<string>('');

  const cleanup = useCallback(() => {
    if (timerRef.current)   { clearInterval(timerRef.current);  timerRef.current   = null; }
    if (autoStopRef.current){ clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    if (state.isRecording) return;

    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      setState(s => ({ ...s, micPermission: 'unsupported', error: 'getUserMedia not supported in this browser' }));
      return;
    }

    setState(s => ({ ...s, micPermission: 'pending', error: undefined }));

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      const isDenied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      setState(s => ({
        ...s,
        micPermission: isDenied ? 'denied' : 'unsupported',
        error: isDenied ? 'Microphone permission denied' : String(err),
      }));
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    mimeTypeRef.current = detectMimeType();

    const recorderOptions: MediaRecorderOptions = {};
    if (mimeTypeRef.current) recorderOptions.mimeType = mimeTypeRef.current;
    const recorder = new MediaRecorder(stream, recorderOptions);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = () => {
      cleanup();
      setState(s => ({ ...s, isRecording: false, error: 'Audio encoding failed. Try again.' }));
      resolveRef.current?.(null);
      resolveRef.current = null;
    };

    recorder.start(100); // collect in 100 ms chunks

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setState(s => ({ ...s, durationMs: Date.now() - startTime }));
    }, 200);

    autoStopRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, maxDurationMs);

    setState({ isRecording: true, durationMs: 0, micPermission: 'granted' });
  }, [state.isRecording, maxDurationMs, cleanup]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        setState(s => ({ ...s, isRecording: false }));
        resolve(null);
        return;
      }

      resolveRef.current = resolve;

      recorder.onstop = () => {
        const mime = mimeTypeRef.current || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        cleanup();
        setState(s => ({ ...s, isRecording: false }));
        resolveRef.current?.(blob);
        resolveRef.current = null;
      };

      recorder.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    cleanup();
    setState(s => ({ ...s, isRecording: false, durationMs: 0 }));
    resolveRef.current?.(null);
    resolveRef.current = null;
  }, [cleanup]);

  return { state, startRecording, stopRecording, cancelRecording };
}

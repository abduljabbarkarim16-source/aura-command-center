/**
 * useWakePhrase — AURA Phase 3D
 *
 * Prototype wake phrase detection using the Web Speech Recognition API.
 *
 * IMPORTANT CONSTRAINTS:
 * - Only active when explicitly enabled by the user (wakePhrase setting)
 * - Never starts without user enabling it
 * - SpeechRecognition in WebView2 (Tauri on Windows) may be unavailable
 *   or unreliable — always check `status` and handle 'unavailable' gracefully
 * - Mic remains active while listening — user is warned in the UI
 * - No audio is stored; only the transcript text is read momentarily
 *
 * Accepted phrases (case-insensitive):
 *   Primary:   "hey aura", "aura"
 *   Mishearing: "aurora", "hey ora", "hey laura", "hey laura"
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ─── SpeechRecognition types (not in all TS lib versions) ────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognitionEvent = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognitionErrorEvent = any;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface WakePhraseConfig {
  enabled: boolean;
  phrases: string[];           // ['hey aura', 'aura']
  onActivated: () => void;
  onUnavailable: () => void;
}

export type WakePhraseStatus = 'disabled' | 'unavailable' | 'listening' | 'activated';

export interface UseWakePhraseReturn {
  status: WakePhraseStatus;
  start: () => void;
  stop: () => void;
}

// ─── Default phrases (primary + common mishearings) ───────────────────────────

export const DEFAULT_WAKE_PHRASES = ['hey aura', 'aura', 'aurora', 'hey ora', 'hey laura'];

// ─── SpeechRecognition feature detection ─────────────────────────────────────

function getSpeechRecognitionCtor(): (new () => AnySpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWakePhrase(config: WakePhraseConfig): UseWakePhraseReturn {
  const { enabled, phrases, onActivated, onUnavailable } = config;

  const [status, setStatus] = useState<WakePhraseStatus>('disabled');

  // Stable refs so we don't re-create recognition on every render
  const onActivatedRef   = useRef(onActivated);
  const onUnavailableRef = useRef(onUnavailable);
  const phrasesRef       = useRef(phrases);
  useEffect(() => { onActivatedRef.current   = onActivated;   }, [onActivated]);
  useEffect(() => { onUnavailableRef.current = onUnavailable; }, [onUnavailable]);
  useEffect(() => { phrasesRef.current       = phrases;       }, [phrases]);

  const recognitionRef    = useRef<AnySpeechRecognition | null>(null);
  const stoppedRef        = useRef(false);       // set when stop() is called intentionally
  const restartTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Check phrase match ────────────────────────────────────────────────────

  const checkMatch = useCallback((text: string): boolean => {
    const lower = text.toLowerCase().trim();
    return phrasesRef.current.some(p => lower.includes(p.toLowerCase()));
  }, []);

  // ── Internal restart helper ────────────────────────────────────────────────

  const scheduleRestart = useCallback((delayMs: number) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      if (!stoppedRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setStatus('listening');
        } catch {
          // Recognition may already be running — ignore
        }
      }
    }, delayMs);
  }, []);

  // ── Start listening ────────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (!enabled) { setStatus('disabled'); return; }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setStatus('unavailable');
      onUnavailableRef.current();
      return;
    }

    // Prevent double-start
    if (recognitionRef.current) return;

    stoppedRef.current = false;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: AnySpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (checkMatch(transcript)) {
          setStatus('activated');
          onActivatedRef.current();
          // Stop and restart after cooldown so we don't re-trigger immediately
          try { recognition.stop(); } catch { /* ignore */ }
          scheduleRestart(3000);
          return;
        }
      }
    };

    recognition.onerror = (event: AnySpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are normal — don't log as errors
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[WakePhrase] recognition error:', event.error);
      }
      if (!stoppedRef.current) {
        // Auto-restart after brief delay
        scheduleRestart(2000);
        setStatus('listening'); // optimistic — will become listening after restart
      }
    };

    recognition.onend = () => {
      if (!stoppedRef.current) {
        // Continuous mode ended unexpectedly — restart
        scheduleRestart(500);
      } else {
        setStatus('disabled');
      }
    };

    try {
      recognition.start();
      setStatus('listening');
    } catch (err) {
      console.warn('[WakePhrase] Failed to start recognition:', err);
      setStatus('unavailable');
      onUnavailableRef.current();
      recognitionRef.current = null;
    }
  }, [enabled, checkMatch, scheduleRestart]);

  // ── Stop listening ─────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setStatus('disabled');
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  return { status, start, stop };
}

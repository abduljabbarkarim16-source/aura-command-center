/**
 * useConversationLoop — AURA Phase 3E QA3
 *
 * Hands-free conversation state machine using segmented STT.
 * When active: AURA listens (segmented) → transcribes → responds → listens again.
 * Stops on: user click, hotkey, stop phrase, dormancy timeout, repeated errors.
 *
 * QA3 change: replaced single-blob VAD recorder with useSegmentedVoiceSession.
 * Each listen cycle now transcribes audio in rolling segments, so 20-45s speech
 * no longer fails or times out.
 *
 * Security:
 *  - Microphone only active when loopPhase !== 'idle' and !== 'dormant'
 *  - Stop phrases checked in transcript text only — no persistent wake word
 *  - Dormancy stops mic tracks after timeout
 *  - Raw audio never stored
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSegmentedVoiceSession } from './useSegmentedVoiceSession';
import { openAIVoiceSessionService } from '../services/voice/OpenAIVoiceSessionService';
import { voiceTranscriptLogService } from '../services/voice/VoiceTranscriptLogService';
import { voiceLatencyService } from '../services/voice/VoiceLatencyService';
import { auraMemoryService } from '../services/memory/AuraMemoryService';
import { auraPersonalityService } from '../services/personality/AuraPersonalityService';
import { auraToolDispatchService } from '../services/tools/AuraToolDispatchService';
import { userProfileMemoryService } from '../services/memory/UserProfileMemoryService';
import { nameCaptureService } from '../services/voice/NameCaptureService';
import { voiceDiagnosticsService } from '../services/voice/VoiceDiagnosticsService';
import { sequentialTaskRunner, detectSequenceIntent } from '../services/tasks/SequentialTaskRunnerService';
import { notifyVoiceError } from '../services/notifications/NotificationService';
import type { VoiceConversationSettings, VoiceConversationTurn } from '../types/voice-session';
import type { VADPhase } from './useVoiceActivityRecorder';
import type { VoiceLatencyMetrics } from '../types/voice-latency';

// ─── Loop phase ───────────────────────────────────────────────────────────────

export type LoopPhase =
  | 'idle'
  | 'listening'       // recorder active, VAD watching
  | 'transcribing'    // sending audio to Whisper
  | 'acknowledging'   // instant ack shown — transcript captured, chat not started yet
  | 'thinking'        // waiting for chat response
  | 'preparing_voice' // chat done, TTS synthesis starting
  | 'speaking'        // TTS playing
  | 'dormant'         // no speech for dormancyMs
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
  /** Fast mode: generate brief 1-sentence reply first, then full reply in background */
  fastResponseMode?: boolean;
  /** Sentence-first TTS: start playing after first sentence, queue remaining */
  sentenceFirstTTS?: boolean;
  /** Tool dispatch: let AURA call approved tools autonomously via function calling */
  toolDispatchEnabled?: boolean;
}

const DEFAULT_STOP_PHRASES = [
  'stop listening',
  'pause conversation',
  "that's all",
  'go idle',
  'stop aura',
  'be quiet',
];

const ACK_MESSAGES = ['Got it.', 'Checking.', "On it.", 'One moment.'];
let ackIndex = 0;
function nextAck(): string {
  const msg = ACK_MESSAGES[ackIndex % ACK_MESSAGES.length];
  ackIndex++;
  return msg;
}

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
    fastResponseMode = false,
    sentenceFirstTTS = true,
    toolDispatchEnabled = true,
  } = config;

  const [loopPhase, setLoopPhase] = useState<LoopPhase>('idle');
  const [liveTranscript, setLiveTranscript] = useState<{ user: string; aura: string } | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [lastLatencyMetrics, setLastLatencyMetrics] = useState<VoiceLatencyMetrics | null>(null);

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
  const autoListenRef         = useRef(autoListen);
  const fastResponseModeRef    = useRef(fastResponseMode);
  const sentenceFirstTTSRef    = useRef(sentenceFirstTTS);
  const toolDispatchEnabledRef = useRef(toolDispatchEnabled);
  const recordStartRef        = useRef<number | null>(null);
  /** A name awaiting spoken yes/no confirmation across turns (voice). */
  const pendingNameRef        = useRef<string | null>(null);
  /** Previous turn's raw transcript — used to give the model correction context. */
  const prevTranscriptRef     = useRef<string>('');

  useEffect(() => { settingsRef.current       = voiceSettings; }, [voiceSettings]);
  useEffect(() => { onTurnRef.current         = onTurnComplete; }, [onTurnComplete]);
  useEffect(() => { onPhaseRef.current        = onPhaseChange; }, [onPhaseChange]);
  useEffect(() => { stopPhrasesRef.current    = stopPhrases; }, [stopPhrases]);
  useEffect(() => { autoListenRef.current     = autoListen; }, [autoListen]);
  useEffect(() => { fastResponseModeRef.current   = fastResponseMode; }, [fastResponseMode]);
  useEffect(() => { sentenceFirstTTSRef.current   = sentenceFirstTTS; }, [sentenceFirstTTS]);
  useEffect(() => { toolDispatchEnabledRef.current = toolDispatchEnabled; }, [toolDispatchEnabled]);

  // ── Segmented voice session (replaces single-blob VAD recorder) ───────────
  const onAutoStopRef = useRef<(() => void) | undefined>(undefined);
  const segSession = useSegmentedVoiceSession({
    segmentMs:          voiceSettings.segmentLengthMs ?? 8_000,
    silenceThresholdMs: voiceSettings.silenceThresholdMs,
    minSpeechMs:        600,
    maxDurationMs:      voiceSettings.maxThoughtMs ?? voiceSettings.maxRecordingDurationMs,
    cleanupEnabled:     voiceSettings.cleanupEnabled ?? true,
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

  const extractMemoryIfEnabled = useCallback((userText: string, auraText: string) => {
    if (!settingsRef.current.autoMemoryEnabled) return;
    openAIVoiceSessionService.extractMemory(userText, auraText).then(result => {
      if (result.facts.length > 0) {
        auraMemoryService.addMany(result.facts, 'auto', userText.slice(0, 100));
      }
    });
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
      await segSession.startSession();
    } catch {
      updatePhase('error');
    }

    // Start dormancy timer if configured
    if (dormancyMs > 0) {
      dormancyTimerRef.current = setTimeout(() => {
        if (loopPhaseRef.current === 'listening' && !runningRef.current) {
          updatePhase('dormant');
          segSession.cancelSession();
        }
      }, dormancyMs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearDormancy, dormancyMs, updatePhase]);

  // ── Play a TTS result and handle auto-listen after playback ──────────────

  const playTTSAndContinue = useCallback((
    audioBlobUrl: string,
    onAfterPlay?: () => void,
  ) => {
    setCurrentAudioUrl(audioBlobUrl);
    updatePhase('speaking');
    startBargeInAnalyser();

    const audio = new Audio(audioBlobUrl);
    audioRef.current = audio;

    const afterPlay = () => {
      stopBargeInAnalyser();
      URL.revokeObjectURL(audioBlobUrl);
      setCurrentAudioUrl(null);
      runningRef.current = false;
      onAfterPlay?.();
      if (loopPhaseRef.current === 'speaking') {
        if (autoListenRef.current) startListeningCycle();
        else updatePhase('idle');
      }
    };

    audio.onended  = afterPlay;
    audio.onerror  = () => { stopBargeInAnalyser(); runningRef.current = false; if (autoListenRef.current) startListeningCycle(); else updatePhase('idle'); };
    audio.play().catch(() => { stopBargeInAnalyser(); runningRef.current = false; if (autoListenRef.current) startListeningCycle(); else updatePhase('idle'); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatePhase, startBargeInAnalyser, stopBargeInAnalyser, startListeningCycle]);

  // ── Process assembled transcript — Phase 3F enhanced ─────────────────────
  //
  // Three response paths depending on settings:
  //   1. Fast mode: 1-sentence brief reply → speak immediately → full reply background
  //   2. Sentence-first TTS: full reply → split sentences → TTS first sentence → queue rest
  //   3. Normal: full reply → TTS whole text → play

  const processTranscript = useCallback(async (transcript: string) => {
    const elapsed = recordStartRef.current ? Date.now() - recordStartRef.current : 0;
    clearDormancy();
    runningRef.current = true;

    if (!transcript.trim()) {
      runningRef.current = false;
      if (autoListenRef.current && loopPhaseRef.current !== 'idle') startListeningCycle();
      else updatePhase('idle');
      return;
    }

    // Check stop phrases
    const lower = transcript.toLowerCase();
    const isStop = stopPhrasesRef.current.some(p => lower.includes(p));
    if (isStop) {
      setLiveTranscript({ user: transcript, aura: 'Conversation paused.' });
      runningRef.current = false;
      updatePhase('idle');
      segSession.cancelSession();
      return;
    }

    // Instant acknowledgement — show ack immediately at 0ms, before any API call
    const ackText = nextAck();
    setLiveTranscript({ user: transcript, aura: ackText });
    setConsecutiveErrors(0);
    updatePhase('acknowledging');

    // Yield to let React paint the ack before the synchronous setup below
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    updatePhase('thinking');

    // Build dynamic system prompt (personality + memories) once per turn
    const style = settingsRef.current.responseStyle ?? 'normal';
    const systemPrompt = auraPersonalityService.buildSystemPrompt({ responseStyle: style });

    // Start latency tracking
    const latencyStyle = fastResponseModeRef.current ? 'fast' : (style as 'brief' | 'normal' | 'detailed');
    const turnId = voiceLatencyService.startTurn({
      responseStyle: latencyStyle,
      segmentedMode: true,
      sentenceFirstTTS: sentenceFirstTTSRef.current,
    });
    voiceLatencyService.markChatStart(turnId);

    // ── PATH 0a: Sequence detection — runs before name capture and model ─────
    const sequenceId = detectSequenceIntent(transcript);
    if (sequenceId) {
      const seq = sequentialTaskRunner.listSequences().find(s => s.id === sequenceId);
      const label = seq?.label ?? sequenceId;
      setLiveTranscript({ user: transcript, aura: `Running ${label}…` });
      try {
        const result = await sequentialTaskRunner.run(sequenceId, (step, i, total) => {
          setLiveTranscript({ user: transcript, aura: `[${i + 1}/${total}] ${step.label}…` });
        });
        // Push to TTS so AURA speaks the summary
        const chatText = result.summary;
        openAIVoiceSessionService.pushHistory(transcript, chatText);
        voiceLatencyService.abort(turnId);
        // Speak the result
        updatePhase('preparing_voice');
        const tts = await openAIVoiceSessionService.synthesizeSpeech(chatText, settingsRef.current.ttsVoice);
        if (tts.success && tts.audioBlobUrl) {
          setCurrentAudioUrl(tts.audioBlobUrl);
          updatePhase('speaking');
          const audio = new Audio(tts.audioBlobUrl);
          audioRef.current = audio;
          audio.play().catch(() => {});
          audio.onended = () => {
            URL.revokeObjectURL(tts.audioBlobUrl!);
            setCurrentAudioUrl(null);
            runningRef.current = false;
            if (autoListenRef.current) startListeningCycle();
            else updatePhase('idle');
          };
        } else {
          runningRef.current = false;
          if (autoListenRef.current) startListeningCycle();
          else updatePhase('idle');
        }
        setLiveTranscript({ user: transcript, aura: chatText });
        const turn: VoiceConversationTurn = { id: `turn-${Date.now()}`, userText: transcript, auraText: chatText, timestamp: new Date().toISOString(), chatLatencyMs: 0 };
        onTurnRef.current(turn);
      } catch {
        runningRef.current = false;
        if (autoListenRef.current) startListeningCycle();
        else updatePhase('idle');
      }
      return;
    }

    // ── PATH 0b: Deterministic name capture (shared logic with the console) ──
    // Whisper mishears short proper nouns. Spelling is authoritative; a
    // heard-only voice name is confirmed, never saved silently. When this
    // resolves, AURA speaks `forcedName` and the model is skipped entirely.
    const forcedName = await (async (): Promise<string | null> => {
      const knownName = userProfileMemoryService.get().name;
      const commit = (name: string, spelled: boolean, confidence?: string, ack?: string): string => {
        userProfileMemoryService.setName(name);
        voiceDiagnosticsService.record({
          source: 'voice', rawText: transcript, cleanedText: transcript, intent: 'name.committed',
          spellingMode: spelled, savedValue: name, confidence, audioDurationMs: elapsed,
          note: spelled ? 'spelled (authoritative)' : 'voice-confirmed',
        });
        return ack ?? `Saved — your name is ${name}.`;
      };

      // Resolve a pending confirmation from a previous turn first.
      if (pendingNameRef.current) {
        const pending = pendingNameRef.current;
        const re = nameCaptureService.analyze(transcript, { source: 'voice', knownName });
        if (re.kind === 'save' && re.name) { pendingNameRef.current = null; return commit(re.name, re.spelled, re.confidence, re.prompt); }
        if (nameCaptureService.isAffirmation(transcript)) { pendingNameRef.current = null; return commit(pending, false, 'high'); }
        if (nameCaptureService.isNegation(transcript) || nameCaptureService.isCorrectionIntent(transcript)) {
          // User is correcting — ask the model to interpret it in context.
          const corrected = await nameCaptureService.resolveCorrection({
            wrongText: pending,
            correctionText: transcript,
            storedName: knownName,
            history: openAIVoiceSessionService.getHistorySlice(4) as Array<{ role: 'user' | 'assistant'; content: string }>,
          });
          if (corrected) {
            pendingNameRef.current = corrected; // ask user to confirm the resolved name
            voiceDiagnosticsService.record({ source: 'voice', rawText: transcript, cleanedText: transcript, intent: 'name.confirm', spellingMode: false, savedValue: corrected, note: 'model-resolved correction' });
            return `I think you mean "${corrected}" — is that right? Say "yes" or spell it out to confirm.`;
          }
          pendingNameRef.current = null;
          voiceDiagnosticsService.record({ source: 'voice', rawText: transcript, cleanedText: transcript, intent: 'name.confirm', spellingMode: false, note: 'user rejected pending name, model uncertain' });
          return `No problem — what is your name? Spell it letter by letter to make sure I get it right.`;
        }
        pendingNameRef.current = null; // not yes/no/respell — fall through to normal analysis
      }

      const r = nameCaptureService.analyze(transcript, { source: 'voice', knownName });
      if (r.kind === 'query') {
        voiceDiagnosticsService.record({ source: 'voice', rawText: transcript, cleanedText: transcript, intent: 'name.query', spellingMode: false, savedValue: knownName, audioDurationMs: elapsed });
        return userProfileMemoryService.summary();
      }
      if (r.kind === 'save' && r.name) return commit(r.name, r.spelled, r.confidence, r.prompt);
      if (r.kind === 'confirm') {
        pendingNameRef.current = r.name ?? null;
        voiceDiagnosticsService.record({ source: 'voice', rawText: transcript, cleanedText: transcript, intent: 'name.confirm', spellingMode: r.spelled, savedValue: r.name, confidence: r.confidence, audioDurationMs: elapsed });
        return r.prompt ?? 'Could you confirm your name?';
      }
      return null;
    })();

    // ── PATH 1: Fast mode — 1-sentence reply first ─────────────────────────
    if (!forcedName && fastResponseModeRef.current) {
      const fastResult = await openAIVoiceSessionService.createFastChatResponse(transcript);
      voiceLatencyService.markChatEnd(turnId);

      if (fastResult.success && fastResult.text) {
        updatePhase('preparing_voice');
        voiceLatencyService.markTTSStart(turnId);
        const fastTts = await openAIVoiceSessionService.synthesizeSpeech(
          fastResult.text, settingsRef.current.ttsVoice,
        );
        voiceLatencyService.markTTSEnd(turnId);

        if (fastTts.success && fastTts.audioBlobUrl) {
          voiceLatencyService.markAudioStart(turnId);
          setLiveTranscript({ user: transcript, aura: fastResult.text + ' …' });

          // Start playing fast reply, then get full response in background
          const audio = new Audio(fastTts.audioBlobUrl);
          audioRef.current = audio;
          setCurrentAudioUrl(fastTts.audioBlobUrl);
          updatePhase('speaking');
          startBargeInAnalyser();
          audio.play().catch(() => {});

          // Full response runs concurrently
          const fullResult = await openAIVoiceSessionService.createChatResponse(
            transcript, style as 'brief' | 'normal' | 'detailed', systemPrompt,
          );
          const fullText = fullResult.success ? fullResult.text ?? fastResult.text : fastResult.text;
          setLiveTranscript({ user: transcript, aura: fullText });

          audio.onended = () => {
            URL.revokeObjectURL(fastTts.audioBlobUrl!);
            stopBargeInAnalyser();
            setCurrentAudioUrl(null);
            runningRef.current = false;
            const metrics = voiceLatencyService.finalize(turnId);
            if (metrics) setLastLatencyMetrics(metrics);
            if (autoListenRef.current) startListeningCycle();
            else updatePhase('idle');
          };
          audio.onerror = () => {
            stopBargeInAnalyser(); runningRef.current = false;
            voiceLatencyService.abort(turnId);
            if (autoListenRef.current) startListeningCycle(); else updatePhase('idle');
          };

          const turn: VoiceConversationTurn = {
            id: `turn-${Date.now()}`, userText: transcript, auraText: fullText,
            timestamp: new Date().toISOString(), chatLatencyMs: fastResult.latencyMs,
          };
          onTurnRef.current(turn);
          voiceTranscriptLogService.logTurn({ userText: transcript, auraText: fullText, durationMs: elapsed });
          extractMemoryIfEnabled(transcript, fullText);
          return;
        }
      }
      // Fast path failed — fall through to normal
    }

    // ── PATH 2 & 3: Full response (with optional tool dispatch) ───────────
    let chatText: string;
    let toolUsed: string | undefined;

    if (forcedName) {
      // Deterministic name-capture response — speak it, skip the model.
      chatText = forcedName;
      openAIVoiceSessionService.pushHistory(transcript, chatText);
    } else if (toolDispatchEnabledRef.current) {
      // Use function calling — AURA can invoke tools autonomously
      try {
        const dispatchResult = await auraToolDispatchService.chatWithTools({
          transcript,
          history: openAIVoiceSessionService.getHistorySlice(6),
          systemPrompt,
          onToolDispatched: (toolId) => {
            setLiveTranscript({ user: transcript, aura: `Running ${toolId}…` });
          },
        });
        chatText = dispatchResult.text;
        toolUsed = dispatchResult.toolUsed;
        // Store in history manually since we bypassed the normal path
        openAIVoiceSessionService.pushHistory(transcript, chatText);
      } catch (err) {
        // Fall back to regular chat on tool dispatch failure
        const fallback = await openAIVoiceSessionService.createChatResponse(
          transcript, style as 'brief' | 'normal' | 'detailed', systemPrompt,
        );
        chatText = fallback.text ?? '';
        if (!fallback.success || !chatText) {
          notifyVoiceError(fallback.error ?? 'AI response failed.');
          runningRef.current = false;
          voiceLatencyService.abort(turnId);
          if (autoListenRef.current) startListeningCycle(); else updatePhase('idle');
          return;
        }
      }
    } else {
      const chatResult = await openAIVoiceSessionService.createChatResponse(
        transcript, style as 'brief' | 'normal' | 'detailed', systemPrompt,
      );
      if (!chatResult.success || !chatResult.text) {
        notifyVoiceError(chatResult.error ?? 'AI response failed.');
        runningRef.current = false;
        voiceLatencyService.abort(turnId);
        if (autoListenRef.current) startListeningCycle(); else updatePhase('idle');
        return;
      }
      chatText = chatResult.text;
    }

    // Wrap into a synthetic result shape for the rest of the pipeline
    const chatResult = { success: true, text: chatText, latencyMs: 0 };
    void toolUsed; // captured in turn log below

    voiceLatencyService.markChatEnd(turnId);

    if (!chatResult.success || !chatResult.text) {
      notifyVoiceError('AI response failed.');
      runningRef.current = false;
      voiceLatencyService.abort(turnId);
      if (autoListenRef.current) startListeningCycle();
      else updatePhase('idle');
      return;
    }

    setLiveTranscript({ user: transcript, aura: chatResult.text });
    updatePhase('preparing_voice');
    voiceLatencyService.markTTSStart(turnId);

    // ── PATH 2: Sentence-first TTS ────────────────────────────────────────
    if (sentenceFirstTTSRef.current) {
      const sentences = openAIVoiceSessionService.splitIntoSentences(chatResult.text);

      if (sentences.length > 1) {
        // Synthesize first sentence immediately
        const first = sentences[0];
        voiceLatencyService.markFirstSentenceTextReady(turnId);
        const firstTts = await openAIVoiceSessionService.synthesizeSpeech(
          first, settingsRef.current.ttsVoice,
        );

        if (firstTts.success && firstTts.audioBlobUrl) {
          voiceLatencyService.markTTSEnd(turnId);
          voiceLatencyService.markFirstSentenceTtsReady(turnId);
          voiceLatencyService.markAudioStart(turnId);
          voiceLatencyService.markFirstAudioStart(turnId);
          setCurrentAudioUrl(firstTts.audioBlobUrl);
          updatePhase('speaking');
          startBargeInAnalyser();

          const remainingText = sentences.slice(1).join(' ');

          // Synthesize remaining while first plays
          const remainTtsPromise = remainingText
            ? openAIVoiceSessionService.synthesizeSpeech(remainingText, settingsRef.current.ttsVoice)
            : Promise.resolve<import('../types/voice-session').VoiceSpeechResult>({ success: false });

          const firstAudio = new Audio(firstTts.audioBlobUrl);
          audioRef.current = firstAudio;
          firstAudio.play().catch(() => {});

          firstAudio.onended = async () => {
            URL.revokeObjectURL(firstTts.audioBlobUrl!);
            const remainTts = await remainTtsPromise;
            if (remainTts.success && remainTts.audioBlobUrl) {
              const remainAudio = new Audio(remainTts.audioBlobUrl);
              audioRef.current = remainAudio;
              setCurrentAudioUrl(remainTts.audioBlobUrl);
              remainAudio.play().catch(() => {});
              voiceLatencyService.markFullAudioReady(turnId);
              remainAudio.onended = () => {
                URL.revokeObjectURL(remainTts.audioBlobUrl!);
                stopBargeInAnalyser();
                setCurrentAudioUrl(null);
                runningRef.current = false;
                const metrics = voiceLatencyService.finalize(turnId);
                if (metrics) setLastLatencyMetrics(metrics);
                if (autoListenRef.current) startListeningCycle();
                else updatePhase('idle');
              };
              remainAudio.onerror = () => {
                stopBargeInAnalyser(); runningRef.current = false;
                voiceLatencyService.abort(turnId);
                if (autoListenRef.current) startListeningCycle(); else updatePhase('idle');
              };
            } else {
              stopBargeInAnalyser();
              setCurrentAudioUrl(null);
              runningRef.current = false;
              const metrics = voiceLatencyService.finalize(turnId);
              if (metrics) setLastLatencyMetrics(metrics);
              if (autoListenRef.current) startListeningCycle();
              else updatePhase('idle');
            }
          };
          firstAudio.onerror = () => {
            stopBargeInAnalyser(); runningRef.current = false;
            voiceLatencyService.abort(turnId);
            if (autoListenRef.current) startListeningCycle(); else updatePhase('idle');
          };

          const turn: VoiceConversationTurn = {
            id: `turn-${Date.now()}`, userText: transcript, auraText: chatResult.text,
            timestamp: new Date().toISOString(), chatLatencyMs: chatResult.latencyMs,
          };
          onTurnRef.current(turn);
          voiceTranscriptLogService.logTurn({ userText: transcript, auraText: chatResult.text, durationMs: elapsed });
          extractMemoryIfEnabled(transcript, chatResult.text);
          return;
        }
      }
    }

    // ── PATH 3: Normal — full TTS then play ───────────────────────────────
    const ttsResult = await openAIVoiceSessionService.synthesizeSpeech(
      chatResult.text, settingsRef.current.ttsVoice,
    );
    voiceLatencyService.markTTSEnd(turnId);

    const turn: VoiceConversationTurn = {
      id:            `turn-${Date.now()}`,
      userText:      transcript,
      auraText:      chatResult.text,
      timestamp:     new Date().toISOString(),
      chatLatencyMs: chatResult.latencyMs,
      ttsLatencyMs:  ttsResult.latencyMs,
    };
    onTurnRef.current(turn);
    voiceTranscriptLogService.logTurn({
      userText: transcript, auraText: chatResult.text,
      durationMs: elapsed, chatLatencyMs: chatResult.latencyMs, ttsLatencyMs: ttsResult.latencyMs,
    });
    extractMemoryIfEnabled(transcript, chatResult.text);

    if (!ttsResult.success || !ttsResult.audioBlobUrl) {
      runningRef.current = false;
      voiceLatencyService.abort(turnId);
      if (autoListenRef.current) startListeningCycle();
      else updatePhase('idle');
      return;
    }

    voiceLatencyService.markAudioStart(turnId);
    playTTSAndContinue(ttsResult.audioBlobUrl, () => {
      const metrics = voiceLatencyService.finalize(turnId);
      if (metrics) setLastLatencyMetrics(metrics);
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearDormancy, updatePhase, startListeningCycle, startBargeInAnalyser, stopBargeInAnalyser, playTTSAndContinue]);

  // ── VAD auto-stop callback ────────────────────────────────────────────────

  useEffect(() => {
    onAutoStopRef.current = async () => {
      if (loopPhaseRef.current !== 'listening' || runningRef.current) return;
      updatePhase('transcribing');
      setLiveTranscript({ user: '…', aura: '' });
      const transcript = await segSession.stopSession();
      if (transcript) {
        processTranscript(transcript);
      } else {
        setConsecutiveErrors(e => e + 1);
        runningRef.current = false;
        if (autoListenRef.current) startListeningCycle();
        else updatePhase('idle');
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processTranscript, updatePhase, startListeningCycle]);

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
    segSession.cancelSession();
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
    updatePhase('transcribing');
    setLiveTranscript({ user: '…', aura: '' });
    const transcript = await segSession.stopSession();
    if (transcript) processTranscript(transcript);
    else { runningRef.current = false; updatePhase('idle'); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearDormancy, processTranscript, updatePhase]);

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
      segSession.cancelSession();
      audioRef.current?.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Explicit "Remember this" — saves last turn to memory ─────────────────
  const rememberLastTurn = useCallback((
    userText: string,
    auraText: string,
    category: 'personal' | 'task' = 'task',
  ) => {
    if (!userText.trim() && !auraText.trim()) return;
    const content = userText.trim() || auraText.trim();
    auraMemoryService.add({ category, source: 'explicit', content, context: userText.slice(0, 100) });
  }, []);

  return {
    loopPhase,
    vadPhase:      segSession.vadPhase as VADPhase,
    micLevel:      segSession.micLevel,
    micPermission: segSession.micPermission,
    durationMs:    segSession.durationMs,
    liveTranscript: liveTranscript ?? (segSession.liveTranscript ? { user: segSession.liveTranscript, aura: '' } : null),
    currentAudioUrl,
    consecutiveErrors,
    lastLatencyMetrics,
    startConversation,
    stopConversation,
    resumeFromDormant,
    manualFinish,
    interruptSpeech,
    rememberLastTurn,
  };
}

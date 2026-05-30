/**
 * VoiceLatencyService — AURA Phase 3F
 *
 * Tracks and stores voice pipeline latency metrics.
 * Components call mark*() at each stage; finalize() computes the full report.
 *
 * Security: no audio, no transcripts, no API keys stored here.
 */

import type { VoiceLatencyMetrics, LatencyContext } from '../../types/voice-latency';

const MAX_STORED = 20;
const STORAGE_KEY = 'aura.voice.latency.history';

type LatencyListener = (metrics: VoiceLatencyMetrics[]) => void;

class VoiceLatencyServiceImpl {
  private history: VoiceLatencyMetrics[] = [];
  private active: Map<string, LatencyContext> = new Map();
  private listeners = new Set<LatencyListener>();

  constructor() {
    this.loadFromStorage();
  }

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(fn: LatencyListener): () => void {
    this.listeners.add(fn);
    fn([...this.history]);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = [...this.history];
    for (const fn of this.listeners) fn(snap);
  }

  // ── Context management ────────────────────────────────────────────────────

  startTurn(options: {
    responseStyle: 'fast' | 'brief' | 'normal' | 'detailed';
    segmentedMode: boolean;
    sentenceFirstTTS: boolean;
  }): string {
    const id = `lt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ctx: LatencyContext = {
      turnId: id,
      recordingStartedAt: Date.now(),
      sttSegmentTimes: [],
      segmentCount: 0,
      ...options,
    };
    this.active.set(id, ctx);
    return id;
  }

  markRecordingEnded(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.recordingEndedAt = Date.now();
  }

  addSegmentTime(turnId: string, ms: number) {
    const ctx = this.active.get(turnId);
    if (ctx) { ctx.sttSegmentTimes.push(ms); ctx.segmentCount++; }
  }

  markChatStart(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.chatStartedAt = Date.now();
  }

  markChatEnd(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.chatEndedAt = Date.now();
  }

  markTTSStart(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.ttsStartedAt = Date.now();
  }

  markTTSEnd(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.ttsEndedAt = Date.now();
  }

  markAudioStart(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.audioStartedAt = Date.now();
  }

  // Sentence-first TTS granular markers (Phase 3F QA)
  markFirstSentenceTextReady(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.firstSentenceTextReadyAt = Date.now();
  }

  markFirstSentenceTtsReady(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.firstSentenceTtsReadyAt = Date.now();
  }

  markFirstAudioStart(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.firstAudioStartAt = Date.now();
  }

  markFullAudioReady(turnId: string) {
    const ctx = this.active.get(turnId);
    if (ctx) ctx.fullAudioReadyAt = Date.now();
  }

  finalize(turnId: string): VoiceLatencyMetrics | null {
    const ctx = this.active.get(turnId);
    if (!ctx) return null;
    this.active.delete(turnId);

    const now = Date.now();
    const recEnd   = ctx.recordingEndedAt ?? now;
    const chatEnd  = ctx.chatEndedAt ?? now;
    const ttsEnd   = ctx.ttsEndedAt ?? now;
    const audioStart = ctx.audioStartedAt ?? ttsEnd;

    const sttTotal  = ctx.sttSegmentTimes.reduce((a, b) => a + b, 0);
    const sttAvg    = ctx.segmentCount > 0 ? Math.round(sttTotal / ctx.segmentCount) : 0;
    const chatMs    = ctx.chatStartedAt ? chatEnd - ctx.chatStartedAt : 0;
    const ttsMs     = ctx.ttsStartedAt ? ttsEnd - ctx.ttsStartedAt : 0;
    const playMs    = ctx.ttsEndedAt ? audioStart - ctx.ttsEndedAt : 0;
    const perceived = audioStart - recEnd;
    const total     = now - ctx.recordingStartedAt;

    const metrics: VoiceLatencyMetrics = {
      id: ctx.turnId,
      timestamp: new Date().toISOString(),
      recordingMs:         recEnd - ctx.recordingStartedAt,
      segmentCount:        ctx.segmentCount,
      sttTotalMs:          sttTotal,
      sttAvgSegmentMs:     sttAvg,
      chatRequestMs:       ctx.chatStartedAt ? ctx.chatStartedAt - recEnd : 0,
      chatTotalMs:         chatMs,
      ttsSynthesisMs:      ttsMs,
      audioPlaybackStartMs: playMs,
      perceivedLatencyMs:  Math.max(0, perceived),
      totalRoundTripMs:    total,
      // Sentence-first TTS granular metrics
      firstSentenceTextReadyMs: ctx.firstSentenceTextReadyAt
        ? ctx.firstSentenceTextReadyAt - recEnd : undefined,
      firstSentenceTtsReadyMs: (ctx.firstSentenceTextReadyAt && ctx.firstSentenceTtsReadyAt)
        ? ctx.firstSentenceTtsReadyAt - ctx.firstSentenceTextReadyAt : undefined,
      firstAudioStartMs: ctx.firstAudioStartAt
        ? ctx.firstAudioStartAt - recEnd : undefined,
      fullAudioReadyMs: ctx.fullAudioReadyAt
        ? ctx.fullAudioReadyAt - recEnd : undefined,
      responseStyle:       ctx.responseStyle,
      segmentedMode:       ctx.segmentedMode,
      sentenceFirstTTS:    ctx.sentenceFirstTTS,
    };

    this.history = [metrics, ...this.history].slice(0, MAX_STORED);
    this.saveToStorage();
    this.notify();
    return metrics;
  }

  abort(turnId: string) {
    this.active.delete(turnId);
  }

  getHistory(): VoiceLatencyMetrics[] { return [...this.history]; }

  getLastMetrics(): VoiceLatencyMetrics | null {
    return this.history[0] ?? null;
  }

  clearHistory() {
    this.history = [];
    this.saveToStorage();
    this.notify();
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.history = JSON.parse(raw) as VoiceLatencyMetrics[];
    } catch { this.history = []; }
  }

  private saveToStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history)); }
    catch { /* storage full — ignore */ }
  }

  /** Human-readable summary for display in UI panels */
  formatLast(): string {
    const m = this.getLastMetrics();
    if (!m) return 'No metrics yet';
    return `Perceived ${m.perceivedLatencyMs}ms · STT ${m.sttTotalMs}ms · Chat ${m.chatTotalMs}ms · TTS ${m.ttsSynthesisMs}ms`;
  }
}

export const voiceLatencyService = new VoiceLatencyServiceImpl();

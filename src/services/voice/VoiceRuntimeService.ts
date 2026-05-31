/**
 * VoiceRuntimeService — AURA Phase 2F/2G Voice Runtime Foundation
 *
 * Central singleton that owns the mutable voice runtime state and emits
 * snapshot updates to all React subscribers via a lightweight pub/sub model.
 *
 * Design principles:
 * ─ No real audio. No microphone. No API calls. No secrets.
 * ─ All state transitions are explicit method calls (startListening, etc.).
 * ─ Side effects (notifications) are handled internally via the notification bridge.
 * ─ Future real STT/TTS hooks into startListening() / startSpeaking() only —
 *   components and the hook require no changes.
 *
 * Notification bridge:
 *   approval_requested  → approval notification (persistent)
 *   approval_resolved   → success / info notification
 *   memory_updated      → memory notification
 *   relay_ready         → relay notification
 *   error               → danger notification
 *   tool_locked         → warning notification
 *   handoff_created     → info notification
 */

import { notificationService } from '../notifications/NotificationService';
import { settingsService } from '../settings/SettingsService';
import type {
  VoiceRuntimeState,
  VoiceRuntimeEvent,
  VoiceRuntimeEventType,
  VoiceSpeaker,
  VoiceApprovalRequest,
  VoiceMission,
  VoiceRuntimeSnapshot,
  VoiceRuntimeMode,
  VoiceRuntimeStatus,
} from '../../types/voice-runtime';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `vrt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type SnapshotListener = (snapshot: VoiceRuntimeSnapshot) => void;

// ─── Default mission ──────────────────────────────────────────────────────────

const DEFAULT_MISSION: VoiceMission = {
  name:     'AURA Internal Agent OS',
  phase:    'Phase 3G',
  progress:  90,
  agent:    'AURA',
};

// ─── Service ──────────────────────────────────────────────────────────────────

class VoiceRuntimeService {
  // ── Internal state ────────────────────────────────────────────────────────

  private _state: VoiceRuntimeState  = 'ready';
  private _activeSpeaker: VoiceSpeaker = 'none';
  private _mission: VoiceMission     = { ...DEFAULT_MISSION };
  private _pendingApprovals: VoiceApprovalRequest[] = [];
  private _recentEvents: VoiceRuntimeEvent[]        = [];
  private _isMuted    = false;
  private _isSafeMode = false;
  private _mode: VoiceRuntimeMode     = 'mock';
  private _status: VoiceRuntimeStatus = 'active';

  private readonly listeners  = new Set<SnapshotListener>();
  private readonly MAX_EVENTS = 30;

  /** Tracks active demo sequence timers so we can prevent re-entry */
  private demoTimers: ReturnType<typeof setTimeout>[] = [];

  // ── Subscription ──────────────────────────────────────────────────────────

  /** Subscribe to snapshot updates. Returns an unsubscribe function. */
  subscribe(fn: SnapshotListener): () => void {
    this.listeners.add(fn);
    // Deliver current snapshot immediately on subscribe
    fn(this.getSnapshot());
    return () => this.listeners.delete(fn);
  }

  private broadcast() {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) fn(snap);
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  getSnapshot(): VoiceRuntimeSnapshot {
    return {
      state:            this._state,
      activeSpeaker:    this._activeSpeaker,
      mission:          { ...this._mission },
      pendingApprovals: [...this._pendingApprovals],
      recentEvents:     [...this._recentEvents],
      isMuted:          this._isMuted,
      isSafeMode:       this._isSafeMode,
      mode:             this._mode,
      status:           this._status,
    };
  }

  // ── Event emission ────────────────────────────────────────────────────────

  emit(type: VoiceRuntimeEventType, payload?: Record<string, unknown>): void {
    const event: VoiceRuntimeEvent = {
      id:        uid(),
      type,
      timestamp: Date.now(),
      payload,
    };
    this._recentEvents = [event, ...this._recentEvents].slice(0, this.MAX_EVENTS);
    this.handleNotificationBridge(event);
    this.broadcast();
  }

  // ── Notification bridge ───────────────────────────────────────────────────
  // Maps runtime events to the NotificationService so the bell + toasts fire.

  private handleNotificationBridge(event: VoiceRuntimeEvent): void {
    switch (event.type) {

      case 'approval_requested':
        notificationService.add({
          type:      'approval',
          title:     (event.payload?.title   as string) ?? 'Approval required',
          message:   (event.payload?.summary as string) ?? 'An agent is requesting permission.',
          riskLevel: (event.payload?.riskLevel as 'low' | 'medium' | 'high' | 'critical') ?? 'medium',
          // No TTL — approval notifications are persistent until dismissed
        });
        break;

      case 'approval_resolved': {
        const decision = event.payload?.decision as string | undefined;
        notificationService.add({
          type:    decision === 'approved' ? 'success' : 'info',
          title:   decision === 'approved' ? 'Request approved' : 'Request rejected',
          message: (event.payload?.title as string) ?? undefined,
          ttl:     4000,
        });
        break;
      }

      case 'memory_updated':
        notificationService.add({
          type:    'memory',
          title:   'Memory updated',
          message: (event.payload?.detail as string) ?? undefined,
          ttl:     4000,
        });
        break;

      case 'relay_ready':
        notificationService.add({
          type:    'relay',
          title:   'Relay ready',
          message: (event.payload?.detail as string) ?? undefined,
          ttl:     5000,
        });
        break;

      case 'handoff_created':
        notificationService.add({
          type:    'info',
          title:   'Handoff created',
          message: (event.payload?.detail as string) ?? undefined,
          ttl:     4000,
        });
        break;

      case 'tool_locked':
        notificationService.add({
          type:    'warning',
          title:   'Tool locked',
          message: (event.payload?.toolName as string) ?? undefined,
          ttl:     4000,
        });
        break;

      case 'error':
        notificationService.add({
          type:  'danger',
          title: (event.payload?.message as string) ?? 'Runtime error',
          ttl:   6000,
        });
        break;

      // Other events (speaking, listening, etc.) have no notification side-effect
      default:
        break;
    }
  }

  // ── State transitions ─────────────────────────────────────────────────────

  setState(state: VoiceRuntimeState): void {
    this._state = state;
    this.broadcast();
  }

  setMission(mission: Partial<VoiceMission>): void {
    this._mission = { ...this._mission, ...mission };
    this.broadcast();
  }

  // ── Listening (admin voice) ───────────────────────────────────────────────

  startListening(): void {
    if (this._isMuted) return;
    this._state         = 'listening';
    this._activeSpeaker = 'admin';
    this.emit('admin_started_speaking');
  }

  stopListening(): void {
    this._state         = 'ready';
    this._activeSpeaker = 'none';
    this.emit('admin_stopped_speaking');
  }

  // ── Thinking ──────────────────────────────────────────────────────────────

  startThinking(): void {
    this._state         = 'thinking';
    this._activeSpeaker = 'system';
    this.emit('aura_started_thinking');
  }

  // ── Speaking (AURA voice output) ──────────────────────────────────────────

  startSpeaking(text?: string): void {
    this._state         = 'speaking';
    this._activeSpeaker = 'aura';
    this.emit('aura_started_speaking', text ? { text } : undefined);
  }

  stopSpeaking(): void {
    this._state         = 'ready';
    this._activeSpeaker = 'none';
    this.emit('aura_stopped_speaking');
  }

  // ── Persistence (Phase 2G) ────────────────────────────────────────────────

  /**
   * Reads persisted muted and safeMode from SettingsService and applies them.
   * Should be called once at app startup (from useVoiceRuntime on mount).
   * Async — state starts at defaults, updates after settings load.
   */
  async initFromSettings(): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      let changed = false;
      if (settings.assistantMuted !== this._isMuted) {
        this._isMuted = settings.assistantMuted;
        changed = true;
      }
      if (settings.safeMonitorMode !== this._isSafeMode) {
        this._isSafeMode = settings.safeMonitorMode;
        changed = true;
      }
      if (changed) this.broadcast();
    } catch {
      // Settings unavailable — retain defaults (isMuted=false, isSafeMode=false)
    }
  }

  // ── Mute / safe mode ──────────────────────────────────────────────────────

  setMuted(muted: boolean): void {
    this._isMuted = muted;
    if (muted && this._state === 'listening') {
      this._state         = 'muted';
      this._activeSpeaker = 'none';
    } else if (!muted && this._state === 'muted') {
      this._state = 'ready';
    }
    // Persist to settings (fire-and-forget; never awaited)
    settingsService.updateSettings({ assistantMuted: muted }).catch(() => {});
    this.broadcast();
  }

  setSafeMode(safe: boolean): void {
    this._isSafeMode = safe;
    // Persist to settings (fire-and-forget)
    settingsService.updateSettings({ safeMonitorMode: safe }).catch(() => {});
    this.broadcast();
  }

  // ── Approvals ─────────────────────────────────────────────────────────────

  requestApproval(
    data: Omit<VoiceApprovalRequest, 'id' | 'status' | 'requestedAt'>,
  ): VoiceApprovalRequest {
    const approval: VoiceApprovalRequest = {
      ...data,
      id:          uid(),
      status:      'pending',
      requestedAt: Date.now(),
    };

    this._pendingApprovals = [...this._pendingApprovals, approval];

    // Transition to waiting state unless we are already in a busier state
    if (this._state === 'ready' || this._state === 'thinking') {
      this._state = 'waiting_for_approval';
    }

    this.emit('approval_requested', {
      id:        approval.id,
      title:     approval.title,
      summary:   approval.summary,
      riskLevel: approval.riskLevel,
    });

    return approval;
  }

  resolveApproval(id: string, decision: 'approved' | 'rejected'): void {
    // Capture title before modifying the array
    const approval = this._pendingApprovals.find(a => a.id === id);

    // Mark the approval as resolved (leave in array briefly for UI display)
    this._pendingApprovals = this._pendingApprovals.map(a =>
      a.id === id
        ? { ...a, status: decision, resolvedAt: Date.now(), decision }
        : a,
    );

    // Remove after 1.2 s (matches the ApprovalCard fade-out duration)
    setTimeout(() => {
      this._pendingApprovals = this._pendingApprovals.filter(a => a.id !== id);
      const stillPending = this._pendingApprovals.some(a => a.status === 'pending');
      if (!stillPending && this._state === 'waiting_for_approval') {
        this._state = 'ready';
      }
      this.broadcast();
    }, 1200);

    this.emit('approval_resolved', {
      id,
      decision,
      title: approval?.title,
    });
  }

  // ── Runtime notification (direct) ─────────────────────────────────────────

  /** Add a notification directly without creating a runtime event first. */
  addRuntimeNotification(
    payload: Parameters<typeof notificationService.add>[0],
  ): void {
    notificationService.add(payload);
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  clearRuntime(): void {
    this.demoTimers.forEach(clearTimeout);
    this.demoTimers = [];

    this._state            = 'ready';
    this._activeSpeaker    = 'none';
    this._pendingApprovals = [];
    this._recentEvents     = [];
    this.broadcast();
  }

  // ── Demo sequence ─────────────────────────────────────────────────────────
  //
  // Simulates a realistic AURA interaction cycle:
  //   admin speaks → AURA thinks → AURA speaks → approval requested
  //
  // Timings are chosen to give the visualizer time to animate between states.

  runDemoSequence(): void {
    if (this.demoTimers.length > 0) return; // prevent concurrent sequences

    const steps: Array<[number, () => void]> = [
      [   0, () => { this.startListening(); }],
      [2400, () => { this.stopListening();  this.startThinking(); }],
      [4600, () => { this.startSpeaking(); }],
      [7200, () => { this.stopSpeaking(); }],
      [8000, () => {
        this.requestApproval({
          title:           'Run read_file',
          summary:         'Claude Architect requests permission to read a local project file.',
          riskLevel:       'medium',
          requestedAction: 'read_file(path=./src/pages/Console.tsx)',
          sourceAgent:     'Claude Architect',
          targetAgent:     'local-shell',
        });
      }],
      [8100, () => { this.demoTimers = []; }], // clear tracking flag
    ];

    this.demoTimers = steps.map(([delay, fn]) => setTimeout(fn, delay));
  }

  /** Inject a single mock approval directly (without the full demo sequence). */
  simulateApproval(): VoiceApprovalRequest {
    return this.requestApproval({
      title:           'Run read_file',
      summary:         'Claude Architect requests permission to read a local project file.',
      riskLevel:       'medium',
      requestedAction: 'read_file(path=./src/pages/Console.tsx)',
      sourceAgent:     'Claude Architect',
      targetAgent:     'local-shell',
    });
  }

  /** Simulate AURA speaking for 3 s then returning to ready. */
  simulateSpeaking(): void {
    this.startSpeaking();
    const t = setTimeout(() => {
      this.stopSpeaking();
      this.demoTimers = this.demoTimers.filter(x => x !== t);
    }, 3000);
    this.demoTimers.push(t);
  }

  /** Simulate admin speaking for 3 s then returning to ready. */
  simulateAdminSpeaking(): void {
    this.startListening();
    const t = setTimeout(() => {
      this.stopListening();
      this.demoTimers = this.demoTimers.filter(x => x !== t);
    }, 3000);
    this.demoTimers.push(t);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const voiceRuntimeService = new VoiceRuntimeService();

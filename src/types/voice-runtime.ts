/**
 * AURA Voice Runtime Types — Phase 2F
 *
 * Central type definitions for the event-driven Voice Runtime layer.
 * No API keys, no real audio, no microphone access — mock/local events only.
 *
 * Architecture overview:
 *   VoiceRuntimeService  ──(emits events)──▶  listeners (React hooks)
 *   useVoiceRuntime      ──(subscribes)──▶    component state
 *   AuraVoiceCore        ──(reads)──▶          visualizer, tray, badge
 *
 * Future real-provider integration:
 *   When STT/TTS providers are wired, VoiceRuntimeService.startListening()
 *   will open a real audio stream and emit the same events. Components
 *   require no changes — only the service internals change.
 */

// ─── Runtime states ───────────────────────────────────────────────────────────

/**
 * The current operational state of the voice runtime.
 * Maps directly to VisualizerState for the orb (minus 'muted' which maps to idle).
 */
export type VoiceRuntimeState =
  | 'ready'               // Initialised, no active task — calm orb
  | 'listening'           // Admin is speaking / mic open
  | 'thinking'            // AURA processing — low-energy ambient
  | 'speaking'            // AURA generating speech output
  | 'waiting_for_approval' // Waiting for admin decision — orb paused
  | 'executing'           // Running an approved tool/command
  | 'error'               // Something went wrong
  | 'muted';              // Microphone muted by admin

/** Visual/functional mode of the runtime — reserved for future provider switching */
export type VoiceRuntimeMode = 'mock' | 'real';

/** Overall service health */
export type VoiceRuntimeStatus = 'active' | 'degraded' | 'offline';

// ─── Speaker ─────────────────────────────────────────────────────────────────

/** Who is currently producing audio (or none) */
export type VoiceSpeaker = 'aura' | 'admin' | 'system' | 'none';

/** Source accent for the visualizer SVG ring color */
export type VoiceRuntimeSource = 'aura' | 'admin' | 'system';

// ─── Events ──────────────────────────────────────────────────────────────────

export type VoiceRuntimeEventType =
  | 'aura_ready'
  | 'admin_started_speaking'
  | 'admin_stopped_speaking'
  | 'aura_started_thinking'
  | 'aura_started_speaking'
  | 'aura_stopped_speaking'
  | 'approval_requested'
  | 'approval_resolved'
  | 'relay_ready'
  | 'handoff_created'
  | 'memory_updated'
  | 'tool_locked'
  | 'tool_running'
  | 'tool_completed'
  | 'error'
  | 'notification_created'
  | 'idle';

export interface VoiceRuntimeEvent {
  id: string;
  type: VoiceRuntimeEventType;
  timestamp: number;
  /** Arbitrary event payload — always Record to keep events schema-light */
  payload?: Record<string, unknown>;
}

// ─── Approval ────────────────────────────────────────────────────────────────

export interface VoiceApprovalRequest {
  /** Stable runtime-assigned ID */
  id: string;
  title: string;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requestedAction: string;
  sourceAgent: string;
  targetAgent: string;
  /** Lifecycle status — mirrors ApprovalCard.status */
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  resolvedAt?: number;
  decision?: 'approved' | 'rejected';
}

// ─── Mission ─────────────────────────────────────────────────────────────────

export interface VoiceMission {
  name: string;
  phase: string;
  progress: number;
  agent: string;
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Immutable point-in-time view of the runtime.
 * Emitted to all subscribers on every state change.
 */
export interface VoiceRuntimeSnapshot {
  state: VoiceRuntimeState;
  activeSpeaker: VoiceSpeaker;
  mission: VoiceMission;
  /** All approvals in the queue (pending and recently resolved) */
  pendingApprovals: VoiceApprovalRequest[];
  /** Rolling history of recent events, newest first */
  recentEvents: VoiceRuntimeEvent[];
  isMuted: boolean;
  isSafeMode: boolean;
  mode: VoiceRuntimeMode;
  status: VoiceRuntimeStatus;
}

// ─── Settings ────────────────────────────────────────────────────────────────

/** Subset of app settings relevant to voice runtime behaviour */
export interface VoiceRuntimeSettings {
  /** 'mock' = local simulation only; 'real' = live STT/TTS (future) */
  mode: VoiceRuntimeMode;
  muteAssistantByDefault: boolean;
  enableStartupGreeting: boolean;
  enableDemoEvents: boolean;
}

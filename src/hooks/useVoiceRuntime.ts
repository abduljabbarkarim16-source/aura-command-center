/**
 * useVoiceRuntime — Phase 2F Voice Runtime Hook
 *
 * Subscribes a React component to the VoiceRuntimeService singleton and
 * re-renders on every snapshot change.
 *
 * Returns the full current snapshot plus bound action helpers so components
 * never need to import the service directly.
 *
 * Usage:
 *   const runtime = useVoiceRuntime();
 *   runtime.state          // 'ready' | 'listening' | ...
 *   runtime.pendingApprovals  // VoiceApprovalRequest[]
 *   runtime.startListening()
 *   runtime.resolveApproval(id, 'approved')
 */

import { useEffect, useState } from 'react';
import { voiceRuntimeService } from '../services/voice/VoiceRuntimeService';
import { notificationService } from '../services/notifications/NotificationService';
import type { VoiceRuntimeSnapshot, VoiceApprovalRequest } from '../types/voice-runtime';
import type { NotificationType, RiskLevel } from '../types/notifications';

type NotificationPayload = {
  type: NotificationType;
  title: string;
  message?: string;
  riskLevel?: RiskLevel;
  ttl?: number;
};

// ─── Return type ─────────────────────────────────────────────────────────────

export interface UseVoiceRuntimeResult extends VoiceRuntimeSnapshot {
  // ── Listening ────────────────────────────────────────────────────────────
  startListening:     () => void;
  stopListening:      () => void;

  // ── AURA internal states ─────────────────────────────────────────────────
  startThinking:      () => void;
  startSpeaking:      (text?: string) => void;
  stopSpeaking:       () => void;

  // ── Approvals ────────────────────────────────────────────────────────────
  requestApproval:    (data: Omit<VoiceApprovalRequest, 'id' | 'status' | 'requestedAt'>) => VoiceApprovalRequest;
  resolveApproval:    (id: string, decision: 'approved' | 'rejected') => void;
  simulateApproval:   () => VoiceApprovalRequest;

  // ── Demo / simulation ─────────────────────────────────────────────────────
  runDemoSequence:    () => void;
  simulateSpeaking:   () => void;
  simulateAdminSpeaking: () => void;

  // ── Direct notifications ──────────────────────────────────────────────────
  /** Add a notification directly, bypassing the runtime event bus. */
  addRuntimeNotification: (payload: NotificationPayload) => void;

  // ── Global controls ──────────────────────────────────────────────────────
  toggleMuted:        () => void;
  toggleSafeMode:     () => void;
  clearRuntime:       () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVoiceRuntime(): UseVoiceRuntimeResult {
  // Arrow-function wrapper preserves `this` for the class method call.
  const [snapshot, setSnapshot] = useState<VoiceRuntimeSnapshot>(
    () => voiceRuntimeService.getSnapshot(),
  );

  useEffect(() => {
    // subscribe() delivers the current snapshot immediately, then on each change.
    return voiceRuntimeService.subscribe(setSnapshot);
  }, []);

  return {
    // ── Snapshot fields (spread) ─────────────────────────────────────────
    ...snapshot,

    // ── Actions (bound to singleton so they stay referentially stable) ──
    startListening:       () => voiceRuntimeService.startListening(),
    stopListening:        () => voiceRuntimeService.stopListening(),

    startThinking:        () => voiceRuntimeService.startThinking(),
    startSpeaking:        (text?: string) => voiceRuntimeService.startSpeaking(text),
    stopSpeaking:         () => voiceRuntimeService.stopSpeaking(),

    requestApproval:      (data) => voiceRuntimeService.requestApproval(data),
    resolveApproval:      (id, decision) => voiceRuntimeService.resolveApproval(id, decision),
    simulateApproval:     () => voiceRuntimeService.simulateApproval(),

    runDemoSequence:      () => voiceRuntimeService.runDemoSequence(),
    simulateSpeaking:     () => voiceRuntimeService.simulateSpeaking(),
    simulateAdminSpeaking: () => voiceRuntimeService.simulateAdminSpeaking(),

    addRuntimeNotification: (payload: NotificationPayload) => notificationService.add(payload),

    toggleMuted:          () => voiceRuntimeService.setMuted(!snapshot.isMuted),
    toggleSafeMode:       () => voiceRuntimeService.setSafeMode(!snapshot.isSafeMode),
    clearRuntime:         () => voiceRuntimeService.clearRuntime(),
  };
}

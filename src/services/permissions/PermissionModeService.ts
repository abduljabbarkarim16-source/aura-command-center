/**
 * PermissionModeService — AURA Phase 3G (Milestone 12)
 *
 * Holds the active permission mode and decides, per tool, whether execution is
 * auto / ask / block. Logs every decision so auto-runs are auditable.
 *
 * Safety: the decision is a *frontend convenience gate*. The real safety
 * boundary is the Rust allowlist (no arbitrary shell, destructive commands and
 * unknown binaries rejected). No mode can widen that boundary. High-risk tools
 * are never auto-run in any mode.
 */

import type { ToolDefinition } from '../../types/tools';
import type { PermissionMode, PermissionDecision } from '../../types/permission-mode';

const STORAGE_KEY = 'aura.permissionMode';
const MAX_LOG = 200;

export interface PermissionDecisionLog {
  at: string;
  toolId: string;
  risk: string;
  mode: PermissionMode;
  decision: PermissionDecision;
  reason: string;
}

type ModeListener = (mode: PermissionMode) => void;

class PermissionModeServiceImpl {
  private mode: PermissionMode;
  private log: PermissionDecisionLog[] = [];
  private listeners = new Set<ModeListener>();

  constructor() {
    let stored: PermissionMode | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY) as PermissionMode | null; } catch { /* ignore */ }
    this.mode = stored ?? 'safe-auto';
  }

  subscribe(fn: ModeListener): () => void {
    this.listeners.add(fn);
    fn(this.mode);
    return () => this.listeners.delete(fn);
  }

  private notify() { for (const fn of this.listeners) fn(this.mode); }

  getMode(): PermissionMode { return this.mode; }

  setMode(mode: PermissionMode) {
    this.mode = mode;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
    this.notify();
  }

  getLog(): PermissionDecisionLog[] { return [...this.log]; }

  /**
   * Decide how a tool may run under the current mode.
   * none/low risk are treated as "low". high is never auto.
   */
  decide(tool: Pick<ToolDefinition, 'id' | 'risk'>): { decision: PermissionDecision; reason: string } {
    const risk = tool.risk; // 'low' | 'medium' | 'high'
    let decision: PermissionDecision;
    let reason: string;

    if (this.mode === 'locked') {
      decision = 'block'; reason = 'Locked mode — no tool execution.';
    } else if (risk === 'high') {
      // Never auto, regardless of mode.
      decision = 'ask'; reason = 'High-risk tool always requires approval.';
    } else if (this.mode === 'approval-required') {
      decision = 'ask'; reason = 'Approval-required mode — confirm every tool.';
    } else if (this.mode === 'safe-auto') {
      decision = risk === 'low' ? 'auto' : 'ask';
      reason = risk === 'low' ? 'Safe Auto — low-risk auto-run.' : 'Safe Auto — medium-risk needs approval.';
    } else { // admin-bypass
      decision = (risk === 'low' || risk === 'medium') ? 'auto' : 'ask';
      reason = 'Admin Bypass — low/medium allowlisted auto-run (destructive/unknown still blocked by Rust).';
    }

    this.record({ at: new Date().toISOString(), toolId: tool.id, risk, mode: this.mode, decision, reason });
    return { decision, reason };
  }

  private record(entry: PermissionDecisionLog) {
    this.log = [entry, ...this.log].slice(0, MAX_LOG);
  }
}

export const permissionModeService = new PermissionModeServiceImpl();

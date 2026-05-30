/**
 * AgentSessionService — AURA Phase 3E
 *
 * Registry for external agent CLI sessions.
 * Phase 3E: availability check only. Spawn is not yet active.
 *
 * Security:
 *  - CLI binary allowlist: claude, codex only
 *  - No arbitrary shell
 *  - No secrets as arguments
 */

import type { AgentSession, AgentCLI, CLIAvailability } from '../../types/agent-session';
import { invoke } from '@tauri-apps/api/core';

const ALLOWED_CLIS: AgentCLI[] = ['claude', 'codex'];

type SessionListener = (sessions: AgentSession[]) => void;

class AgentSessionServiceImpl {
  private sessions: AgentSession[] = [];
  private availability: Map<AgentCLI, CLIAvailability> = new Map();
  private listeners = new Set<SessionListener>();

  subscribe(fn: SessionListener): () => void {
    this.listeners.add(fn);
    fn([...this.sessions]);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const snap = [...this.sessions];
    for (const fn of this.listeners) fn(snap);
  }

  /** Check if a CLI binary is available. Does not launch anything. */
  async checkAvailability(cli: AgentCLI): Promise<CLIAvailability> {
    if (!ALLOWED_CLIS.includes(cli)) {
      throw new Error(`CLI '${cli}' is not in the AURA allowlist.`);
    }

    try {
      const result = await invoke<{ available: boolean; path?: string }>('check_cli_available', { binary: cli });
      const availability: CLIAvailability = {
        cli,
        available: result.available,
        path: result.path,
        checkedAt: new Date().toISOString(),
      };
      this.availability.set(cli, availability);
      return availability;
    } catch {
      const availability: CLIAvailability = {
        cli,
        available: false,
        checkedAt: new Date().toISOString(),
      };
      this.availability.set(cli, availability);
      return availability;
    }
  }

  getCachedAvailability(cli: AgentCLI): CLIAvailability | null {
    return this.availability.get(cli) ?? null;
  }

  getSessions(): AgentSession[] {
    return [...this.sessions];
  }

  /** Add a usage-limit note for a session (triggered by output parsing) */
  markUsageLimit(sessionId: string, message: string, resetAt?: string): void {
    this.sessions = this.sessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        status: 'usage_limit',
        usageLimitMessage: message,
        usageLimitResetAt: resetAt,
      };
    });
    this.notify();
  }
}

export const agentSessionService = new AgentSessionServiceImpl();

/**
 * CliSessionService — AURA Phase 3F
 *
 * Manages agent CLI sessions: spawn, track, store output, detect usage limits.
 *
 * Security:
 *  - All spawning goes through Tauri Rust backend (binary allowlist enforced there)
 *  - Prompt sanitised by Rust layer (length, metacharacters)
 *  - No secrets, no API keys, no repo source in prompts
 *  - Sessions have hard timeout (60s) enforced in Rust
 *  - Max concurrent sessions: 2
 */

import { invoke } from '@tauri-apps/api/core';
import type { AgentSession, AgentCLI, AgentSessionStatus } from '../../types/agent-session';
import { runtimeTaskService } from '../runtime/RuntimeTaskService';

const MAX_OUTPUT_LINES = 500;
const MAX_CONCURRENT   = 2;

interface RustSessionResult {
  sessionId:            string;
  binary:               string;
  success:              boolean;
  exitCode:             number;
  stdout:               string;
  stderr:               string;
  durationMs:           number;
  timedOut:             boolean;
  usageLimitDetected:   boolean;
  usageLimitMessage?:   string;
  error?:               string;
}

type SessionListener = (sessions: AgentSession[]) => void;

function uid(): string {
  return `cls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

class CliSessionServiceImpl {
  private sessions: AgentSession[] = [];
  private listeners = new Set<SessionListener>();

  subscribe(fn: SessionListener): () => void {
    this.listeners.add(fn);
    fn([...this.sessions]);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = [...this.sessions];
    for (const fn of this.listeners) fn(snap);
  }

  private update(id: string, patch: Partial<AgentSession>) {
    this.sessions = this.sessions.map(s => s.id === id ? { ...s, ...patch } : s);
    this.notify();
  }

  getSessions(): AgentSession[] { return [...this.sessions]; }

  getActiveCount(): number {
    return this.sessions.filter(s => s.status === 'running').length;
  }

  /** Spawn a CLI agent session with a prompt. Returns session id. */
  async spawn(cli: AgentCLI, prompt: string): Promise<string> {
    if (this.getActiveCount() >= MAX_CONCURRENT) {
      throw new Error(`Max concurrent CLI sessions (${MAX_CONCURRENT}) already running.`);
    }

    const id = uid();
    const session: AgentSession = {
      id,
      cli,
      status: 'running',
      startedAt: new Date().toISOString(),
      prompt,
      outputLines: [],
    };

    this.sessions = [session, ...this.sessions].slice(0, 50);
    this.notify();

    // Create a corresponding RuntimeTask
    const task = runtimeTaskService.createTask({
      title: `${cli === 'claude' ? 'Claude' : 'Codex'} CLI Session`,
      type: 'cli',
      source: 'agent',
      risk: 'medium',
    });
    runtimeTaskService.startTask(task.id);
    runtimeTaskService.appendLog(task.id, `Prompt: ${prompt}`);

    // Spawn via Rust (non-blocking — invoke awaits until process completes)
    try {
      const result = await invoke<RustSessionResult>('spawn_agent_session', {
        binary: cli,
        prompt,
        sessionId: id,
      });

      const lines = [
        ...result.stdout.split('\n').filter(Boolean),
        ...result.stderr.split('\n').filter(Boolean),
      ].slice(0, MAX_OUTPUT_LINES);
      
      if (lines.length > 0) {
        runtimeTaskService.appendLog(task.id, lines.join('\n').slice(0, 200) + (lines.join('\n').length > 200 ? '...' : ''), result.success ? 'success' : 'warn');
      }

      let status: AgentSessionStatus = result.success ? 'completed' : 'error';
      if (result.timedOut) status = 'error';
      if (result.usageLimitDetected) status = 'usage_limit';

      this.update(id, {
        status,
        endedAt: new Date().toISOString(),
        outputLines: lines,
        exitCode: result.exitCode,
        errorSummary: result.error ?? (result.timedOut ? 'Session timed out after 60s' : undefined),
        usageLimitMessage: result.usageLimitMessage,
      });
      
      if (status === 'completed') {
        runtimeTaskService.completeTask(task.id, result, 'Completed successfully');
      } else {
        runtimeTaskService.failTask(task.id, result.error ?? result.usageLimitMessage ?? 'Session failed');
      }
    } catch (err) {
      this.update(id, {
        status: 'error',
        endedAt: new Date().toISOString(),
        errorSummary: String(err),
      });
      
      runtimeTaskService.appendLog(task.id, String(err), 'error');
      runtimeTaskService.failTask(task.id, String(err));
    }

    return id;
  }

  getSession(id: string): AgentSession | undefined {
    return this.sessions.find(s => s.id === id);
  }

  clearCompleted() {
    this.sessions = this.sessions.filter(s => s.status === 'running');
    this.notify();
  }

  clearAll() {
    this.sessions = this.sessions.filter(s => s.status === 'running');
    this.notify();
  }
}

export const cliSessionService = new CliSessionServiceImpl();

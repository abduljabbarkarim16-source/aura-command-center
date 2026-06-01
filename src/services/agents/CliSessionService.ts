/**
 * CliSessionService - AURA CLI session manager.
 *
 * Spawns allowlisted local agent CLIs through the Tauri Rust bridge, tracks
 * their output, and mirrors each run into RuntimeTask history. `spawn()` waits
 * for completion; `spawnBackground()` returns ids immediately and lets the
 * process finish in the background.
 */

import { invoke } from '@tauri-apps/api/core';
import type { AgentSession, AgentCLI, AgentSessionStatus } from '../../types/agent-session';
import { runtimeTaskService } from '../runtime/RuntimeTaskService';

const MAX_OUTPUT_LINES = 500;
const MAX_CONCURRENT = 2;

interface RustSessionResult {
  sessionId: string;
  binary: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  usageLimitDetected: boolean;
  usageLimitMessage?: string;
  error?: string;
}

export interface AgentSessionLaunch {
  sessionId: string;
  taskId: string;
  completion: Promise<AgentSession | undefined>;
}

type SessionListener = (sessions: AgentSession[]) => void;

function uid(): string {
  return `cls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function cliName(cli: AgentCLI): string {
  return cli === 'claude' ? 'Claude' : 'Codex';
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

  getSession(id: string): AgentSession | undefined {
    return this.sessions.find(s => s.id === id);
  }

  getActiveCount(): number {
    return this.sessions.filter(s => s.status === 'running').length;
  }

  private createSession(cli: AgentCLI, prompt: string): { id: string; taskId: string } {
    if (this.getActiveCount() >= MAX_CONCURRENT) {
      throw new Error(`Max concurrent CLI sessions (${MAX_CONCURRENT}) already running.`);
    }

    const task = runtimeTaskService.createTask({
      title: `${cliName(cli)} CLI Session`,
      type: 'cli',
      source: 'agent',
      risk: 'medium',
    });

    const id = uid();
    const session: AgentSession = {
      id,
      cli,
      status: 'running',
      startedAt: new Date().toISOString(),
      prompt,
      runtimeTaskId: task.id,
      outputLines: [],
    };

    this.sessions = [session, ...this.sessions].slice(0, 50);
    this.notify();

    runtimeTaskService.startTask(task.id);
    runtimeTaskService.appendLog(task.id, `Prompt: ${prompt}`);
    return { id, taskId: task.id };
  }

  private async runSessionProcess(
    cli: AgentCLI,
    prompt: string,
    id: string,
    taskId: string,
  ): Promise<AgentSession | undefined> {
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
        const joined = lines.join('\n');
        runtimeTaskService.appendLog(
          taskId,
          joined.slice(0, 200) + (joined.length > 200 ? '...' : ''),
          result.success ? 'success' : 'warn',
        );
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
        runtimeTaskService.completeTask(taskId, result, 'Completed successfully');
      } else {
        runtimeTaskService.failTask(taskId, result.error ?? result.usageLimitMessage ?? 'Session failed');
      }
    } catch (err) {
      this.update(id, {
        status: 'error',
        endedAt: new Date().toISOString(),
        errorSummary: String(err),
      });

      runtimeTaskService.appendLog(taskId, String(err), 'error');
      runtimeTaskService.failTask(taskId, String(err));
    }

    return this.getSession(id);
  }

  /** Spawn a CLI agent session with a prompt and wait for completion. */
  async spawn(cli: AgentCLI, prompt: string): Promise<string> {
    const { id, taskId } = this.createSession(cli, prompt);
    await this.runSessionProcess(cli, prompt, id, taskId);
    return id;
  }

  /** Spawn a CLI agent session and return immediately while it runs. */
  spawnBackground(cli: AgentCLI, prompt: string): AgentSessionLaunch {
    const { id, taskId } = this.createSession(cli, prompt);
    const completion = this.runSessionProcess(cli, prompt, id, taskId);
    return { sessionId: id, taskId, completion };
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

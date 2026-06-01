/**
 * AgentBridgeService - external agent bridge coordinator.
 *
 * Detection answers "is the CLI present?". A real handshake answers "can I send
 * a prompt and receive a response?". For voice/console use, background
 * handshakes return a RuntimeTask/session id immediately and update bridge
 * state when the CLI response arrives.
 */

import { claudeBridgeService } from './ClaudeBridgeService';
import { codexBridgeService } from './CodexBridgeService';
import { antigravityBridgeService } from './AntigravityBridgeService';
import { cliSessionService } from './CliSessionService';
import { capabilityRegistryService } from '../capabilities/CapabilityRegistryService';
import type { AgentBridgeState, BridgeRunResult } from '../../types/agent-bridge';
import type { AgentCLI, AgentSession } from '../../types/agent-session';

type BridgeListener = (states: AgentBridgeState[]) => void;

export interface BackgroundBridgeLaunch {
  agentId: AgentCLI;
  sessionId: string;
  taskId: string;
}

const SENTINELS: Record<AgentCLI, string> = {
  claude: 'AURA_CLAUDE_BRIDGE_OK',
  codex: 'AURA_CODEX_BRIDGE_OK',
};

function sentinelPrompt(agentId: AgentCLI): string {
  return `Reply with exactly this and nothing else: ${SENTINELS[agentId]}`;
}

class AgentBridgeServiceImpl {
  private states = new Map<string, AgentBridgeState>();
  private listeners = new Set<BridgeListener>();

  constructor() {
    this.states.set('antigravity', antigravityBridgeService.handshake());
  }

  subscribe(fn: BridgeListener): () => void {
    this.listeners.add(fn);
    fn(this.getAll());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = this.getAll();
    for (const fn of this.listeners) fn(snap);
  }

  getAll(): AgentBridgeState[] {
    const order = ['claude', 'codex', 'antigravity'];
    return order.filter(id => this.states.has(id)).map(id => ({ ...this.states.get(id)! }));
  }

  get(agentId: string): AgentBridgeState | undefined {
    const s = this.states.get(agentId);
    return s ? { ...s } : undefined;
  }

  async handshakeAll(): Promise<AgentBridgeState[]> {
    const [claude, codex] = await Promise.all([
      claudeBridgeService.handshake(),
      codexBridgeService.handshake(),
    ]);
    this.states.set('claude', claude);
    this.states.set('codex', codex);
    this.states.set('antigravity', antigravityBridgeService.handshake());
    this.notify();

    const tinyPromises: Promise<void>[] = [];
    if (claude.detected) tinyPromises.push(this.runTiny('claude', true).then(() => {}));
    if (codex.detected) tinyPromises.push(this.runTiny('codex', true).then(() => {}));
    await Promise.allSettled(tinyPromises);

    this.registerCheckEvidence();
    this.notify();
    return this.getAll();
  }

  async handshakeAllBackground(): Promise<BackgroundBridgeLaunch[]> {
    const [claude, codex] = await Promise.all([
      claudeBridgeService.handshake(),
      codexBridgeService.handshake(),
    ]);
    this.states.set('claude', claude);
    this.states.set('codex', codex);
    this.states.set('antigravity', antigravityBridgeService.handshake());
    this.notify();

    const launches: BackgroundBridgeLaunch[] = [];
    if (claude.detected) launches.push(this.startPromptBackground('claude', sentinelPrompt('claude'), SENTINELS.claude));
    if (codex.detected) launches.push(this.startPromptBackground('codex', sentinelPrompt('codex'), SENTINELS.codex));
    this.registerCheckEvidence();
    return launches;
  }

  async sendPromptBackground(agentId: AgentCLI, prompt: string): Promise<BackgroundBridgeLaunch> {
    const bridge = agentId === 'claude' ? claudeBridgeService : codexBridgeService;
    const current = this.states.get(agentId) ?? await bridge.handshake();
    this.states.set(agentId, current);
    this.notify();
    if (!current.detected) {
      throw new Error(`${agentId} CLI is not detected on PATH.`);
    }
    return this.startPromptBackground(agentId, prompt);
  }

  async runTiny(agentId: AgentCLI, approved: boolean): Promise<BridgeRunResult> {
    const bridge = agentId === 'claude' ? claudeBridgeService : codexBridgeService;
    const result = await bridge.runTiny(approved);
    const prev = this.states.get(agentId) ?? (await bridge.handshake());
    this.mergeRunResult(agentId, prev, result);

    const tinyCap = agentId === 'claude' ? 'cli.claudeRunTiny' : 'cli.codexRunTiny';
    this.reg(
      tinyCap,
      result.ok ? 'available' : result.usageLimited ? 'degraded' : 'blocked',
      result.ok ? 'Sentinel prompt returned OK.' : result.usageLimited ? 'Usage limited.' : (result.error ?? 'Tiny prompt failed.'),
    );

    this.notify();
    return result;
  }

  private startPromptBackground(agentId: AgentCLI, prompt: string, expected?: string): BackgroundBridgeLaunch {
    const launch = cliSessionService.spawnBackground(agentId, prompt);
    launch.completion.then(session => {
      const prev = this.states.get(agentId);
      if (!prev) return;
      this.mergeSessionResult(agentId, prev, session, expected);
      this.notify();
    }).catch(err => {
      const prev = this.states.get(agentId);
      if (!prev) return;
      this.states.set(agentId, {
        ...prev,
        connection: 'unknown',
        lastError: String(err),
        lastHandshakeAt: new Date().toISOString(),
      });
      this.notify();
    });

    return { agentId, sessionId: launch.sessionId, taskId: launch.taskId };
  }

  private mergeSessionResult(agentId: AgentCLI, prev: AgentBridgeState, session: AgentSession | undefined, expected?: string) {
    const output = session?.outputLines.join('\n') ?? '';
    const matchedExpected = expected ? output.includes(expected) : session?.status === 'completed';
    const usageLimited = session?.status === 'usage_limit';
    const result: BridgeRunResult = {
      ok: Boolean(matchedExpected && !usageLimited),
      output,
      matchedExpected: Boolean(matchedExpected),
      usageLimited,
      error: session?.errorSummary ?? session?.usageLimitMessage,
      durationMs: session?.endedAt && session.startedAt
        ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
        : 0,
    };
    this.mergeRunResult(agentId, prev, result);
  }

  private mergeRunResult(agentId: AgentCLI, prev: AgentBridgeState, result: BridgeRunResult) {
    const merged: AgentBridgeState = { ...prev, lastHandshakeAt: new Date().toISOString() };

    if (result.usageLimited) {
      merged.connection = 'rate-limited';
      merged.usageLimitStatus = 'limited';
      merged.lastError = 'Usage limit reached.';
    } else if (result.ok) {
      merged.authenticated = true;
      merged.connection = 'connected';
      merged.usageLimitStatus = 'ok';
      merged.lastError = undefined;
    } else if (result.error && /login|auth|sign in|not authenticated|unauthor/i.test(result.error)) {
      merged.connection = 'auth-required';
      merged.requiresLogin = true;
      merged.lastError = result.error;
    } else if (result.error) {
      merged.lastError = result.error;
    } else {
      merged.lastError = 'Prompt completed but expected response was not observed.';
    }

    this.states.set(agentId, merged);
  }

  private registerCheckEvidence() {
    const cl = this.states.get('claude');
    const cx = this.states.get('codex');
    this.reg(
      'cli.claudeCheck',
      cl?.authenticated ? 'available' : cl?.detected ? 'degraded' : 'blocked',
      cl?.authenticated ? 'Claude CLI detected and responded to sentinel.' : cl?.detected ? 'Detected; prompt response pending or failed.' : 'Claude CLI not on PATH.',
    );
    this.reg(
      'cli.codexCheck',
      cx?.authenticated ? 'available' : cx?.detected ? 'degraded' : 'blocked',
      cx?.authenticated ? 'Codex CLI detected and responded to sentinel.' : cx?.detected ? 'Detected; prompt response pending or failed.' : 'Codex CLI not on PATH.',
    );
  }

  private reg(capId: string, status: 'available' | 'degraded' | 'blocked', detail: string) {
    try { capabilityRegistryService.setStatus(capId, status, detail); } catch { /* optional */ }
  }
}

export const agentBridgeService = new AgentBridgeServiceImpl();

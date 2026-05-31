/**
 * AgentBridgeService — AURA Phase 3G (Milestone 6)
 *
 * Orchestrates the external-agent bridges (Claude, Codex, Antigravity) into a
 * single subscribable state the "Agent Bridges" panel renders. Runs handshakes,
 * runs approved tiny prompts, and feeds evidence back into the capability
 * registry (cli.claudeCheck/codexCheck/*RunTiny, antigravity.localWorkspaceAgent).
 */

import { claudeBridgeService } from './ClaudeBridgeService';
import { codexBridgeService } from './CodexBridgeService';
import { antigravityBridgeService } from './AntigravityBridgeService';
import { capabilityRegistryService } from '../capabilities/CapabilityRegistryService';
import type { AgentBridgeState, BridgeRunResult } from '../../types/agent-bridge';

type BridgeListener = (states: AgentBridgeState[]) => void;

class AgentBridgeServiceImpl {
  private states = new Map<string, AgentBridgeState>();
  private listeners = new Set<BridgeListener>();

  constructor() {
    // Seed with planned/unknown so the panel renders before first handshake.
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

  /** Run detection handshakes for all bridges, then verify with a tiny prompt. */
  async handshakeAll(): Promise<AgentBridgeState[]> {
    const [claude, codex] = await Promise.all([
      claudeBridgeService.handshake(),
      codexBridgeService.handshake(),
    ]);
    this.states.set('claude', claude);
    this.states.set('codex', codex);
    this.states.set('antigravity', antigravityBridgeService.handshake());
    this.notify();

    // Immediately run the tiny sentinel prompt for any detected CLI.
    // This is the real handshake — detection alone only proves the binary exists;
    // a prompt response proves it can receive and answer instructions.
    // approved=true because the user triggered handshakeAll explicitly.
    const tinyPromises: Promise<void>[] = [];
    if (claude.detected) {
      tinyPromises.push(this.runTiny('claude', true).then(() => { /* state updated in runTiny */ }));
    }
    if (codex.detected) {
      tinyPromises.push(this.runTiny('codex', true).then(() => { /* state updated in runTiny */ }));
    }
    // Run in parallel; errors are handled inside runTiny
    await Promise.allSettled(tinyPromises);

    // Capability evidence (post-tiny so values reflect actual response)
    const cl = this.states.get('claude');
    const cx = this.states.get('codex');
    this.reg('cli.claudeCheck',
      cl?.authenticated ? 'available' : cl?.detected ? 'degraded' : 'blocked',
      cl?.authenticated ? 'Claude CLI detected and responded to sentinel.' : cl?.detected ? 'Detected but sentinel failed.' : 'Claude CLI not on PATH.');
    this.reg('cli.codexCheck',
      cx?.authenticated ? 'available' : cx?.detected ? 'degraded' : 'blocked',
      cx?.authenticated ? 'Codex CLI detected and responded to sentinel.' : cx?.detected ? 'Detected but sentinel failed.' : 'Codex CLI not on PATH.');

    this.notify();
    return this.getAll();
  }

  /** Run the approved sentinel prompt for one agent and merge the result. */
  async runTiny(agentId: 'claude' | 'codex', approved: boolean): Promise<BridgeRunResult> {
    const bridge = agentId === 'claude' ? claudeBridgeService : codexBridgeService;
    const result = await bridge.runTiny(approved);
    const prev = this.states.get(agentId) ?? (await bridge.handshake());
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
    }
    this.states.set(agentId, merged);

    const tinyCap = agentId === 'claude' ? 'cli.claudeRunTiny' : 'cli.codexRunTiny';
    this.reg(tinyCap,
      result.ok ? 'available' : result.usageLimited ? 'degraded' : 'blocked',
      result.ok ? 'Sentinel prompt returned OK.' : result.usageLimited ? 'Usage limited.' : (result.error ?? 'Tiny prompt failed.'));

    this.notify();
    return result;
  }

  private reg(capId: string, status: 'available' | 'degraded' | 'blocked', detail: string) {
    try { capabilityRegistryService.setStatus(capId, status, detail); } catch { /* optional */ }
  }
}

export const agentBridgeService = new AgentBridgeServiceImpl();

/**
 * ClaudeBridgeService — AURA Phase 3G (Milestone 6)
 *
 * Handshake + tiny-prompt bridge for the Claude Code CLI. Wraps the existing
 * CliDiscoveryService (detection) and CliSessionService (spawn). It does NOT
 * pass repo source or secrets — only the sentinel prompt.
 */

import { cliDiscoveryService } from './CliDiscoveryService';
import { cliSessionService } from './CliSessionService';
import type { AgentBridgeState, BridgeMode, BridgeRunResult } from '../../types/agent-bridge';

const EXPECTED = 'AURA_CLAUDE_BRIDGE_OK';
const TINY_PROMPT = `Reply with exactly this and nothing else: ${EXPECTED}`;

function nowIso(): string { return new Date().toISOString(); }

class ClaudeBridgeServiceImpl {
  /** Detect + summarise. Does not run a prompt. */
  async handshake(): Promise<AgentBridgeState> {
    const d = await cliDiscoveryService.discover('claude', true);
    const modes: BridgeMode[] = ['check'];
    if (d.supportsPrintFlag) modes.push('print');
    if (d.supportsNonInteractive) modes.push('background');

    return {
      agentId: 'claude',
      provider: 'anthropic',
      binary: 'claude',
      detected: d.available,
      authenticated: false, // unknown until a tiny prompt succeeds
      versionSummary: d.available ? (d.helpSummary.slice(0, 160) || 'Claude CLI detected') : '',
      supportedModes: modes,
      lastHandshakeAt: nowIso(),
      usageLimitStatus: 'unknown',
      requiresLogin: false,
      connection: d.available ? 'connected' : 'missing',
      notes: d.available ? `Detected at ${d.path ?? 'PATH'}.` : 'Install Claude Code CLI and ensure it is on PATH.',
    };
  }

  /**
   * Run the sentinel prompt (only when approved). Updates auth/usage state.
   * Returns a parsed result; the caller merges it into the bridge state.
   */
  async runTiny(approved: boolean): Promise<BridgeRunResult> {
    const start = Date.now();
    if (!approved) {
      return { ok: false, output: '', matchedExpected: false, usageLimited: false,
        error: 'Tiny Claude prompt requires explicit approval.', durationMs: 0 };
    }
    try {
      const sessionId = await cliSessionService.spawn('claude', TINY_PROMPT);
      const session = cliSessionService.getSession(sessionId);
      const output = session?.outputLines.join('\n') ?? '';
      const usageLimited = session?.status === 'usage_limit';
      const matchedExpected = output.includes(EXPECTED);
      return {
        ok: matchedExpected && !usageLimited,
        output,
        matchedExpected,
        usageLimited,
        error: session?.errorSummary,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return { ok: false, output: '', matchedExpected: false, usageLimited: false,
        error: String(err), durationMs: Date.now() - start };
    }
  }
}

export const claudeBridgeService = new ClaudeBridgeServiceImpl();

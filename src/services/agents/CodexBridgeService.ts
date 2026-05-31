/**
 * CodexBridgeService — AURA Phase 3G (Milestone 6)
 *
 * Handshake + tiny-prompt bridge for the OpenAI Codex CLI. Wraps the existing
 * CliDiscoveryService + CliSessionService. The Windows `.cmd` spawn fix and
 * `codex exec` non-interactive mode are handled in the Rust layer (Phase 3H).
 */

import { cliDiscoveryService } from './CliDiscoveryService';
import { cliSessionService } from './CliSessionService';
import type { AgentBridgeState, BridgeMode, BridgeRunResult } from '../../types/agent-bridge';

const EXPECTED = 'AURA_CODEX_BRIDGE_OK';
const TINY_PROMPT = `Reply with exactly this and nothing else: ${EXPECTED}`;

function nowIso(): string { return new Date().toISOString(); }

class CodexBridgeServiceImpl {
  async handshake(): Promise<AgentBridgeState> {
    const d = await cliDiscoveryService.discover('codex', true);
    const modes: BridgeMode[] = ['check'];
    // Codex uses an `exec` subcommand for non-interactive use.
    if (d.supportsNonInteractive || d.helpSummary.toLowerCase().includes('exec')) modes.push('exec');
    if (d.supportsPrintFlag) modes.push('print');

    return {
      agentId: 'codex',
      provider: 'openai',
      binary: 'codex',
      detected: d.available,
      authenticated: false,
      versionSummary: d.available ? (d.helpSummary.slice(0, 160) || 'Codex CLI detected') : '',
      supportedModes: modes,
      lastHandshakeAt: nowIso(),
      usageLimitStatus: 'unknown',
      requiresLogin: false,
      connection: d.available ? 'connected' : 'missing',
      notes: d.available ? `Detected at ${d.path ?? 'PATH'}. Uses 'codex exec' for non-interactive runs.` : 'Install the Codex CLI and ensure it is on PATH.',
    };
  }

  async runTiny(approved: boolean): Promise<BridgeRunResult> {
    const start = Date.now();
    if (!approved) {
      return { ok: false, output: '', matchedExpected: false, usageLimited: false,
        error: 'Tiny Codex prompt requires explicit approval.', durationMs: 0 };
    }
    try {
      const sessionId = await cliSessionService.spawn('codex', TINY_PROMPT);
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

export const codexBridgeService = new CodexBridgeServiceImpl();

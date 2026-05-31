/**
 * agent-bridge.ts — AURA Phase 3G (Milestone 6)
 *
 * A typed handshake/protocol layer for external CLI agents (Claude, Codex) and
 * the Antigravity local workspace agent. The bridge abstraction is what the
 * "Agent Bridges" panel renders and what AURA uses to reason about which
 * external agents it can talk to.
 */

export type BridgeProvider = 'anthropic' | 'openai' | 'antigravity';

export type BridgeMode =
  | 'check'       // detect presence + help
  | 'print'       // one-shot --print / non-interactive output
  | 'exec'        // exec subcommand (Codex)
  | 'background'  // long-running session
  | 'fileEdit'    // can edit files (not enabled here)
  | 'dryRun';     // plan-only

/** Connection state shown in the Agent Bridges panel. */
export type BridgeConnection =
  | 'connected'      // binary detected + (assumed) usable
  | 'auth-required'  // detected but a tiny prompt failed auth
  | 'missing'        // binary not on PATH
  | 'rate-limited'   // usage limit hit
  | 'planned'        // no CLI; future integration
  | 'unknown';       // not yet handshaken

export interface AgentBridgeState {
  agentId: 'claude' | 'codex' | 'antigravity';
  provider: BridgeProvider;
  binary: string;
  detected: boolean;
  authenticated: boolean;
  versionSummary: string;
  supportedModes: BridgeMode[];
  lastHandshakeAt?: string;
  lastError?: string;
  usageLimitStatus: 'ok' | 'limited' | 'unknown';
  requiresLogin: boolean;
  connection: BridgeConnection;
  notes?: string;
}

export interface BridgeRunResult {
  ok: boolean;
  output: string;
  matchedExpected: boolean;
  usageLimited: boolean;
  error?: string;
  durationMs: number;
}

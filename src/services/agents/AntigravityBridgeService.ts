/**
 * AntigravityBridgeService — AURA Phase 3G (Milestone 6)
 *
 * Antigravity has no public local CLI to detect, and AURA must NOT hunt for
 * internal credentials or extract tokens. So this bridge is intentionally a
 * static "planned / local-workspace-agent" descriptor that documents the
 * realistic future integration path (handoff files, workspace reports, git
 * branch coordination, manual external sessions) rather than an API provider.
 */

import type { AgentBridgeState } from '../../types/agent-bridge';

class AntigravityBridgeServiceImpl {
  handshake(): AgentBridgeState {
    return {
      agentId: 'antigravity',
      provider: 'antigravity',
      binary: '(none)',
      detected: false,
      authenticated: false,
      versionSummary: 'No local CLI. Integration is via workspace coordination, not an API.',
      supportedModes: ['dryRun'],
      lastHandshakeAt: new Date().toISOString(),
      usageLimitStatus: 'unknown',
      requiresLogin: false,
      connection: 'planned',
      notes: 'Planned local-workspace-agent integration: handoff files, workspace reports, ' +
        'git branch coordination, or a manual external agent session. No token extraction.',
    };
  }
}

export const antigravityBridgeService = new AntigravityBridgeServiceImpl();

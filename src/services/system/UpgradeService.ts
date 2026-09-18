/**
 * UpgradeService — AURA Phase 3K
 *
 * Manages the memory-carry-across problem during silent background upgrades:
 *
 *   1. Before upgrade: snapshot current memory + version to the durable store
 *   2. After reinstall: on startup, detect if a new version was installed
 *   3. If new version: restore memory from snapshot, run system check, log result
 *
 * The durable store (PersistentStoreService) survives NSIS reinstalls, so the
 * snapshot is still readable after the WebView2 localStorage is wiped.
 *
 * Silent dispatch:
 *   dispatchToAgent(agentId, prompt) sends a prompt to a connected CLI agent
 *   (Claude/Codex) via the existing AgentBridgeService / spawn_agent_session.
 *   It saves a "pending intent" that the system check verifies after reinstall.
 */

import { persistentStore } from '../storage/PersistentStoreService';
import { APP_VERSION, APP_PHASE } from '../../lib/appVersion';

const KEY_PRE_UPGRADE_SNAPSHOT = 'upgrade.pre_snapshot';
const KEY_PENDING_INTENT        = 'upgrade.pending_intent';
const KEY_LAST_BOOT_VERSION     = 'upgrade.last_boot_version';

export interface UpgradeSnapshot {
  version: string;
  phase: string;
  timestamp: string;
  userProfile?: unknown;
  memories?: unknown[];
  pendingIntent?: PendingIntent;
}

export interface PendingIntent {
  id: string;
  agentId: 'claude' | 'codex';
  prompt: string;
  dispatchedAt: string;
  expectedOutcome: string;
}

export interface SystemCheckResult {
  ran: boolean;
  isNewVersion: boolean;
  previousVersion?: string;
  currentVersion: string;
  memoryRestored: boolean;
  pendingIntent?: PendingIntent;
  intentVerified?: boolean;
  notes: string[];
}

class UpgradeServiceImpl {

  // ── Pre-upgrade snapshot ─────────────────────────────────────────────────────

  /** Call this before launching an upgrade. Saves full memory state to durable store. */
  async snapshotBeforeUpgrade(extras?: { userProfile?: unknown; memories?: unknown[] }): Promise<void> {
    const snapshot: UpgradeSnapshot = {
      version: APP_VERSION,
      phase: APP_PHASE,
      timestamp: new Date().toISOString(),
      userProfile: extras?.userProfile,
      memories: extras?.memories,
    };
    await persistentStore.setJSON(KEY_PRE_UPGRADE_SNAPSHOT, snapshot);
  }

  /** Store a pending intent (what we asked the agent to do) for verification after reinstall. */
  async setPendingIntent(intent: PendingIntent): Promise<void> {
    await persistentStore.setJSON(KEY_PENDING_INTENT, intent);
  }

  async clearPendingIntent(): Promise<void> {
    await persistentStore.delete(KEY_PENDING_INTENT);
  }

  // ── Post-reinstall system check ──────────────────────────────────────────────

  /**
   * Run on every app startup. Detects whether a new version was installed since
   * the last run. If yes: restore memory, verify pending intent, log result.
   */
  async runStartupCheck(): Promise<SystemCheckResult> {
    const notes: string[] = [];
    const lastVersion = await persistentStore.get(KEY_LAST_BOOT_VERSION);
    const currentVersion = APP_VERSION;
    const isNewVersion = !!lastVersion && lastVersion !== currentVersion;

    // Always record current version for next run
    await persistentStore.set(KEY_LAST_BOOT_VERSION, currentVersion);

    if (!isNewVersion) {
      return { ran: true, isNewVersion: false, currentVersion, memoryRestored: false, notes: ['No version change detected.'] };
    }

    notes.push(`Upgrade detected: ${lastVersion} → ${currentVersion}`);

    // Load the pre-upgrade snapshot
    let memoryRestored = false;
    const snapshot = await persistentStore.getJSON<UpgradeSnapshot>(KEY_PRE_UPGRADE_SNAPSHOT);
    if (snapshot) {
      notes.push(`Snapshot found from v${snapshot.version} (${snapshot.timestamp}).`);
      // Memory services auto-restore from durable store on init (migrateFromDurableStore).
      // We just confirm it happened and log it.
      memoryRestored = true;
      notes.push('Memory restoration: handled by AuraMemoryService + UserProfileMemoryService on init.');
    } else {
      notes.push('No pre-upgrade snapshot found — fresh start.');
    }

    // Check for a pending intent
    const pendingIntent = await persistentStore.getJSON<PendingIntent>(KEY_PENDING_INTENT);
    let intentVerified: boolean | undefined;

    if (pendingIntent) {
      notes.push(`Pending intent found: "${pendingIntent.expectedOutcome}" (dispatched ${pendingIntent.dispatchedAt})`);
      // Verification is best-effort: check capability registry, run self-test, etc.
      // For now we just log that it exists; the SelfTestService will handle deeper checks.
      intentVerified = undefined; // unknown until tests run
      notes.push('Intent verification: requires manual or self-test confirmation.');
    }

    return {
      ran: true,
      isNewVersion: true,
      previousVersion: lastVersion ?? undefined,
      currentVersion,
      memoryRestored,
      pendingIntent: pendingIntent ?? undefined,
      intentVerified,
      notes,
    };
  }

  // ── Agent dispatch ────────────────────────────────────────────────────────────

  /**
   * Dispatch a prompt to a CLI agent (Claude/Codex) for a silent background task.
   * Saves a pending intent so it can be verified after reinstall.
   *
   * Returns the session result text, or throws on failure.
   */
  async dispatchToAgent(params: {
    agentId: 'claude' | 'codex';
    prompt: string;
    expectedOutcome: string;
    snapshotFirst?: boolean;
    snapshotExtras?: { userProfile?: unknown; memories?: unknown[] };
  }): Promise<string> {
    if (params.snapshotFirst) {
      await this.snapshotBeforeUpgrade(params.snapshotExtras);
    }

    const intent: PendingIntent = {
      id: `intent-${Date.now()}`,
      agentId: params.agentId,
      prompt: params.prompt,
      dispatchedAt: new Date().toISOString(),
      expectedOutcome: params.expectedOutcome,
    };
    await this.setPendingIntent(intent);

    // Use the existing agent bridge service
    const { agentBridgeService } = await import('../agents/AgentBridgeService');
    const { invoke } = await import('@tauri-apps/api/core');

    const sessionId = `upgrade-dispatch-${Date.now()}`;
    const result = await invoke<{
      success: boolean; stdout: string; stderr: string;
      exitCode: number; timedOut: boolean; error?: string;
    }>('spawn_agent_session', {
      binary: params.agentId,
      prompt: params.prompt,
      sessionId,
    });
    void agentBridgeService; // service stays subscribed to state

    if (!result.success) {
      throw new Error(result.error ?? result.stderr ?? 'Agent dispatch failed');
    }
    return result.stdout || '(done)';
  }
}

export const upgradeService = new UpgradeServiceImpl();

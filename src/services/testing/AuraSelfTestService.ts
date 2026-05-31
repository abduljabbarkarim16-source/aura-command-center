/**
 * AuraSelfTestService — AURA Phase 3G (Milestone 8)
 *
 * Lets AURA test ITSELF without voice. Runs the core capability surface as a
 * sequence of pass/fail steps with evidence + suggested fixes, and persists the
 * last run. This is what proves the system works programmatically when
 * computer-use of the live UI isn't available.
 *
 * All steps route through the real services/tools — nothing is faked. A missing
 * external CLI is reported as 'skip' (environment), not 'fail' (AURA bug).
 */

import { invoke } from '@tauri-apps/api/core';
import { toolRegistryService } from '../tools/ToolRegistryService';
import { capabilityRegistryService } from '../capabilities/CapabilityRegistryService';
import { capabilityMemoryService } from '../memory/CapabilityMemoryService';
import { sessionThreadService } from '../session/SessionThreadService';
import { agentBridgeService } from '../agents/AgentBridgeService';
import { notificationService } from '../notifications/NotificationService';

const DOCS = 'docs/phase-3g-internal-agent-os.md';
const STORAGE_KEY = 'aura.selfTest.lastRun';

export type SelfTestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'skip';

export interface SelfTestStep {
  id: string;
  name: string;
  status: SelfTestStatus;
  detail: string;
  suggestedFix?: string;
  durationMs?: number;
}

export interface SelfTestRun {
  startedAt: string;
  finishedAt?: string;
  steps: SelfTestStep[];
  passCount: number;
  failCount: number;
  skipCount: number;
  docsPath: string;
}

interface StepDef {
  id: string;
  name: string;
  fix?: string;
  run: () => Promise<{ ok: boolean; skip?: boolean; detail: string; fix?: string }>;
}

class AuraSelfTestServiceImpl {
  private steps(includeTinyPrompts: boolean): StepDef[] {
    const defs: StepDef[] = [
      {
        id: 'workspace', name: 'Workspace path',
        fix: 'Set a valid workspace path in Settings (must contain the repo).',
        run: async () => {
          const r = await invoke<Record<string, unknown>>('get_workspace_path');
          const path = (r['workspace_path'] ?? r['workspacePath'] ?? '') as string;
          return { ok: !!path, detail: path ? `Workspace: ${path}` : 'No workspace path resolved.' };
        },
      },
      {
        id: 'git', name: 'git status tool',
        fix: 'Ensure the workspace is a git repository and git is on PATH.',
        run: async () => {
          const r = await toolRegistryService.execute('terminal.gitStatus', {}, { approved: true });
          return { ok: r.status === 'completed', detail: r.status === 'completed' ? `Ran (exit ${r.exitCode ?? 0}).` : (r.errorSummary ?? 'failed') };
        },
      },
      {
        id: 'npmLint', name: 'npm lint reachable',
        fix: 'Install Node.js and ensure npm is on PATH.',
        run: async () => {
          const r = await capabilityRegistryService.test('terminal.npmLint');
          return { ok: r.ok, detail: r.detail };
        },
      },
      {
        id: 'memory', name: 'Memory write/read round-trip',
        fix: 'Check that localStorage is available in the runtime.',
        run: async () => {
          const r = await capabilityRegistryService.test('memory.write');
          return { ok: r.ok, detail: r.detail };
        },
      },
      {
        id: 'capabilities', name: 'Capability registry',
        run: async () => {
          const all = capabilityRegistryService.getAll();
          const answer = capabilityRegistryService.can('terminal.gitStatus');
          const ok = all.length > 0 && typeof answer.reason === 'string';
          return { ok, detail: `${all.length} capabilities; can() responds.` };
        },
      },
      {
        id: 'claudeBridge', name: 'Claude bridge check',
        fix: 'Install the Claude Code CLI to enable Claude bridging.',
        run: async () => {
          await agentBridgeService.handshakeAll();
          const b = agentBridgeService.get('claude');
          if (!b) return { ok: false, detail: 'Bridge state unavailable.' };
          if (!b.detected) return { ok: true, skip: true, detail: 'Claude CLI not installed (environment).' };
          return { ok: true, detail: `Claude: ${b.connection}.` };
        },
      },
      {
        id: 'codexBridge', name: 'Codex bridge check',
        fix: 'Install the Codex CLI to enable Codex bridging.',
        run: async () => {
          const b = agentBridgeService.get('codex');
          if (!b) return { ok: false, detail: 'Bridge state unavailable.' };
          if (!b.detected) return { ok: true, skip: true, detail: 'Codex CLI not installed (environment).' };
          return { ok: true, detail: `Codex: ${b.connection}.` };
        },
      },
      {
        id: 'dispatch', name: 'Tool dispatch dry-run',
        run: async () => {
          const r = await capabilityRegistryService.test('agent.toolDispatch');
          return { ok: r.ok, detail: r.detail };
        },
      },
      {
        id: 'notify', name: 'Notification/log write',
        run: async () => {
          notificationService.add({ type: 'info', title: 'Self-test', message: 'Notification write OK.', ttl: 3000 });
          return { ok: true, detail: 'Notification written.' };
        },
      },
      {
        id: 'thread', name: 'Session/thread write',
        run: async () => {
          const before = sessionThreadService.ensureActive().messageCount;
          sessionThreadService.recordTurn('self-test', 'self-test ok');
          const after = sessionThreadService.getActive()?.messageCount ?? before;
          return { ok: after > before, detail: `Thread messages ${before} -> ${after}.` };
        },
      },
    ];

    if (includeTinyPrompts) {
      defs.push({
        id: 'claudeTiny', name: 'Claude tiny prompt (approved)',
        fix: 'Authenticate the Claude CLI (claude login).',
        run: async () => {
          const b = agentBridgeService.get('claude');
          if (!b?.detected) return { ok: true, skip: true, detail: 'Claude CLI not installed.' };
          const r = await agentBridgeService.runTiny('claude', true);
          if (r.usageLimited) return { ok: false, detail: 'Usage limit reached.' };
          return { ok: r.ok, detail: r.ok ? 'Sentinel matched.' : (r.error ?? 'No sentinel match.') };
        },
      });
      defs.push({
        id: 'codexTiny', name: 'Codex tiny prompt (approved)',
        fix: 'Authenticate the Codex CLI.',
        run: async () => {
          const b = agentBridgeService.get('codex');
          if (!b?.detected) return { ok: true, skip: true, detail: 'Codex CLI not installed.' };
          const r = await agentBridgeService.runTiny('codex', true);
          if (r.usageLimited) return { ok: false, detail: 'Usage limit reached.' };
          return { ok: r.ok, detail: r.ok ? 'Sentinel matched.' : (r.error ?? 'No sentinel match.') };
        },
      });
    }
    return defs;
  }

  /** Run the self-test. onProgress fires after each step. */
  async run(opts: { includeTinyPrompts?: boolean; onProgress?: (run: SelfTestRun) => void } = {}): Promise<SelfTestRun> {
    const defs = this.steps(!!opts.includeTinyPrompts);
    const run: SelfTestRun = {
      startedAt: new Date().toISOString(),
      steps: defs.map(d => ({ id: d.id, name: d.name, status: 'pending', detail: '' })),
      passCount: 0, failCount: 0, skipCount: 0, docsPath: DOCS,
    };
    opts.onProgress?.(run);

    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      run.steps[i] = { ...run.steps[i], status: 'running' };
      opts.onProgress?.({ ...run, steps: [...run.steps] });
      const start = Date.now();
      try {
        const r = await def.run();
        const status: SelfTestStatus = r.skip ? 'skip' : r.ok ? 'pass' : 'fail';
        run.steps[i] = {
          id: def.id, name: def.name, status, detail: r.detail,
          suggestedFix: !r.ok && !r.skip ? (r.fix ?? def.fix) : undefined,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        run.steps[i] = {
          id: def.id, name: def.name, status: 'fail',
          detail: String(err), suggestedFix: def.fix, durationMs: Date.now() - start,
        };
      }
      opts.onProgress?.({ ...run, steps: [...run.steps] });
    }

    run.passCount = run.steps.filter(s => s.status === 'pass').length;
    run.failCount = run.steps.filter(s => s.status === 'fail').length;
    run.skipCount = run.steps.filter(s => s.status === 'skip').length;
    run.finishedAt = new Date().toISOString();

    // Persist last run + refresh capability snapshot memory.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(run)); } catch { /* full */ }
    try { capabilityMemoryService.snapshot(); } catch { /* optional */ }

    notificationService.add({
      type: run.failCount === 0 ? 'success' : 'warning',
      title: 'AURA self-test complete',
      message: `${run.passCount} pass · ${run.failCount} fail · ${run.skipCount} skip`,
      ttl: 6000,
    });

    return run;
  }

  getLastRun(): SelfTestRun | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SelfTestRun) : null;
    } catch { return null; }
  }

  /** Plain-text summary AURA can speak/print. */
  summary(): string {
    const r = this.getLastRun();
    if (!r) return 'I have not run a self-test yet.';
    const when = new Date(r.startedAt).toLocaleString();
    const fails = r.steps.filter(s => s.status === 'fail').map(s => s.name);
    return `Last self-test (${when}): ${r.passCount} pass, ${r.failCount} fail, ${r.skipCount} skip.` +
      (fails.length ? ` Failing: ${fails.join(', ')}.` : ' All non-skipped checks passed.');
  }
}

export const auraSelfTestService = new AuraSelfTestServiceImpl();

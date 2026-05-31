/**
 * CapabilityRegistryService — AURA Phase 3G (Internal Agent Operating System)
 *
 * The single source of truth for "what can AURA do, and how do we know?".
 *
 * It does NOT assert capabilities blindly. `test(id)` exercises the real
 * underlying tool/service (a git probe, a CLI discovery call, a memory
 * round-trip) and records evidence. `can(id)` / `whyNot(id)` answer from that
 * recorded state so AURA can speak an honest answer instead of guessing.
 *
 * Security:
 *  - All execution still routes through the existing allowlisted layers
 *    (ToolRegistryService → Rust run_allowed_command, CliDiscoveryService).
 *  - Tests never run destructive or medium/high-risk actions automatically.
 *  - Secret *names* are tracked; secret *values* never are.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  Capability,
  CapabilityAnswer,
  CapabilityStatus,
  CapabilityTestResult,
  CapabilityUpgrade,
} from '../../types/capabilities';
import { toolRegistryService } from '../tools/ToolRegistryService';
import { auraToolDispatchService } from '../tools/AuraToolDispatchService';
import { cliDiscoveryService } from '../agents/CliDiscoveryService';
import { auraMemoryService } from '../memory/AuraMemoryService';
import { auraPersonalityService } from '../personality/AuraPersonalityService';

const DOCS = 'docs/phase-3g-internal-agent-os.md';

// ─── Catalog ────────────────────────────────────────────────────────────────
//
// `status` here is the *initial / observational* status. test() overwrites it
// with evidence-backed status where a real test is possible.

function cap(c: Capability): Capability { return c; }

export const CAPABILITY_CATALOG: Capability[] = [
  // ── Voice ───────────────────────────────────────────────────────────────
  cap({
    id: 'voice.shortSpeech', name: 'Short speech', category: 'voice',
    description: 'Transcribe and respond to a short spoken request.',
    status: 'available', testable: false, riskLevel: 'low',
    requiredTools: [], requiredSecrets: ['openai'], requiredApprovals: [],
    evidence: { sourceFiles: ['src/components/operator/AuraVoiceCore.tsx'], docsPath: DOCS,
      lastTestResult: 'Shipped & in use; requires a microphone to verify live.' },
  }),
  cap({
    id: 'voice.longSpeech', name: 'Long speech (20–45s)', category: 'voice',
    description: 'Segmented capture so long thoughts do not time out.',
    status: 'available', testable: false, riskLevel: 'low',
    requiredTools: [], requiredSecrets: ['openai'], requiredApprovals: [],
    evidence: { sourceFiles: ['src/hooks/useSegmentedVoiceSession.ts'], docsPath: DOCS,
      lastTestResult: 'Segmented session shipped (Phase 3E QA3).' },
  }),
  cap({
    id: 'voice.conversationMode', name: 'Hands-free conversation', category: 'voice',
    description: 'Listen → respond → listen loop with barge-in and dormancy.',
    status: 'available', testable: false, riskLevel: 'low',
    requiredTools: [], requiredSecrets: ['openai'], requiredApprovals: [],
    evidence: { sourceFiles: ['src/hooks/useConversationLoop.ts'], docsPath: DOCS },
  }),
  cap({
    id: 'voice.fastMode', name: 'Fast voice mode', category: 'voice',
    description: 'One-sentence reply first, then full answer.',
    status: 'degraded', testable: false, riskLevel: 'low',
    requiredTools: [], requiredSecrets: ['openai'], requiredApprovals: [],
    upgradePlan: 'Request-based pipeline has a ~700ms floor. True low latency needs the OpenAI Realtime API (openai.realtime.planned).',
    evidence: { sourceFiles: ['src/services/voice/OpenAIVoiceSessionService.ts'], docsPath: DOCS,
      lastTestResult: 'Works, but ~700ms perceived floor (known limit).' },
  }),
  cap({
    id: 'voice.wakePhrase', name: 'Wake phrase', category: 'voice',
    description: 'Activate by saying "Hey AURA".',
    status: 'degraded', testable: false, riskLevel: 'low',
    requiredTools: [], requiredSecrets: [], requiredApprovals: [],
    upgradePlan: 'Web SpeechRecognition is unreliable/unavailable inside the Tauri WebView2 runtime. Needs a native always-listening sidecar.',
    evidence: { sourceFiles: ['src/hooks/useWakePhrase.ts'], docsPath: DOCS,
      lastTestResult: 'Prototype; WebView2 SpeechRecognition limitation.' },
  }),

  // ── Terminal ────────────────────────────────────────────────────────────
  cap({
    id: 'terminal.gitStatus', name: 'git status', category: 'terminal',
    description: 'Read the working-tree status of the active workspace.',
    status: 'unknown', testable: true, riskLevel: 'low',
    requiredTools: ['terminal.gitStatus'], requiredSecrets: [], requiredApprovals: [],
    evidence: { sourceFiles: ['src-tauri/src/commands.rs'], docsPath: DOCS },
  }),
  cap({
    id: 'terminal.npmLint', name: 'npm lint (typecheck)', category: 'terminal',
    description: 'Run the TypeScript type-check in the active workspace.',
    status: 'unknown', testable: true, riskLevel: 'low',
    requiredTools: ['terminal.npmLint'], requiredSecrets: [], requiredApprovals: [],
    evidence: { docsPath: DOCS },
  }),
  cap({
    id: 'terminal.npmBuild', name: 'npm build', category: 'terminal',
    description: 'Run the Vite production build (approval-gated).',
    status: 'unknown', testable: true, riskLevel: 'medium',
    requiredTools: ['terminal.npmBuild'], requiredSecrets: [], requiredApprovals: ['build'],
    evidence: { docsPath: DOCS },
  }),
  cap({
    id: 'terminal.cargoTest', name: 'cargo test', category: 'terminal',
    description: 'Run the Rust unit tests.',
    status: 'unknown', testable: true, riskLevel: 'low',
    requiredTools: ['terminal.cargoTest'], requiredSecrets: [], requiredApprovals: [],
    evidence: { docsPath: DOCS },
  }),

  // ── CLI agents ────────────────────────────────────────────────────────────
  cap({
    id: 'cli.claudeCheck', name: 'Claude CLI check', category: 'cli',
    description: 'Detect the Claude Code CLI and summarise its help.',
    status: 'unknown', testable: true, riskLevel: 'low',
    requiredTools: ['cli.claudeCheck'], requiredSecrets: [], requiredApprovals: [],
    evidence: { sourceFiles: ['src/services/agents/CliDiscoveryService.ts'], docsPath: DOCS },
  }),
  cap({
    id: 'cli.claudeRunTiny', name: 'Claude CLI smoke test', category: 'cli',
    description: 'Run a minimal prompt to confirm Claude CLI is authenticated.',
    status: 'unknown', testable: false, riskLevel: 'medium',
    requiredTools: ['cli.claudeRunTiny'], requiredSecrets: [], requiredApprovals: ['cli-run'],
    upgradePlan: 'Requires the Claude CLI installed + authenticated, and explicit approval to run.',
    evidence: { docsPath: DOCS },
  }),
  cap({
    id: 'cli.codexCheck', name: 'Codex CLI check', category: 'cli',
    description: 'Detect the OpenAI Codex CLI and summarise its help.',
    status: 'unknown', testable: true, riskLevel: 'low',
    requiredTools: ['cli.codexCheck'], requiredSecrets: [], requiredApprovals: [],
    evidence: { sourceFiles: ['src/services/agents/CliDiscoveryService.ts'], docsPath: DOCS },
  }),
  cap({
    id: 'cli.codexRunTiny', name: 'Codex CLI smoke test', category: 'cli',
    description: 'Run a minimal prompt to confirm Codex CLI is authenticated.',
    status: 'unknown', testable: false, riskLevel: 'medium',
    requiredTools: ['cli.codexRunTiny'], requiredSecrets: [], requiredApprovals: ['cli-run'],
    upgradePlan: 'Requires the Codex CLI installed + authenticated, and explicit approval to run.',
    evidence: { docsPath: DOCS },
  }),

  // ── Agent / dispatch ───────────────────────────────────────────────────────
  cap({
    id: 'agent.toolDispatch', name: 'Tool dispatch (function calling)', category: 'agent',
    description: 'Choose and call a tool from a natural-language request.',
    status: 'unknown', testable: true, riskLevel: 'low',
    requiredTools: [], requiredSecrets: ['openai'], requiredApprovals: [],
    evidence: { sourceFiles: ['src/services/tools/AuraToolDispatchService.ts'], docsPath: DOCS },
  }),
  cap({
    id: 'agent.backgroundTasks', name: 'Background tasks', category: 'agent',
    description: 'Run and track long-running CLI sessions in the background.',
    status: 'available', testable: false, riskLevel: 'low',
    requiredTools: [], requiredSecrets: [], requiredApprovals: [],
    evidence: { sourceFiles: ['src/components/operator/BackgroundTasksPanel.tsx', 'src/services/agents/CliSessionService.ts'], docsPath: DOCS },
  }),

  // ── Memory ─────────────────────────────────────────────────────────────────
  cap({
    id: 'memory.read', name: 'Read memory', category: 'memory',
    description: 'Recall stored facts and inject them into context.',
    status: 'unknown', testable: true, riskLevel: 'none',
    requiredTools: [], requiredSecrets: [], requiredApprovals: [],
    evidence: { sourceFiles: ['src/services/memory/AuraMemoryService.ts'], docsPath: DOCS },
  }),
  cap({
    id: 'memory.write', name: 'Write memory', category: 'memory',
    description: 'Save a fact that persists across restarts.',
    status: 'unknown', testable: true, riskLevel: 'none',
    requiredTools: [], requiredSecrets: [], requiredApprovals: [],
    evidence: { sourceFiles: ['src/services/memory/AuraMemoryService.ts'], docsPath: DOCS },
  }),
  cap({
    id: 'memory.userProfile', name: 'User profile', category: 'memory',
    description: 'Remember the user (name, preferred name, preferences) across restarts.',
    status: 'unknown', testable: true, riskLevel: 'none',
    requiredTools: [], requiredSecrets: [], requiredApprovals: [],
    evidence: { sourceFiles: ['src/services/memory/UserProfileMemoryService.ts'], docsPath: DOCS },
  }),
  cap({
    id: 'memory.sessionThreads', name: 'Session threads', category: 'memory',
    description: 'Track a conversation thread with id, summary and continuity.',
    status: 'unknown', testable: true, riskLevel: 'none',
    requiredTools: [], requiredSecrets: [], requiredApprovals: [],
    evidence: { sourceFiles: ['src/services/session/SessionThreadService.ts'], docsPath: DOCS },
  }),
  cap({
    id: 'memory.compaction', name: 'Thread compaction', category: 'memory',
    description: 'Summarise/compact a long thread to stay within context.',
    status: 'degraded', testable: true, riskLevel: 'none',
    requiredTools: [], requiredSecrets: [], requiredApprovals: [],
    upgradePlan: 'Compaction summary is heuristic/local; LLM-assisted compaction is a follow-up.',
    evidence: { sourceFiles: ['src/services/session/SessionThreadService.ts', 'src/services/context/ContextCompressionService.ts'], docsPath: DOCS },
  }),

  // ── Connectors / workspace / realtime ───────────────────────────────────────
  cap({
    id: 'make.webhook', name: 'Make.com webhook', category: 'connector',
    description: 'Trigger a Make.com automation via webhook.',
    status: 'unknown', testable: false, riskLevel: 'medium',
    requiredTools: [], requiredSecrets: ['make.webhookUrl'], requiredApprovals: ['external-call'],
    upgradePlan: 'Needs a configured webhook URL (Rust/AppData). Not auto-tested — a test would send a real request.',
    evidence: { sourceFiles: ['src/services/connectors/MakeConnectorService.ts'], docsPath: DOCS },
  }),
  cap({
    id: 'browserWorkspace.planned', name: 'Browser workspace', category: 'workspace',
    description: 'Drive a browser/preview workspace as an agent surface.',
    status: 'planned', testable: false, riskLevel: 'medium',
    requiredTools: [], requiredSecrets: [], requiredApprovals: [],
    upgradePlan: 'Build a browser/preview sidecar (Phase 4). Not started.',
    evidence: { docsPath: DOCS },
  }),
  cap({
    id: 'openai.realtime.planned', name: 'OpenAI Realtime voice', category: 'realtime',
    description: 'Low-latency duplex voice via the Realtime API.',
    status: 'planned', testable: false, riskLevel: 'low',
    requiredTools: [], requiredSecrets: ['openai'], requiredApprovals: [],
    upgradePlan: 'Implement a WebRTC/Realtime session (planned). Would resolve voice.fastMode latency.',
    evidence: { sourceFiles: ['docs/openai-realtime-implementation-plan.md'], docsPath: DOCS },
  }),
  cap({
    id: 'antigravity.localWorkspaceAgent', name: 'Antigravity workspace agent', category: 'agent',
    description: 'Coordinate with the Antigravity local workspace agent.',
    status: 'planned', testable: true, riskLevel: 'low',
    requiredTools: [], requiredSecrets: [], requiredApprovals: [],
    upgradePlan: 'No public local CLI detected. Integrate via handoff files / workspace reports / git-branch coordination rather than a token/API.',
    notes: 'Integration mode: local workspace agent, not an API provider. Do not hunt for internal credentials.',
    evidence: { docsPath: DOCS },
  }),
];

// ─── Service ────────────────────────────────────────────────────────────────

type CapListener = (caps: Capability[]) => void;

class CapabilityRegistryServiceImpl {
  private caps: Capability[] = CAPABILITY_CATALOG.map(c => ({ ...c, evidence: { ...c.evidence } }));
  private listeners = new Set<CapListener>();

  subscribe(fn: CapListener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  private snapshot(): Capability[] {
    return this.caps.map(c => ({ ...c, evidence: { ...c.evidence } }));
  }

  private notify() {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }

  getAll(): Capability[] { return this.snapshot(); }

  get(id: string): Capability | undefined {
    const c = this.caps.find(x => x.id === id);
    return c ? { ...c, evidence: { ...c.evidence } } : undefined;
  }

  getByCategory(): Record<string, Capability[]> {
    const out: Record<string, Capability[]> = {};
    for (const c of this.snapshot()) (out[c.category] ??= []).push(c);
    return out;
  }

  summary(): Record<CapabilityStatus, number> {
    const s: Record<CapabilityStatus, number> = { available: 0, degraded: 0, planned: 0, blocked: 0, unknown: 0 };
    for (const c of this.caps) s[c.status]++;
    return s;
  }

  private patch(id: string, status: CapabilityStatus, evidence: Partial<Capability['evidence']>) {
    this.caps = this.caps.map(c => c.id === id
      ? { ...c, status, evidence: { ...c.evidence, ...evidence, lastCheckedAt: new Date().toISOString() } }
      : c);
    this.notify();
  }

  // ── can / whyNot ────────────────────────────────────────────────────────

  can(id: string): CapabilityAnswer {
    const c = this.caps.find(x => x.id === id);
    if (!c) return { id, can: false, status: 'unknown', reason: `I don't have a capability called "${id}".` };
    const can = c.status === 'available' || c.status === 'degraded';
    let reason: string;
    switch (c.status) {
      case 'available': reason = `Yes — ${c.name} is available.`; break;
      case 'degraded':  reason = `Mostly — ${c.name} works with a caveat: ${c.upgradePlan ?? c.evidence.lastTestResult ?? 'known limitation'}.`; break;
      case 'planned':   reason = `Not yet — ${c.name} is planned but not built. ${c.upgradePlan ?? ''}`.trim(); break;
      case 'blocked':   reason = `No — ${c.name} is blocked: ${c.evidence.lastError ?? 'a prerequisite is missing'}.`; break;
      default:          reason = `I'm not sure — ${c.name} hasn't been tested this session. Ask me to test it.`;
    }
    return { id, can, status: c.status, reason };
  }

  whyNot(id: string): string {
    const c = this.caps.find(x => x.id === id);
    if (!c) return `There is no capability "${id}".`;
    if (c.status === 'available') return `${c.name} is available — nothing is blocking it.`;
    const bits: string[] = [];
    if (c.status === 'planned') bits.push(`${c.name} is planned, not built yet.`);
    if (c.status === 'blocked') bits.push(`${c.name} is blocked.`);
    if (c.status === 'degraded') bits.push(`${c.name} works but is degraded.`);
    if (c.status === 'unknown') bits.push(`${c.name} hasn't been tested this session.`);
    if (c.requiredSecrets.length) bits.push(`Needs: ${c.requiredSecrets.join(', ')}.`);
    if (c.requiredApprovals.length) bits.push(`Requires approval: ${c.requiredApprovals.join(', ')}.`);
    if (c.evidence.lastError) bits.push(`Last error: ${c.evidence.lastError}.`);
    if (c.upgradePlan) bits.push(c.upgradePlan);
    return bits.join(' ');
  }

  recommendUpgrade(id: string): CapabilityUpgrade | null {
    const c = this.caps.find(x => x.id === id);
    if (!c || c.status === 'available') return null;
    const missing: string[] = [];
    if (c.requiredSecrets.length) missing.push(`secret(s): ${c.requiredSecrets.join(', ')}`);
    if (c.requiredApprovals.length) missing.push(`approval: ${c.requiredApprovals.join(', ')}`);
    if (c.status === 'planned') missing.push('implementation');
    if (c.status === 'unknown') missing.push('a passing test');
    const steps: string[] = [];
    if (c.upgradePlan) steps.push(c.upgradePlan);
    if (c.status === 'unknown' && c.testable) steps.push(`Run test("${c.id}") to confirm.`);
    if (steps.length === 0) steps.push('No automated upgrade path — needs design work.');
    const effort: CapabilityUpgrade['effort'] =
      c.status === 'planned' ? 'large' : c.status === 'unknown' ? 'quick' : 'medium';
    return { id, title: `Upgrade: ${c.name}`, missing, steps, effort };
  }

  // ── test ─────────────────────────────────────────────────────────────────

  async test(id: string): Promise<CapabilityTestResult> {
    const start = Date.now();
    const ranAt = new Date().toISOString();
    const c = this.caps.find(x => x.id === id);
    if (!c) {
      return { id, ok: false, status: 'unknown', detail: `Unknown capability "${id}".`, durationMs: 0, ranAt };
    }
    if (!c.testable) {
      // Observational — report current status without running anything.
      return { id, ok: c.status === 'available', status: c.status,
        detail: c.evidence.lastTestResult ?? `${c.name} is ${c.status} (not auto-testable).`,
        durationMs: Date.now() - start, ranAt };
    }
    try {
      const r = await this.runTest(c);
      this.patch(id, r.status, { lastTestResult: r.detail, lastSuccessfulCommand: r.ok ? id : undefined, lastError: r.ok ? undefined : r.detail });
      return { id, ok: r.ok, status: r.status, detail: r.detail, durationMs: Date.now() - start, ranAt };
    } catch (err) {
      const detail = String(err);
      this.patch(id, 'blocked', { lastError: detail });
      return { id, ok: false, status: 'blocked', detail, durationMs: Date.now() - start, ranAt };
    }
  }

  /** Run all testable capabilities (low-risk only). Returns results. */
  async testAll(): Promise<CapabilityTestResult[]> {
    const out: CapabilityTestResult[] = [];
    for (const c of this.caps) {
      if (c.testable && c.riskLevel !== 'medium' && c.riskLevel !== 'high') {
        out.push(await this.test(c.id));
      }
    }
    return out;
  }

  // ── Per-capability test strategies ────────────────────────────────────────

  private async runTest(c: Capability): Promise<{ ok: boolean; status: CapabilityStatus; detail: string }> {
    switch (c.id) {
      case 'terminal.gitStatus': {
        const r = await toolRegistryService.execute('terminal.gitStatus', {}, { approved: true });
        const ok = r.status === 'completed';
        return { ok, status: ok ? 'available' : 'blocked',
          detail: ok ? `git status ran (exit ${r.exitCode ?? 0}).` : (r.errorSummary ?? 'git status failed.') };
      }
      case 'terminal.npmLint':
      case 'terminal.npmBuild':
        return this.probeBinary('npm', c);
      case 'terminal.cargoTest':
        return this.probeBinary('cargo', c);

      case 'cli.claudeCheck': {
        const d = await cliDiscoveryService.discover('claude', true);
        return { ok: d.available, status: d.available ? 'available' : 'blocked',
          detail: d.available ? `Claude CLI found${d.path ? ` at ${d.path}` : ''}.` : 'Claude CLI not on PATH.' };
      }
      case 'cli.codexCheck': {
        const d = await cliDiscoveryService.discover('codex', true);
        return { ok: d.available, status: d.available ? 'available' : 'blocked',
          detail: d.available ? `Codex CLI found${d.path ? ` at ${d.path}` : ''}.` : 'Codex CLI not on PATH.' };
      }

      case 'agent.toolDispatch': {
        // Dry test: the parser must round-trip a tool_call and schemas must build.
        const schemas = auraToolDispatchService.getToolSchemas();
        const parsed = auraToolDispatchService.parseResponse(
          JSON.stringify({ type: 'tool_call', name: 'terminal__gitStatus', args: {}, call_id: 'probe' }),
        );
        const ok = schemas.length > 0 && parsed.type === 'tool_call' && parsed.toolId === 'terminal.gitStatus';
        return { ok, status: ok ? 'available' : 'degraded',
          detail: ok ? `Dispatch parser + ${schemas.length} tool schemas OK.` : 'Dispatch parser mismatch.' };
      }

      case 'memory.read': {
        const count = auraMemoryService.getCount();
        return { ok: true, status: 'available', detail: `Memory readable (${count} active fact${count === 1 ? '' : 's'}).` };
      }
      case 'memory.write': {
        // Non-sensitive round-trip: add → verify → delete.
        const sentinel = `selftest-${Date.now()}`;
        const m = auraMemoryService.add({ category: 'task', source: 'explicit', content: sentinel });
        const found = auraMemoryService.getAll().some(x => x.id === m.id);
        auraMemoryService.delete(m.id);
        return { ok: found, status: found ? 'available' : 'blocked',
          detail: found ? 'Memory write/read/delete round-trip OK.' : 'Memory write did not persist.' };
      }
      case 'memory.userProfile': {
        const cfg = auraPersonalityService.getConfig();
        const hasSlot = typeof cfg.userName === 'string';
        return { ok: hasSlot, status: hasSlot ? 'available' : 'degraded',
          detail: hasSlot ? `User-profile slot present${cfg.userName ? ` (name: ${cfg.userName})` : ' (no name set yet)'}.` : 'No user-profile slot.' };
      }

      // memory.sessionThreads / memory.compaction are tested by their own
      // services once present; default below keeps status until then.
      default:
        return { ok: c.status === 'available', status: c.status,
          detail: c.evidence.lastTestResult ?? `No test strategy for ${c.id}; status unchanged (${c.status}).` };
    }
  }

  private async probeBinary(program: string, c: Capability): Promise<{ ok: boolean; status: CapabilityStatus; detail: string }> {
    try {
      const r = await invoke<{ available: boolean; path?: string }>('check_command_available', { program });
      if (r.available) {
        // Binary reachable → capability is available. Medium-risk tools still
        // hit their normal approval gate at the tool layer when actually run.
        return { ok: true, status: 'available', detail: `${program} found${r.path ? ` (${r.path})` : ''}; ${c.name} reachable.` };
      }
      return { ok: false, status: 'blocked', detail: `${program} not found on PATH.` };
    } catch (err) {
      return { ok: false, status: 'blocked', detail: `Could not probe ${program}: ${String(err)}` };
    }
  }

  /** Allow other services (M4 session, etc.) to register evidence. */
  setStatus(id: string, status: CapabilityStatus, detail?: string) {
    if (this.caps.some(c => c.id === id)) {
      this.patch(id, status, detail ? { lastTestResult: detail } : {});
    }
  }
}

export const capabilityRegistryService = new CapabilityRegistryServiceImpl();

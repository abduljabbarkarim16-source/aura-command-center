/**
 * ToolRegistryService — AURA Phase 3F
 *
 * Registry of all approved tools AURA can invoke.
 * Each tool has a defined risk level, input constraints, and timeout.
 *
 * Security:
 *  - All tool executions route through existing safe backends (NativeCommandService, CliSessionService)
 *  - No arbitrary shell
 *  - High-risk tools always require explicit user approval
 *  - Input validation happens in this layer AND in Rust
 */

import { invoke } from '@tauri-apps/api/core';
import type { ToolDefinition, ToolExecution } from '../../types/tools';
import { cliSessionService } from '../agents/CliSessionService';
import { cliDiscoveryService } from '../agents/CliDiscoveryService';

function uid(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Tool catalog ─────────────────────────────────────────────────────────────

export const TOOL_CATALOG: ToolDefinition[] = [
  // ── Terminal tools ─────────────────────────────────────────────────────
  {
    id: 'terminal.gitStatus',
    name: 'Git Status',
    description: 'Show working tree status (git status --short)',
    category: 'terminal',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 10_000,
  },
  {
    id: 'terminal.gitBranch',
    name: 'Git Branch',
    description: 'Show current branch (git branch --show-current)',
    category: 'terminal',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 10_000,
  },
  {
    id: 'terminal.gitLog',
    name: 'Git Log',
    description: 'Show last 20 commits (git log --oneline -20)',
    category: 'terminal',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 10_000,
  },
  {
    id: 'terminal.npmLint',
    name: 'npm lint',
    description: 'Run TypeScript type-check (npm run lint)',
    category: 'terminal',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 60_000,
  },
  {
    id: 'terminal.npmBuild',
    name: 'npm build',
    description: 'Run Vite production build (npm run build)',
    category: 'terminal',
    risk: 'medium',
    requiresApproval: true,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 120_000,
  },
  {
    id: 'terminal.cargoTest',
    name: 'Cargo Test',
    description: 'Run Rust unit tests (cargo test)',
    category: 'terminal',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 120_000,
  },
  // ── CLI agent tools ────────────────────────────────────────────────────
  {
    id: 'cli.claudeCheck',
    name: 'Claude CLI Check',
    description: 'Check if Claude Code CLI is installed and accessible',
    category: 'cli_agent',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 10_000,
  },
  {
    id: 'cli.codexCheck',
    name: 'Codex CLI Check',
    description: 'Check if OpenAI Codex CLI is installed and accessible',
    category: 'cli_agent',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 10_000,
  },
  {
    id: 'cli.claudeRunTiny',
    name: 'Claude CLI Smoke Test',
    description: 'Run a minimal prompt to verify Claude CLI is authenticated',
    category: 'cli_agent',
    risk: 'medium',
    requiresApproval: true,
    allowedInputKeys: ['prompt'],
    blockedInputPatterns: ['`', '$', '\\', '|', '&', ';'],
    timeoutMs: 60_000,
  },
  {
    id: 'cli.codexRunTiny',
    name: 'Codex CLI Smoke Test',
    description: 'Run a minimal prompt to verify Codex CLI is authenticated',
    category: 'cli_agent',
    risk: 'medium',
    requiresApproval: true,
    allowedInputKeys: ['prompt'],
    blockedInputPatterns: ['`', '$', '\\', '|', '&', ';'],
    timeoutMs: 60_000,
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

type ExecutionListener = (executions: ToolExecution[]) => void;

class ToolRegistryServiceImpl {
  private executions: ToolExecution[] = [];
  private listeners = new Set<ExecutionListener>();

  subscribe(fn: ExecutionListener): () => void {
    this.listeners.add(fn);
    fn([...this.executions]);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn([...this.executions]);
  }

  private updateExecution(id: string, patch: Partial<ToolExecution>) {
    this.executions = this.executions.map(e => e.id === id ? { ...e, ...patch } : e);
    this.notify();
  }

  getTools(): ToolDefinition[] { return TOOL_CATALOG; }

  getTool(id: string): ToolDefinition | undefined {
    return TOOL_CATALOG.find(t => t.id === id);
  }

  getExecutions(): ToolExecution[] { return [...this.executions]; }

  /** Execute a tool by id. Throws if requiresApproval and no approval given. */
  async execute(
    toolId: string,
    inputs: Record<string, string> = {},
    options: { approved?: boolean } = {},
  ): Promise<ToolExecution> {
    const tool = this.getTool(toolId);
    if (!tool) throw new Error(`Unknown tool: ${toolId}`);
    if (tool.requiresApproval && !options.approved) {
      throw new Error(`Tool '${tool.name}' requires user approval before running.`);
    }

    // Validate inputs
    for (const [key, value] of Object.entries(inputs)) {
      if (!tool.allowedInputKeys.includes(key)) {
        throw new Error(`Input key '${key}' is not allowed for tool '${toolId}'`);
      }
      for (const blocked of tool.blockedInputPatterns) {
        if (value.includes(blocked)) {
          throw new Error(`Input contains blocked character: '${blocked}'`);
        }
      }
    }

    const execId = uid();
    const execution: ToolExecution = {
      id: execId,
      toolId,
      status: 'running',
      inputs,
      startedAt: new Date().toISOString(),
      approvedBy: options.approved ? 'user' : 'auto',
    };

    this.executions = [execution, ...this.executions].slice(0, 100);
    this.notify();

    try {
      const result = await this.runTool(tool, inputs);
      const end = new Date().toISOString();
      const done: Partial<ToolExecution> = {
        status: 'completed',
        output: result.output,
        exitCode: result.exitCode,
        endedAt: end,
        durationMs: result.durationMs,
      };
      if (result.exitCode !== 0) done.status = 'error';
      this.updateExecution(execId, done);
      return { ...execution, ...done };
    } catch (err) {
      this.updateExecution(execId, {
        status: 'error',
        errorSummary: String(err),
        endedAt: new Date().toISOString(),
      });
      return { ...execution, status: 'error', errorSummary: String(err) };
    }
  }

  private async runTool(
    tool: ToolDefinition,
    inputs: Record<string, string>,
  ): Promise<{ output: string; exitCode: number; durationMs: number }> {
    const start = Date.now();

    // ── Terminal tools ──────────────────────────────────────────────────
    const terminalMap: Record<string, [string, string[]]> = {
      'terminal.gitStatus':  ['git',   ['status', '--short']],
      'terminal.gitBranch':  ['git',   ['branch', '--show-current']],
      'terminal.gitLog':     ['git',   ['log', '--oneline', '-20']],
      'terminal.npmLint':    ['npm',   ['run', 'lint']],
      'terminal.npmBuild':   ['npm',   ['run', 'build']],
      'terminal.cargoTest':  ['cargo', ['test']],
    };

    if (terminalMap[tool.id]) {
      const [program, args] = terminalMap[tool.id];
      const r = await invoke<{ exitCode: number; stdout: string; stderr: string; durationMs: number }>(
        'run_allowed_command', { program, args },
      );
      return {
        output: [r.stdout, r.stderr].filter(Boolean).join('\n').trim(),
        exitCode: r.exitCode,
        durationMs: Date.now() - start,
      };
    }

    // ── CLI check tools ─────────────────────────────────────────────────
    if (tool.id === 'cli.claudeCheck') {
      const cap = await cliDiscoveryService.discover('claude', true);
      return {
        output: cap.available
          ? `Claude CLI found at: ${cap.path ?? 'PATH'}\n${cap.helpSummary.slice(0, 200)}`
          : 'Claude CLI not found on PATH. Install claude: https://claude.ai/code',
        exitCode: cap.available ? 0 : 1,
        durationMs: Date.now() - start,
      };
    }

    if (tool.id === 'cli.codexCheck') {
      const cap = await cliDiscoveryService.discover('codex', true);
      return {
        output: cap.available
          ? `Codex CLI found at: ${cap.path ?? 'PATH'}\n${cap.helpSummary.slice(0, 200)}`
          : 'Codex CLI not found on PATH.',
        exitCode: cap.available ? 0 : 1,
        durationMs: Date.now() - start,
      };
    }

    // ── CLI run tools ───────────────────────────────────────────────────
    if (tool.id === 'cli.claudeRunTiny' || tool.id === 'cli.codexRunTiny') {
      const cli = tool.id === 'cli.claudeRunTiny' ? 'claude' : 'codex';
      const prompt = inputs['prompt'] ?? 'Reply exactly with: AURA_CLI_OK';
      const sessionId = await cliSessionService.spawn(cli, prompt);
      const session = cliSessionService.getSession(sessionId);
      const output = session?.outputLines.join('\n') ?? '';
      return { output, exitCode: session?.exitCode ?? -1, durationMs: Date.now() - start };
    }

    throw new Error(`No executor for tool: ${tool.id}`);
  }
}

export const toolRegistryService = new ToolRegistryServiceImpl();

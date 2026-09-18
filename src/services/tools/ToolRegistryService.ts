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
import { agentBridgeService } from '../agents/AgentBridgeService';
import { permissionModeService } from '../permissions/PermissionModeService';
import { runtimeTaskService } from '../runtime/RuntimeTaskService';
import type { RuntimeTaskType, RuntimeTask } from '../../types/runtime-task';
import { ToolResultNormalizer } from './ToolResultNormalizer';
import type { ToolResult } from '../../types/tool-result';
import { incidentService } from '../testing/IncidentService';
import { visualShellStateService } from '../visual/VisualShellStateService';

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
  // ── Memory tools (JS-native, local only) ───────────────────────────────
  {
    id: 'agent.handshakeAllBackground',
    name: 'Background agent handshake',
    description: 'Send real sentinel prompts to all detected CLI agents in the background and return session/task ids immediately.',
    category: 'cli_agent',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 5_000,
  },
  {
    id: 'agent.sendPromptBackground',
    name: 'Send agent prompt in background',
    description: 'Send a prompt to a connected CLI agent as a background RuntimeTask. Use only when the user asks to hand work to an agent.',
    category: 'cli_agent',
    risk: 'medium',
    requiresApproval: false,
    allowedInputKeys: ['agent', 'prompt'],
    inputDescriptions: {
      agent: 'Target CLI agent: claude or codex.',
      prompt: 'Short prompt to send. Do not include secrets, API keys, or private credentials.',
    },
    blockedInputPatterns: ['`', '$', '\\'],
    timeoutMs: 5_000,
  },
  {
    id: 'agent.getSession',
    name: 'Get agent session',
    description: 'Read the status and latest output for a background CLI agent session.',
    category: 'cli_agent',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: ['sessionId'],
    inputDescriptions: {
      sessionId: 'Agent session id returned by a background handshake or prompt.',
    },
    blockedInputPatterns: [],
    timeoutMs: 5_000,
  },
  {
    id: 'agent.listSessions',
    name: 'List agent sessions',
    description: 'List recent CLI agent sessions with status, task id, and short output preview.',
    category: 'cli_agent',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 5_000,
  },
  {
    id: 'memory.rememberFact',
    name: 'Remember a fact',
    description: "Save a durable fact (e.g. a preference or project detail) to AURA's local memory. Use category 'personal' for facts about the user, 'task' for project/work facts.",
    category: 'memory', risk: 'low', requiresApproval: false,
    allowedInputKeys: ['content', 'category'], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  {
    id: 'memory.setUserName',
    name: "Set the user's name",
    description: "Remember the user's name (or preferred name). Call this when the user tells you their name.",
    category: 'memory', risk: 'low', requiresApproval: false,
    allowedInputKeys: ['name'], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  {
    id: 'memory.updatePreference',
    name: 'Update a preference',
    description: 'Record a UI or behaviour preference as a key/value pair.',
    category: 'memory', risk: 'low', requiresApproval: false,
    allowedInputKeys: ['key', 'value'], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  {
    id: 'memory.getUserProfile',
    name: 'Get user profile',
    description: "Recall what AURA knows about the user (name, preferences). Use this to answer questions like 'what is my name?'.",
    category: 'memory', risk: 'low', requiresApproval: false,
    allowedInputKeys: [], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  {
    id: 'memory.getCapabilityStatus',
    name: 'Get capability status',
    description: 'Recall the last-known summary of what AURA can and cannot do.',
    category: 'memory', risk: 'low', requiresApproval: false,
    allowedInputKeys: [], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  {
    id: 'memory.summarizeThread',
    name: 'Summarize current thread',
    description: 'Describe the current conversation thread (id, message count, summary).',
    category: 'memory', risk: 'low', requiresApproval: false,
    allowedInputKeys: [], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  {
    id: 'memory.compactThread',
    name: 'Compact current thread',
    description: 'Fold the current thread into a compact summary to save context.',
    category: 'memory', risk: 'low', requiresApproval: false,
    allowedInputKeys: [], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  {
    id: 'memory.deleteMemoryItem',
    name: 'Delete a memory item',
    description: 'Delete a saved memory by id (requires approval).',
    category: 'memory', risk: 'medium', requiresApproval: true,
    allowedInputKeys: ['id'], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  // ── Capability tools (JS-native, read/test) ────────────────────────────
  {
    id: 'capabilities.can',
    name: 'Can I do this?',
    description: "Answer whether AURA can do a given capability (e.g. 'terminal.gitStatus', 'memory.userProfile').",
    category: 'capability', risk: 'low', requiresApproval: false,
    allowedInputKeys: ['capabilityId'], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  {
    id: 'capabilities.whyNot',
    name: 'Why can\'t I do this?',
    description: 'Explain what is missing for a capability that is not available.',
    category: 'capability', risk: 'low', requiresApproval: false,
    allowedInputKeys: ['capabilityId'], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  {
    id: 'capabilities.test',
    name: 'Test a capability',
    description: 'Run the real test for a capability and report whether it passed.',
    category: 'capability', risk: 'low', requiresApproval: false,
    allowedInputKeys: ['capabilityId'], blockedInputPatterns: [], timeoutMs: 60_000,
  },
  {
    id: 'capabilities.gapReport',
    name: 'Capability gap report',
    description: "Produce an honest report of what AURA can't do yet and what it would take.",
    category: 'capability', risk: 'low', requiresApproval: false,
    allowedInputKeys: [], blockedInputPatterns: [], timeoutMs: 5_000,
  },
  // Visual shell tools. These only control local UI state; they never execute commands.
  {
    id: 'visual.showDiagram',
    name: 'Show canvas diagram',
    description: 'Render a structured diagram on the AURA canvas. Use this for workflows, architecture, task plans, comparisons, and visual explanations.',
    category: 'visual',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: ['title', 'description', 'layoutMode', 'themeColor', 'nodesJson', 'edgesJson'],
    inputDescriptions: {
      title: 'Diagram title.',
      description: 'Short diagram subtitle or explanation.',
      layoutMode: 'One of grid, list, flow, bento.',
      themeColor: 'Theme color name such as indigo, cyan, emerald, amber, rose, violet, zinc.',
      nodesJson: 'JSON array of nodes: [{ "label": "...", "detail": "...", "emoji": "...", "color": "cyan", "status": "running" }]. Keep to 3-8 nodes.',
      edgesJson: 'Optional JSON array of flow edges: [{ "from": "node-id-or-label", "to": "node-id-or-label", "label": "..." }].',
    },
    blockedInputPatterns: [],
    timeoutMs: 5_000,
  },
  {
    id: 'visual.closeDiagram',
    name: 'Close canvas diagram',
    description: 'Close the current canvas diagram and return the visual shell to normal voice/task state.',
    category: 'visual',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 5_000,
  },
  {
    id: 'visual.showTerminalVisual',
    name: 'Show terminal visual',
    description: 'Show a floating terminal visual. Prefer providing a real RuntimeTask taskId. Without a real task, it is marked illustrative and must not pretend a command ran.',
    category: 'visual',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: ['taskId', 'command'],
    inputDescriptions: {
      taskId: 'Optional real RuntimeTask id. Required for real terminal logs.',
      command: 'Optional display label if no RuntimeTask exists; no command will be executed by this visual tool.',
    },
    blockedInputPatterns: ['`', '$', '|', '&', ';'],
    timeoutMs: 5_000,
  },
  {
    id: 'visual.closeTerminalVisual',
    name: 'Close terminal visual',
    description: 'Close the floating terminal visual without affecting the underlying RuntimeTask history.',
    category: 'visual',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 5_000,
  },
  {
    id: 'visual.setCanvasTheme',
    name: 'Set canvas theme',
    description: 'Set the visual shell accent color, icon marker, and optional status message.',
    category: 'visual',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: ['themeColor', 'accentIcon', 'message'],
    inputDescriptions: {
      themeColor: 'Theme color name such as indigo, cyan, emerald, amber, rose, violet, zinc.',
      accentIcon: 'Short icon or emoji-like marker. Keep it compact.',
      message: 'Short status message to display on the canvas.',
    },
    blockedInputPatterns: [],
    timeoutMs: 5_000,
  },
  {
    id: 'visual.focusTask',
    name: 'Focus runtime task',
    description: 'Focus the canvas on an existing RuntimeTask. Terminal and CLI tasks can show their real logs in the terminal visual.',
    category: 'visual',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: ['taskId'],
    inputDescriptions: {
      taskId: 'Existing RuntimeTask id to focus.',
    },
    blockedInputPatterns: [],
    timeoutMs: 5_000,
  },
  {
    id: 'visual.resetCanvas',
    name: 'Reset canvas',
    description: 'Clear active visual shell diagram, terminal visual, focused task, theme override, and message.',
    category: 'visual',
    risk: 'low',
    requiresApproval: false,
    allowedInputKeys: [],
    blockedInputPatterns: [],
    timeoutMs: 5_000,
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

  /** Execute a tool by id. Returns a normalized ToolResult. */
  async execute(
    toolId: string,
    inputs: Record<string, string> = {},
    options: { approved?: boolean; taskId?: string } = {},
  ): Promise<ToolResult> {
    const startIso = new Date().toISOString();
    const start = Date.now();
    const tool = this.getTool(toolId);
    
    if (!tool) {
      return ToolResultNormalizer.normalizeError(toolId, options.taskId, startIso, 0, new Error(`Unknown tool: ${toolId}`));
    }

    // Permission-mode gate
    const { decision, reason } = permissionModeService.decide(tool);
    if (decision === 'block') {
      return ToolResultNormalizer.normalizeError(toolId, options.taskId, startIso, 0, new Error(`Execution blocked: ${reason}`));
    }
    if (decision === 'ask' && !options.approved) {
      return ToolResultNormalizer.normalizeError(toolId, options.taskId, startIso, 0, new Error(`Tool '${tool.name}' requires approval: ${reason}`));
    }

    // Validate inputs
    for (const [key, value] of Object.entries(inputs)) {
      if (!tool.allowedInputKeys.includes(key)) {
        return ToolResultNormalizer.normalizeError(toolId, options.taskId, startIso, 0, new Error(`Input key '${key}' is not allowed for tool '${toolId}'`));
      }
      for (const blocked of tool.blockedInputPatterns) {
        if (value.includes(blocked)) {
          return ToolResultNormalizer.normalizeError(toolId, options.taskId, startIso, 0, new Error(`Input contains blocked character: '${blocked}'`));
        }
      }
    }

    const execId = uid();
    const execution: ToolExecution = {
      id: execId,
      toolId,
      status: 'running',
      inputs,
      startedAt: startIso,
      approvedBy: options.approved ? 'user' : 'auto',
    };

    this.executions = [execution, ...this.executions].slice(0, 100);
    this.notify();

    let runtimeTask: RuntimeTask;
    if (options.taskId) {
      const existing = runtimeTaskService.getTask(options.taskId);
      if (!existing) {
        return ToolResultNormalizer.normalizeError(toolId, options.taskId, startIso, 0, new Error(`Task ID not found: ${options.taskId}`));
      }
      runtimeTask = existing;
    } else {
      let taskType: RuntimeTaskType = 'system';
      if (tool.category === 'terminal') taskType = 'terminal';
      else if (tool.category === 'cli_agent') taskType = 'cli';
      else if (tool.category === 'memory') taskType = 'memory';
      else if (tool.category === 'capability') taskType = 'capability';
      else if (tool.category === 'visual') taskType = 'visual';

      runtimeTask = runtimeTaskService.createTask({
        title: `Tool: ${tool.name}`,
        type: taskType,
        source: 'agent',
        risk: tool.risk,
        toolId: toolId
      });
    }
    
    runtimeTaskService.startTask(runtimeTask.id);
    
    const inputStr = Object.keys(inputs).length > 0 
      ? JSON.stringify(inputs) 
      : 'no inputs';
    runtimeTaskService.appendLog(runtimeTask.id, `Started ${toolId} with ${inputStr}`);

    try {
      const result = await this.runTool(tool, inputs);
      const durationMs = Date.now() - start;
      
      const successMessage = `Completed with exit code ${result.exitCode}. Output: ${result.output.slice(0, 100)}...`;
      runtimeTaskService.appendLog(runtimeTask.id, successMessage, result.exitCode === 0 ? 'success' : 'warn');

      const done: Partial<ToolExecution> = {
        status: result.exitCode === 0 ? 'completed' : 'error',
        output: result.output,
        exitCode: result.exitCode,
        endedAt: new Date().toISOString(),
        durationMs,
      };
      this.updateExecution(execId, done);
      
      if (result.exitCode === 0) {
        const memoryWriteTools = ['memory.rememberFact', 'memory.setUserName', 'memory.updatePreference', 'memory.deleteMemoryItem'];
        if (memoryWriteTools.includes(tool.id)) {
          const t = runtimeTaskService.getTask(runtimeTask.id);
          if (t) t.updatedMemory = true;
        }
        runtimeTaskService.completeTask(runtimeTask.id, { output: result.output, exitCode: result.exitCode }, `Exit code: ${result.exitCode}`);
      } else {
        runtimeTaskService.failTask(runtimeTask.id, `Exit code ${result.exitCode}: ${result.output.slice(0, 200)}`);
        
        // Incident handling for explicit errors
        if (result.output.includes('not found') || result.output.includes('ERR_')) {
          incidentService.createIncident({
            type: 'tool-dispatch-failed',
            severity: 'warn',
            message: `Tool ${toolId} failed: ${result.output.slice(0, 100)}`,
            context: { toolId, exitCode: result.exitCode }
          });
        }
      }
      
      return ToolResultNormalizer.normalizeSuccess(
        toolId, 
        runtimeTask.id, 
        startIso, 
        durationMs, 
        result.exitCode === 0 ? 'Tool completed successfully.' : 'Tool finished with non-zero exit code.', 
        { stdout: result.output, exitCode: result.exitCode }
      );
    } catch (err) {
      const errMsg = String(err);
      const durationMs = Date.now() - start;
      runtimeTaskService.appendLog(runtimeTask.id, `Error: ${errMsg}`, 'error');
      
      this.updateExecution(execId, {
        status: 'error',
        errorSummary: errMsg,
        endedAt: new Date().toISOString(),
        durationMs
      });
      
      runtimeTaskService.failTask(runtimeTask.id, errMsg);
      
      incidentService.createIncident({
        type: 'tool-dispatch-failed',
        severity: 'error',
        message: `Tool ${toolId} crashed: ${errMsg}`,
        context: { toolId, error: errMsg }
      });
      
      return ToolResultNormalizer.normalizeError(
        toolId, 
        runtimeTask.id, 
        startIso, 
        durationMs, 
        err
      );
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
    if (tool.id === 'agent.handshakeAllBackground') {
      const launches = await agentBridgeService.handshakeAllBackground();
      const output = launches.length > 0
        ? launches.map(l => `${l.agentId}: session ${l.sessionId}, task ${l.taskId}`).join('\n')
        : 'No detected CLI agents to handshake with.';
      return { output, exitCode: launches.length > 0 ? 0 : 1, durationMs: Date.now() - start };
    }

    if (tool.id === 'agent.sendPromptBackground') {
      const agent = (inputs['agent'] ?? '').trim().toLowerCase();
      const prompt = (inputs['prompt'] ?? '').trim();
      if (agent !== 'claude' && agent !== 'codex') {
        return { output: 'Target agent must be claude or codex.', exitCode: 1, durationMs: Date.now() - start };
      }
      if (!prompt) {
        return { output: 'No prompt provided.', exitCode: 1, durationMs: Date.now() - start };
      }
      const launch = await agentBridgeService.sendPromptBackground(agent, prompt);
      return {
        output: `${agent} background prompt started. Session: ${launch.sessionId}. RuntimeTask: ${launch.taskId}.`,
        exitCode: 0,
        durationMs: Date.now() - start,
      };
    }

    if (tool.id === 'agent.getSession') {
      const sessionId = (inputs['sessionId'] ?? '').trim();
      const session = sessionId ? cliSessionService.getSession(sessionId) : undefined;
      if (!session) {
        return { output: sessionId ? `Session not found: ${sessionId}` : 'No session id provided.', exitCode: 1, durationMs: Date.now() - start };
      }
      return {
        output: JSON.stringify({
          id: session.id,
          cli: session.cli,
          status: session.status,
          runtimeTaskId: session.runtimeTaskId,
          exitCode: session.exitCode,
          errorSummary: session.errorSummary,
          usageLimitMessage: session.usageLimitMessage,
          output: session.outputLines.slice(-40).join('\n'),
        }, null, 2),
        exitCode: session.status === 'error' || session.status === 'usage_limit' ? 1 : 0,
        durationMs: Date.now() - start,
      };
    }

    if (tool.id === 'agent.listSessions') {
      const sessions = cliSessionService.getSessions().slice(0, 10).map(s => ({
        id: s.id,
        cli: s.cli,
        status: s.status,
        runtimeTaskId: s.runtimeTaskId,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        preview: s.outputLines.slice(-3).join('\n').slice(0, 240),
      }));
      return { output: JSON.stringify(sessions, null, 2), exitCode: 0, durationMs: Date.now() - start };
    }

    if (tool.id === 'cli.claudeRunTiny' || tool.id === 'cli.codexRunTiny') {
      const cli = tool.id === 'cli.claudeRunTiny' ? 'claude' : 'codex';
      const prompt = inputs['prompt'] ?? 'Reply exactly with: AURA_CLI_OK';
      const sessionId = await cliSessionService.spawn(cli, prompt);
      const session = cliSessionService.getSession(sessionId);
      const output = session?.outputLines.join('\n') ?? '';
      return { output, exitCode: session?.exitCode ?? -1, durationMs: Date.now() - start };
    }

    // ── Memory + capability tools (JS-native, no Rust) ──────────────────
    if (tool.category === 'memory' || tool.category === 'capability' || tool.category === 'visual') {
      return this.runNativeTool(tool.id, inputs, start);
    }

    throw new Error(`No executor for tool: ${tool.id}`);
  }

  /**
   * Execute JS-native tools (memory.*, capabilities.*, visual.*).
   * Uses lazy dynamic imports to avoid a module-load cycle with
   * CapabilityRegistryService (which imports this registry).
   */
  private async runNativeTool(
    toolId: string,
    inputs: Record<string, string>,
    start: number,
  ): Promise<{ output: string; exitCode: number; durationMs: number }> {
    const done = (output: string, exitCode = 0) => ({ output, exitCode, durationMs: Date.now() - start });

    switch (toolId) {
      case 'memory.rememberFact': {
        const { auraMemoryService } = await import('../memory/AuraMemoryService');
        const content = inputs['content'] ?? '';
        const category = inputs['category'] === 'personal' ? 'personal' : 'task';
        if (!content.trim()) return done('Nothing to remember — no content given.', 1);
        auraMemoryService.add({ category, source: 'explicit', content });
        return done(`Saved to memory (${category}): "${content.trim().slice(0, 120)}"`);
      }
      case 'memory.setUserName': {
        const { userProfileMemoryService } = await import('../memory/UserProfileMemoryService');
        const name = (inputs['name'] ?? '').trim();
        if (!name) return done('No name provided.', 1);
        userProfileMemoryService.setName(name);
        return done(`Got it — I'll remember your name is ${name}.`);
      }
      case 'memory.updatePreference': {
        const { userProfileMemoryService } = await import('../memory/UserProfileMemoryService');
        const key = (inputs['key'] ?? '').trim();
        const value = (inputs['value'] ?? '').trim();
        if (!key) return done('No preference key provided.', 1);
        userProfileMemoryService.setUiPreference(key, value);
        return done(`Preference saved: ${key} = ${value}`);
      }
      case 'memory.getUserProfile': {
        const { userProfileMemoryService } = await import('../memory/UserProfileMemoryService');
        return done(userProfileMemoryService.summary());
      }
      case 'memory.getCapabilityStatus': {
        const { capabilityMemoryService } = await import('../memory/CapabilityMemoryService');
        const { capabilityGapService } = await import('../capabilities/CapabilityGapService');
        return done(`${capabilityMemoryService.summary()} ${capabilityGapService.report().text}`);
      }
      case 'memory.summarizeThread': {
        const { sessionThreadService } = await import('../session/SessionThreadService');
        const d = sessionThreadService.describe();
        return done(d?.text ?? 'No active conversation thread yet.');
      }
      case 'memory.compactThread': {
        const { sessionThreadService } = await import('../session/SessionThreadService');
        const t = sessionThreadService.compact();
        const d = sessionThreadService.describe();
        return done(t ? `Compacted. ${d?.text ?? ''}`.trim() : 'No active thread to compact.');
      }
      case 'memory.deleteMemoryItem': {
        const { auraMemoryService } = await import('../memory/AuraMemoryService');
        const id = (inputs['id'] ?? '').trim();
        if (!id) return done('No memory id provided.', 1);
        auraMemoryService.delete(id);
        return done(`Deleted memory ${id}.`);
      }
      case 'capabilities.can': {
        const { capabilityRegistryService } = await import('../capabilities/CapabilityRegistryService');
        return done(capabilityRegistryService.can(inputs['capabilityId'] ?? '').reason);
      }
      case 'capabilities.whyNot': {
        const { capabilityRegistryService } = await import('../capabilities/CapabilityRegistryService');
        return done(capabilityRegistryService.whyNot(inputs['capabilityId'] ?? ''));
      }
      case 'capabilities.test': {
        const { capabilityRegistryService } = await import('../capabilities/CapabilityRegistryService');
        const r = await capabilityRegistryService.test(inputs['capabilityId'] ?? '');
        return done(`${r.ok ? 'PASS' : 'FAIL'} (${r.status}): ${r.detail}`, r.ok ? 0 : 1);
      }
      case 'capabilities.gapReport': {
        const { capabilityGapService } = await import('../capabilities/CapabilityGapService');
        return done(capabilityGapService.report().text);
      }
      case 'visual.showDiagram': {
        visualShellStateService.showDiagramFromTool(inputs);
        return done('Canvas diagram shown.');
      }
      case 'visual.closeDiagram': {
        visualShellStateService.closeDiagram();
        return done('Canvas diagram closed.');
      }
      case 'visual.showTerminalVisual': {
        const taskId = (inputs['taskId'] ?? '').trim();
        const task = taskId ? runtimeTaskService.getTask(taskId) : undefined;
        visualShellStateService.showTerminalVisualFromTool(inputs);
        if (task) return done('Terminal visual shown from RuntimeTask.');
        if (taskId) return done(`RuntimeTask not found: ${taskId}. Illustrative terminal visual shown without executing a command.`, 1);
        return done('Illustrative terminal visual shown without executing a command.');
      }
      case 'visual.closeTerminalVisual': {
        visualShellStateService.closeTerminalVisual();
        return done('Terminal visual closed.');
      }
      case 'visual.setCanvasTheme': {
        visualShellStateService.setCanvasTheme(inputs['themeColor'], inputs['accentIcon'], inputs['message']);
        return done('Canvas theme updated.');
      }
      case 'visual.focusTask': {
        const taskId = (inputs['taskId'] ?? '').trim();
        const task = taskId ? runtimeTaskService.getTask(taskId) : undefined;
        visualShellStateService.focusTaskFromTool(inputs);
        return task ? done('Canvas task focus updated.') : done(taskId ? `Task not found: ${taskId}.` : 'No task id provided.', 1);
      }
      case 'visual.resetCanvas': {
        visualShellStateService.resetCanvas();
        return done('Canvas reset.');
      }
      default:
        throw new Error(`No native executor for tool: ${toolId}`);
    }
  }
}

export const toolRegistryService = new ToolRegistryServiceImpl();

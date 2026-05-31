/**
 * AuraToolDispatchService — AURA Phase 3H
 *
 * Bridges OpenAI function calling with AURA's tool registry.
 * When the model returns a tool_call, this service:
 *  1. Validates the tool is in the registry
 *  2. Checks if it needs approval (requiresApproval flag)
 *  3. Executes it via ToolRegistryService
 *  4. Returns the result string for the follow-up chat call
 *
 * Security:
 *  - Only tools in TOOL_CATALOG may be dispatched
 *  - requiresApproval tools must be explicitly pre-approved
 *  - No arbitrary code execution
 *  - Tool inputs validated by ToolRegistryService before execution
 */

import { invoke } from '@tauri-apps/api/core';
import { toolRegistryService, TOOL_CATALOG } from './ToolRegistryService';
import type { ToolDefinition } from '../../types/tools';
import { runtimeTaskService } from '../runtime/RuntimeTaskService';
import { incidentService } from '../testing/IncidentService';
import { permissionModeService } from '../permissions/PermissionModeService';
import type { RuntimeTaskType } from '../../types/runtime-task';

// ─── OpenAI function schema builder ───────────────────────────────────────────

/** Convert a ToolDefinition into an OpenAI function tool schema */
function toOpenAITool(tool: ToolDefinition) {
  const properties: Record<string, unknown> = {};
  for (const key of tool.allowedInputKeys) {
    properties[key] = { type: 'string', description: `Input: ${key}` };
  }
  return {
    type: 'function',
    function: {
      name: tool.id.replace('.', '__'), // OpenAI names can't have dots
      description: tool.description,
      parameters: {
        type: 'object',
        properties,
        required: [],
      },
    },
  };
}

// ─── Tool parse result ────────────────────────────────────────────────────────

export interface ParsedToolCall {
  type: 'tool_call';
  toolId: string;         // back-converted from OpenAI name
  callId: string;
  args: Record<string, string>;
}

export interface ParsedTextResponse {
  type: 'text';
  content: string;
}

export type ChatWithToolsResult = ParsedToolCall | ParsedTextResponse;

// ─── Service ──────────────────────────────────────────────────────────────────

class AuraToolDispatchServiceImpl {

  // ── Get tool definitions for the model ──────────────────────────────────────
  //
  // Returns OpenAI-format tool schemas for all auto-approved tools.
  // Medium/high-risk tools are excluded unless pre-approved for this session.

  getToolSchemas(opts: { includeApprovalRequired?: boolean } = {}): unknown[] {
    return TOOL_CATALOG
      .filter(t => opts.includeApprovalRequired || !t.requiresApproval)
      .map(toOpenAITool);
  }

  // ── Parse a raw openai_chat_with_tools response ──────────────────────────────

  parseResponse(raw: string): ChatWithToolsResult {
    try {
      const parsed = JSON.parse(raw) as { type: string; content?: string; name?: string; args?: Record<string, string>; call_id?: string };
      if (parsed.type === 'tool_call' && parsed.name) {
        // Convert OpenAI name back to tool id (__ → .)
        const toolId = parsed.name.replace('__', '.');
        return {
          type: 'tool_call',
          toolId,
          callId: parsed.call_id ?? '',
          args: parsed.args ?? {},
        };
      }
      return { type: 'text', content: parsed.content ?? raw };
    } catch {
      return { type: 'text', content: raw };
    }
  }

  // ── Execute a dispatched tool call ───────────────────────────────────────────
  //
  // Runs the tool and returns a plain-text result string for the follow-up call.
  // Auto-approved tools run immediately.
  // requiresApproval tools are gated — pass approved=true only after user confirms.

  async executeToolCall(
    call: ParsedToolCall,
    options: { approved?: boolean; taskId?: string } = {},
  ): Promise<string> {
    try {
      const result = await toolRegistryService.execute(call.toolId, call.args, options);
      return JSON.stringify(result, null, 2);
    } catch (err) {
      return JSON.stringify({ status: 'failed', error: String(err) });
    }
  }

  // ── Full tool-aware chat request ─────────────────────────────────────────────
  //
  // Calls openai_chat_with_tools. If the model requests a tool call,
  // executes it and calls openai_chat_tool_result for the spoken reply.
  // Auto-approved tools run without asking the user.
  // Returns the final text to be spoken.

  async chatWithTools(params: {
    transcript: string;
    history: Array<{ role: string; content: string }>;
    systemPrompt: string;
    onToolDispatched?: (toolId: string) => void;
    onApprovalNeeded?: (toolId: string) => Promise<boolean>;
  }): Promise<{ text: string; toolUsed?: string }> {
    const tools = this.getToolSchemas({ includeApprovalRequired: false });

    // First call — model decides if a tool is needed
    const raw = await invoke<string>('openai_chat_with_tools', {
      transcript: params.transcript,
      history: params.history,
      systemPromptOverride: params.systemPrompt,
      tools,
    });

    const parsed = this.parseResponse(raw);

    if (parsed.type === 'text') {
      return { text: parsed.content };
    }

    // Model wants a tool call
    const { toolId, callId, args } = parsed;
    const tool = toolRegistryService.getTool(toolId);

    if (!tool) {
      incidentService.createIncident({
        type: 'hallucinated-success',
        severity: 'warn',
        message: `Model tried to use unknown tool: ${toolId}`,
        context: { callId, args }
      });
      // Unknown tool — fall back to normal text response
      return { text: 'I tried to use a tool but it wasn\'t available. Let me answer directly.' };
    }

    // ── Create the task so it's visible while waiting for approval
    let taskType: RuntimeTaskType = 'system';
    if (tool.category === 'terminal') taskType = 'terminal';
    else if (tool.category === 'cli_agent') taskType = 'cli';
    else if (tool.category === 'memory') taskType = 'memory';
    else if (tool.category === 'capability') taskType = 'capability';

    const task = runtimeTaskService.createTask({
      title: `Tool: ${tool.name}`,
      type: taskType,
      source: 'voice', // We default to voice for chatWithTools
      risk: tool.risk,
      toolId: toolId
    });

    // Permission mode gate
    const { decision, reason } = permissionModeService.decide(tool);

    if (decision === 'block') {
      runtimeTaskService.failTask(task.id, `Blocked by permission mode: ${reason}`);
      return { text: `I cannot run ${tool.name} because it is blocked by the current permission mode.` };
    }

    let approved = decision === 'auto';
    if (decision === 'ask' && params.onApprovalNeeded) {
      runtimeTaskService.blockTask(task.id, 'Waiting for human approval');
      approved = await params.onApprovalNeeded(toolId);
    }

    if (!approved) {
      runtimeTaskService.failTask(task.id, 'Approval denied or blocked');
      return { text: `I need your approval to run ${tool.name}. You can approve it in the panel.` };
    }

    params.onToolDispatched?.(toolId);

    // Execute the tool. A human only "approved" it if the tool actually required
    // approval and onApprovalNeeded returned true.
    const humanApproved = decision === 'ask' && approved;
    const toolResult = await this.executeToolCall(parsed, { approved: humanApproved, taskId: task.id });

    // Follow-up call — model converts tool result to natural speech
    const followUp = await invoke<string>('openai_chat_tool_result', {
      toolName: toolId.replace('.', '__'),
      toolCallId: callId,
      toolResult,
      history: params.history,
      systemPromptOverride: params.systemPrompt,
      originalUserMessage: params.transcript,
    });

    return { text: followUp, toolUsed: toolId };
  }
}

export const auraToolDispatchService = new AuraToolDispatchServiceImpl();

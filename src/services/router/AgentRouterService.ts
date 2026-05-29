/**
 * AgentRouterService — AURA Milestone F
 *
 * Decides which agent should handle a given task based on:
 * - Task type and description
 * - Agent capabilities
 * - Provider availability (key presence check)
 * - Cost tier preference
 *
 * No real API calls. No agent execution.
 * Routing decisions feed into relay/handoff workflows.
 */

import type {
  AgentDefinition,
  AgentTaskType,
  AgentRoutingDecision,
  AgentFallbackRule,
  AgentProvider,
  AgentCostTier,
} from '../../types/agent-router';

// ─── Agent registry ───────────────────────────────────────────────────────────

const AGENTS: AgentDefinition[] = [
  {
    id: 'aura',
    name: 'AURA (Orchestrator)',
    provider: 'anthropic',
    role: 'orchestrator',
    capabilities: ['chat', 'architecture', 'documentation', 'relay', 'reasoning'],
    availability: 'available',
    costTier: 'high',
    requiresKey: true,
    keyEnvVar: 'VITE_ANTHROPIC_API_KEY',
    preferredTaskTypes: ['architecture', 'routing_decision', 'relay', 'documentation', 'memory_entry'],
    description: 'Primary orchestrator. Handles architecture, planning, relay, and memory tasks.',
  },
  {
    id: 'claude-architect',
    name: 'Claude Architect',
    provider: 'anthropic',
    role: 'architect',
    capabilities: ['chat', 'code_review', 'architecture', 'documentation', 'reasoning'],
    availability: 'available',
    costTier: 'high',
    requiresKey: true,
    keyEnvVar: 'VITE_ANTHROPIC_API_KEY',
    preferredTaskTypes: ['architecture', 'debugging', 'documentation', 'visual_qa'],
    description: 'High-level design and architectural decisions.',
  },
  {
    id: 'codex-dev',
    name: 'Codex Dev',
    provider: 'openai',
    role: 'developer',
    capabilities: ['chat', 'code_edit', 'debugging', 'tools'],
    availability: 'requires_key',
    costTier: 'medium',
    requiresKey: true,
    keyEnvVar: 'VITE_OPENAI_API_KEY',
    preferredTaskTypes: ['code_edit', 'debugging', 'command_execution'],
    description: 'Code implementation, editing, and debugging.',
  },
  {
    id: 'gemini-vision',
    name: 'Gemini Vision',
    provider: 'gemini',
    role: 'reviewer',
    capabilities: ['chat', 'vision', 'code_review', 'documentation'],
    availability: 'requires_key',
    costTier: 'low',
    requiresKey: true,
    keyEnvVar: 'VITE_GOOGLE_API_KEY',
    preferredTaskTypes: ['visual_qa', 'documentation'],
    description: 'Multimodal analysis, visual QA, large-context review.',
  },
  {
    id: 'chatgpt-relay',
    name: 'ChatGPT Relay',
    provider: 'chatgpt-relay',
    role: 'relay-target',
    capabilities: ['relay', 'code_review', 'architecture'],
    availability: 'available',
    costTier: 'free',
    requiresKey: false,
    keyEnvVar: null,
    preferredTaskTypes: ['relay', 'architecture', 'documentation'],
    description: 'Manual clipboard-based relay. No API key. Admin copies and pastes.',
  },
  {
    id: 'admin',
    name: 'Admin (Manual)',
    provider: 'admin-manual',
    role: 'admin',
    capabilities: ['chat', 'code_edit', 'debugging', 'documentation', 'voice', 'tools', 'relay'],
    availability: 'available',
    costTier: 'free',
    requiresKey: false,
    keyEnvVar: null,
    preferredTaskTypes: ['command_execution', 'deployment', 'git', 'provider_integration'],
    description: 'Human operator. Ultimate fallback for all critical actions.',
  },
  {
    id: 'oracle',
    name: 'Oracle / OpenClaude',
    provider: 'oracle',
    role: 'architect',
    capabilities: ['reasoning', 'relay', 'architecture'],
    availability: 'planned',
    costTier: 'variable',
    requiresKey: false,
    keyEnvVar: null,
    preferredTaskTypes: ['architecture', 'relay', 'routing_decision'],
    description: 'Deep reasoning synthesis agent — planned capability.',
  },
];

// ─── Fallback rules ───────────────────────────────────────────────────────────

const FALLBACK_RULES: AgentFallbackRule[] = [
  { id: 'fb-1', primaryAgent: 'codex-dev', fallbackAgent: 'claude-architect', triggerCondition: 'requires_key', description: 'No OpenAI key → fall back to Claude' },
  { id: 'fb-2', primaryAgent: 'gemini-vision', fallbackAgent: 'claude-architect', triggerCondition: 'requires_key', description: 'No Gemini key → fall back to Claude' },
  { id: 'fb-3', primaryAgent: 'claude-architect', fallbackAgent: 'chatgpt-relay', triggerCondition: 'requires_key', description: 'No Anthropic key → use manual relay' },
  { id: 'fb-4', primaryAgent: 'chatgpt-relay', fallbackAgent: 'admin', triggerCondition: 'offline', description: 'Relay unavailable → admin manual' },
];

// ─── Task → agent mapping ─────────────────────────────────────────────────────

const TASK_AGENT_MAP: Partial<Record<AgentTaskType, string>> = {
  architecture:        'claude-architect',
  code_edit:           'codex-dev',
  debugging:           'claude-architect',
  visual_qa:           'gemini-vision',
  documentation:       'claude-architect',
  memory_entry:        'aura',
  deployment:          'admin',
  provider_integration:'admin',
  voice:               'aura',
  git:                 'admin',
  command_execution:   'admin',
  relay:               'chatgpt-relay',
  routing_decision:    'aura',
  unknown:             'admin',
};

// ─── Service ──────────────────────────────────────────────────────────────────

class AgentRouterService {
  private customRules: AgentFallbackRule[] = [];

  // ── Classification ─────────────────────────────────────────────────────────

  classifyTask(description: string): AgentTaskType {
    const d = description.toLowerCase();
    if (d.includes('design') || d.includes('architect') || d.includes('structure')) return 'architecture';
    if (d.includes('edit') || d.includes('implement') || d.includes('write code') || d.includes('refactor')) return 'code_edit';
    if (d.includes('debug') || d.includes('error') || d.includes('fix') || d.includes('bug')) return 'debugging';
    if (d.includes('visual') || d.includes('ui') || d.includes('screenshot') || d.includes('design review')) return 'visual_qa';
    if (d.includes('doc') || d.includes('comment') || d.includes('readme')) return 'documentation';
    if (d.includes('memory') || d.includes('remember') || d.includes('ai-build-memory')) return 'memory_entry';
    if (d.includes('deploy') || d.includes('build') || d.includes('installer')) return 'deployment';
    if (d.includes('provider') || d.includes('api key') || d.includes('integration')) return 'provider_integration';
    if (d.includes('voice') || d.includes('speak') || d.includes('listen')) return 'voice';
    if (d.includes('git') || d.includes('branch') || d.includes('commit') || d.includes('push')) return 'git';
    if (d.includes('command') || d.includes('run') || d.includes('execute')) return 'command_execution';
    if (d.includes('relay') || d.includes('chatgpt') || d.includes('handoff')) return 'relay';
    if (d.includes('route') || d.includes('which agent') || d.includes('select agent')) return 'routing_decision';
    return 'unknown';
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  selectAgent(taskType: AgentTaskType): AgentDefinition {
    const preferredId = TASK_AGENT_MAP[taskType] ?? 'admin';
    const agent = AGENTS.find(a => a.id === preferredId);
    if (!agent) return AGENTS.find(a => a.id === 'admin')!;
    // Check availability — if needs key but key absent, apply fallback
    if (agent.availability === 'requires_key') {
      const fb = this.getFallbackAgent(agent.id);
      return fb ?? agent;
    }
    return agent;
  }

  getFallbackAgent(agentId: string): AgentDefinition | null {
    const allRules = [...this.customRules, ...FALLBACK_RULES];
    const rule = allRules.find(r => r.primaryAgent === agentId);
    if (!rule) return null;
    return AGENTS.find(a => a.id === rule.fallbackAgent) ?? null;
  }

  // ── Full routing decision ──────────────────────────────────────────────────

  route(taskDescription: string): AgentRoutingDecision {
    const taskType = this.classifyTask(taskDescription);
    const selected = this.selectAgent(taskType);
    const fallback = this.getFallbackAgent(selected.id);

    return {
      taskType,
      taskDescription,
      selectedAgent: selected.name,
      selectedProvider: selected.provider,
      confidence: selected.availability === 'available' ? 0.90 : 0.65,
      reason: this.buildReason(selected, taskType),
      fallbackAgent: fallback?.name ?? 'Admin (Manual)',
      fallbackProvider: (fallback?.provider ?? 'admin-manual') as AgentProvider,
      requiresExternalProvider: selected.requiresKey,
      requiresApproval: selected.provider !== 'admin-manual',
      costTier: selected.costTier as AgentCostTier,
      alternativeAgents: this.getAlternatives(taskType, selected.id),
    };
  }

  createHandoffSummary(decision: AgentRoutingDecision): string {
    return [
      `Task: ${decision.taskDescription}`,
      `Type: ${decision.taskType}`,
      `→ ${decision.selectedAgent} (${decision.selectedProvider})`,
      `Confidence: ${Math.round(decision.confidence * 100)}%`,
      `Reason: ${decision.reason}`,
      `Fallback: ${decision.fallbackAgent}`,
      decision.requiresApproval ? '⚠ Admin approval required before routing' : '✓ No approval required',
    ].join('\n');
  }

  explainRoutingDecision(decision: AgentRoutingDecision): string {
    return this.createHandoffSummary(decision);
  }

  // ── Management ────────────────────────────────────────────────────────────

  listRoutingRules(): AgentFallbackRule[] {
    return [...this.customRules, ...FALLBACK_RULES];
  }

  updateRoutingRule(rule: AgentFallbackRule): void {
    const idx = this.customRules.findIndex(r => r.id === rule.id);
    if (idx >= 0) this.customRules[idx] = rule;
    else this.customRules.push(rule);
  }

  listAgents(): AgentDefinition[] {
    return [...AGENTS];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildReason(agent: AgentDefinition, taskType: AgentTaskType): string {
    if (agent.id === 'admin') return `Task type "${taskType}" requires human action or no capable agent is available.`;
    return `${agent.name} is the preferred agent for "${taskType}" tasks. Provider: ${agent.provider}.`;
  }

  private getAlternatives(taskType: AgentTaskType, excludeId: string): string[] {
    return AGENTS
      .filter(a => a.id !== excludeId && a.preferredTaskTypes.includes(taskType))
      .map(a => a.name)
      .slice(0, 2);
  }
}

export const agentRouter = new AgentRouterService();

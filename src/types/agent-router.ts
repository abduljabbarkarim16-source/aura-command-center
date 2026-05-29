/**
 * AURA Agent Router Types — Milestone F
 *
 * Vocabulary for routing tasks between AI agents based on task type,
 * agent capabilities, availability, and cost considerations.
 */

// ─── Agent identification ──────────────────────────────────────────────────────

export type AgentProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'antigravity'
  | 'chatgpt-relay'
  | 'oracle'
  | 'local-tools'
  | 'admin-manual';

/** Functional role an agent plays in the system. */
export type AgentRole =
  | 'architect'        // System design, high-level planning
  | 'developer'        // Code editing, implementation
  | 'debugger'         // Error analysis, fix proposals
  | 'reviewer'         // Code review, quality checks
  | 'documenter'       // Docs, comments, READMEs
  | 'relay-target'     // Receives relay packets
  | 'orchestrator'     // Coordinates other agents (AURA itself)
  | 'voice-interface'  // Voice/UI interaction
  | 'admin';           // Human operator

// ─── Capabilities ─────────────────────────────────────────────────────────────

export type AgentCapability =
  | 'chat'
  | 'code_edit'
  | 'code_review'
  | 'architecture'
  | 'debugging'
  | 'documentation'
  | 'voice'
  | 'vision'
  | 'tools'
  | 'relay'
  | 'reasoning'
  | 'self_edit';

// ─── Task types ───────────────────────────────────────────────────────────────

export type AgentTaskType =
  | 'architecture'        // Design decisions, system planning
  | 'code_edit'           // Edit source files
  | 'debugging'           // Trace errors, propose fixes
  | 'visual_qa'           // UI/UX review
  | 'documentation'       // Write or update docs
  | 'memory_entry'        // Create a memory entry
  | 'deployment'          // Build, install, bundle
  | 'provider_integration'// Wire a new provider
  | 'voice'               // Voice/audio tasks
  | 'git'                 // Branch, commit, push
  | 'command_execution'   // Propose or run a command
  | 'relay'               // Relay packet creation/routing
  | 'routing_decision'    // Decide which agent for a task
  | 'unknown';

// ─── Availability ────────────────────────────────────────────────────────────

export type AgentAvailability = 'available' | 'busy' | 'offline' | 'requires_key' | 'planned';

// ─── Cost tier ────────────────────────────────────────────────────────────────

export type AgentCostTier = 'free' | 'low' | 'medium' | 'high' | 'variable';

// ─── Routing decision ────────────────────────────────────────────────────────

export interface AgentRoutingDecision {
  taskType: AgentTaskType;
  taskDescription: string;
  selectedAgent: string;        // Agent name/id
  selectedProvider: AgentProvider;
  confidence: number;           // 0–1
  reason: string;
  fallbackAgent: string;
  fallbackProvider: AgentProvider;
  requiresExternalProvider: boolean;
  requiresApproval: boolean;
  costTier: AgentCostTier;
  alternativeAgents: string[];
}

// ─── Fallback rule ────────────────────────────────────────────────────────────

export interface AgentFallbackRule {
  id: string;
  primaryAgent: string;
  fallbackAgent: string;
  triggerCondition: 'offline' | 'requires_key' | 'capability_missing' | 'cost_exceeded';
  description: string;
}

// ─── Agent definition (for router) ───────────────────────────────────────────

export interface AgentDefinition {
  id: string;
  name: string;
  provider: AgentProvider;
  role: AgentRole;
  capabilities: AgentCapability[];
  availability: AgentAvailability;
  costTier: AgentCostTier;
  requiresKey: boolean;
  keyEnvVar: string | null;
  preferredTaskTypes: AgentTaskType[];
  description: string;
}

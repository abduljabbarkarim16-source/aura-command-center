/**
 * AURA Command Center — Handoff Types
 *
 * Defines the structure for Handoffs created after Relay approval or manual routing.
 */

export type HandoffStatus =
  | 'drafted'
  | 'pending_admin_review'
  | 'approved'
  | 'sent_to_agent'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'archived';

export type HandoffSourceType = 'relay' | 'manual' | 'agent' | 'system';

export type HandoffTargetType =
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'gemini'
  | 'chatgpt'
  | 'manual'
  | 'system';

export type HandoffPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Handoff {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceType: HandoffSourceType;
  sourceAgentId?: string;
  targetType: HandoffTargetType;
  targetAgentId?: string;
  originalRelayPacketId?: string;
  relayExchangeId?: string;
  title: string;
  objective: string;
  contextSummary: string;
  decisionSummary: string;
  risks: string[];
  nextActions: string[];
  constraints: string;
  auditTrailRef?: string;
  priority: HandoffPriority;
  status: HandoffStatus;
  tags: string[];
}

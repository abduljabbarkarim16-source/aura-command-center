/**
 * AURA Command Center — Reasoning Relay Types
 *
 * Approval-Gated Reasoning Relay: structured packets flow from local agents
 * to external reasoning assistants (e.g. ChatGPT) only after explicit admin
 * approval. No automated ChatGPT access occurs in Phase 2C.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type RelaySourceType =
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'chatgpt'
  | 'gemini'
  | 'manual'
  | 'system';

export type RelayTargetType =
  | 'chatgpt'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'gemini'
  | 'manual';

export type RelayPacketType =
  | 'architecture_review'
  | 'debugging'
  | 'code_review'
  | 'planning'
  | 'risk_analysis'
  | 'handoff'
  | 'build_error'
  | 'agent_summary';

/**
 * Full lifecycle of a relay exchange.
 *
 * drafted → waiting_for_admin_review → approved_to_send → sent_to_chatgpt
 *   → waiting_for_chatgpt_response → response_imported → parsed
 *   → waiting_for_route_approval → approved_to_route → routed_to_agent
 *
 * At any point: rejected | archived
 */
export type RelayStatus =
  | 'drafted'
  | 'waiting_for_admin_review'
  | 'approved_to_send'
  | 'sent_to_chatgpt'
  | 'waiting_for_chatgpt_response'
  | 'response_imported'
  | 'parsed'
  | 'waiting_for_route_approval'
  | 'approved_to_route'
  | 'routed_to_agent'
  | 'archived'
  | 'rejected';

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface RelayAuditEvent {
  id: string;
  timestamp: string;         // ISO-8601
  actor: 'admin' | 'aura' | 'system';
  action: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Packet — created before sending
// ---------------------------------------------------------------------------

export interface RelayPacket {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceType: RelaySourceType;
  sourceAgentId: string;
  targetType: RelayTargetType;
  packetType: RelayPacketType;
  title: string;
  objective: string;
  context: string;
  sourceOutput: string;
  constraints: string;
  requestedAnalysis: string;
  /** Agent id suggested for routing after response is received */
  suggestedTargetAgentId: string;
  status: RelayStatus;
  auditTrail: RelayAuditEvent[];
}

// ---------------------------------------------------------------------------
// Response — imported after admin pastes ChatGPT reply
// ---------------------------------------------------------------------------

export interface RelayDecision {
  id: string;
  type: 'architectural' | 'technical' | 'risk' | 'action' | 'recommendation';
  description: string;
  /** 0–100 confidence estimate extracted from or assigned to the decision */
  confidence: number;
}

export interface RelayResponse {
  id: string;
  relayPacketId: string;
  importedAt: string;
  rawText: string;
  parsedSummary: string;
  decisions: RelayDecision[];
  risks: string[];
  nextActions: string[];
  recommendedTarget: RelayTargetType;
  /** Overall response confidence 0–100 */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Exchange — packet + optional response, stored together
// ---------------------------------------------------------------------------

export interface RelayExchange {
  id: string;
  packet: RelayPacket;
  response?: RelayResponse;
  createdAt: string;
  completedAt?: string;
}

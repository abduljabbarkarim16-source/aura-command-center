/**
 * AURA Command Center — Relay Service
 *
 * Manages the full lifecycle of approval-gated reasoning relay exchanges.
 * All state is stored in localStorage via PersistenceAdapter.
 *
 * IMPORTANT: This service never sends data to external services automatically.
 * Every outbound action requires explicit admin approval first.
 */

import { defaultAdapter } from '../persistence/PersistenceService';
import { handoffService } from '../handoff/HandoffService';
import { settingsService } from '../settings/SettingsService';
import type { PersistenceAdapter } from '../../types/persistence';
import type { PersistedMemoryEntry } from '../../types/persistence';
import type {
  RelayPacket,
  RelayResponse,
  RelayExchange,
  RelayAuditEvent,
  RelayStatus,
  RelayTargetType,
  RelayDecision,
} from '../../types/relay';

const STORAGE_KEY = 'relay.exchanges';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function auditEvent(
  actor: RelayAuditEvent['actor'],
  action: string,
  details?: string
): RelayAuditEvent {
  return { id: uid(), timestamp: now(), actor, action, details };
}

// ---------------------------------------------------------------------------
// RelayService
// ---------------------------------------------------------------------------

export class RelayService {
  constructor(private adapter: PersistenceAdapter = defaultAdapter) {}

  // ── Storage helpers ───────────────────────────────────────────────────────

  async listRelayHistory(): Promise<RelayExchange[]> {
    return (await this.adapter.get<RelayExchange[]>(STORAGE_KEY)) ?? [];
  }

  private async saveAll(exchanges: RelayExchange[]): Promise<void> {
    await this.adapter.set(STORAGE_KEY, exchanges);
  }

  async saveRelayExchange(exchange: RelayExchange): Promise<void> {
    const all = await this.listRelayHistory();
    const idx = all.findIndex(e => e.id === exchange.id);
    if (idx >= 0) all[idx] = exchange;
    else all.unshift(exchange); // newest first
    await this.saveAll(all);
  }

  async addAuditEvent(
    exchangeId: string,
    actor: RelayAuditEvent['actor'],
    action: string,
    details?: string
  ): Promise<RelayExchange | null> {
    const all = await this.listRelayHistory();
    const exchange = all.find(e => e.id === exchangeId);
    if (!exchange) return null;
    exchange.packet.auditTrail.push(auditEvent(actor, action, details));
    exchange.packet.updatedAt = now();
    await this.saveAll(all);
    return exchange;
  }

  // ── Packet lifecycle ──────────────────────────────────────────────────────

  async createRelayPacket(
    partial: Omit<RelayPacket, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'auditTrail'>
  ): Promise<RelayExchange> {
    const packet: RelayPacket = {
      ...partial,
      id: `pkt-${uid()}`,
      createdAt: now(),
      updatedAt: now(),
      status: 'waiting_for_admin_review',
      auditTrail: [auditEvent('aura', 'packet_created', `Type: ${partial.packetType}`)],
    };
    const exchange: RelayExchange = {
      id: `rx-${uid()}`,
      packet,
      createdAt: now(),
    };
    await this.saveRelayExchange(exchange);
    return exchange;
  }

  async updateRelayStatus(
    exchangeId: string,
    status: RelayStatus,
    actor: RelayAuditEvent['actor'] = 'system',
    details?: string
  ): Promise<RelayExchange | null> {
    const all = await this.listRelayHistory();
    const exchange = all.find(e => e.id === exchangeId);
    if (!exchange) return null;
    exchange.packet.status = status;
    exchange.packet.updatedAt = now();
    exchange.packet.auditTrail.push(auditEvent(actor, `status_changed_to_${status}`, details));
    await this.saveAll(all);
    return exchange;
  }

  async approveForSend(exchangeId: string): Promise<RelayExchange | null> {
    return this.updateRelayStatus(exchangeId, 'approved_to_send', 'admin', 'Admin approved packet for send');
  }

  async rejectRelay(exchangeId: string, reason?: string): Promise<RelayExchange | null> {
    return this.updateRelayStatus(exchangeId, 'rejected', 'admin', reason ?? 'Admin rejected relay');
  }

  async markSentToTarget(exchangeId: string): Promise<RelayExchange | null> {
    return this.updateRelayStatus(exchangeId, 'sent_to_chatgpt', 'admin', 'Packet copied and sent manually');
  }

  // ── Clipboard formatting ──────────────────────────────────────────────────

  formatPacketForClipboard(packet: RelayPacket): string {
    const typeLabel = packet.packetType.replace(/_/g, ' ').toUpperCase();
    const lines: string[] = [
      `╔══════════════════════════════════════════════╗`,
      `  AURA REASONING RELAY — ${typeLabel}`,
      `  ${new Date(packet.createdAt).toLocaleString()}`,
      `╚══════════════════════════════════════════════╝`,
      ``,
      `OBJECTIVE`,
      `─────────`,
      packet.objective,
      ``,
      `CONTEXT`,
      `───────`,
      packet.context,
      ``,
      `SOURCE OUTPUT (from ${packet.sourceAgentId || packet.sourceType})`,
      `─────────────────────────────────────────────────`,
      packet.sourceOutput,
    ];

    if (packet.constraints) {
      lines.push(``, `CONSTRAINTS`, `───────────`, packet.constraints);
    }

    lines.push(
      ``,
      `REQUESTED ANALYSIS`,
      `──────────────────`,
      packet.requestedAnalysis,
      ``,
      `─────────────────────────────────────────────────`,
      `Please respond with the following sections:`,
      `1. KEY FINDINGS / ARCHITECTURAL DECISIONS`,
      `2. IDENTIFIED RISKS`,
      `3. RECOMMENDED NEXT ACTIONS`,
      `4. SUGGESTED AGENT / TEAM for implementation`,
      `5. HANDOFF SUMMARY (1–2 sentences)`,
      `─────────────────────────────────────────────────`,
    );

    return lines.join('\n');
  }

  // ── Response import and parsing ───────────────────────────────────────────

  async importRelayResponse(
    exchangeId: string,
    rawText: string
  ): Promise<RelayExchange | null> {
    const all = await this.listRelayHistory();
    const exchange = all.find(e => e.id === exchangeId);
    if (!exchange) return null;

    const parsed = this.parseRelayResponse(exchange.packet.id, rawText);
    exchange.response = parsed;
    exchange.packet.status = 'parsed';
    exchange.packet.updatedAt = now();
    exchange.packet.auditTrail.push(
      auditEvent('admin', 'response_imported', `${rawText.length} chars`),
      auditEvent('aura', 'response_parsed', `${parsed.decisions.length} decisions, ${parsed.risks.length} risks`)
    );
    await this.saveAll(all);
    return exchange;
  }

  parseRelayResponse(relayPacketId: string, rawText: string): RelayResponse {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    const decisions: RelayDecision[] = [];
    const risks: string[] = [];
    const nextActions: string[] = [];
    let parsedSummary = '';
    let recommendedTarget: RelayTargetType = 'manual';

    // Section detection state
    type Section = 'none' | 'findings' | 'risks' | 'actions' | 'agent' | 'handoff';
    let section: Section = 'none';

    const sectionPatterns: Array<[RegExp, Section]> = [
      [/key findings|architectural decision|findings/i, 'findings'],
      [/identified risk|risks/i, 'risks'],
      [/next action|recommended.*action|action/i, 'actions'],
      [/suggested agent|suggested team|agent.*implementation/i, 'agent'],
      [/handoff summary|handoff/i, 'handoff'],
    ];

    const agentKeywords: Array<[RegExp, RelayTargetType]> = [
      [/claude/i, 'claude'],
      [/codex/i, 'codex'],
      [/antigravity/i, 'antigravity'],
      [/gemini/i, 'gemini'],
      [/chatgpt|openai/i, 'chatgpt'],
    ];

    const bulletRe = /^[-•*\d]+[.)]\s*/;

    for (const line of lines) {
      // Detect section headers
      let matched = false;
      for (const [re, sec] of sectionPatterns) {
        if (re.test(line) && line.length < 80) {
          section = sec;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      const text = line.replace(bulletRe, '').trim();
      if (!text) continue;

      switch (section) {
        case 'findings':
          decisions.push({
            id: uid(),
            type: 'architectural',
            description: text,
            confidence: 75,
          });
          break;
        case 'risks':
          risks.push(text);
          break;
        case 'actions':
          nextActions.push(text);
          break;
        case 'agent':
          for (const [re, target] of agentKeywords) {
            if (re.test(text)) { recommendedTarget = target; break; }
          }
          break;
        case 'handoff':
          parsedSummary = parsedSummary ? `${parsedSummary} ${text}` : text;
          break;
        default:
          // Unclassified lines with risk keywords → risks bucket
          if (/risk|warn|danger|caution|concern/i.test(text) && text.length < 200) {
            risks.push(text);
          }
      }
    }

    // Fallback: if nothing was parsed into sections, treat first 3 lines as summary
    if (!parsedSummary && decisions.length === 0) {
      parsedSummary = lines.slice(0, 3).join(' ');
      if (lines.length > 3) {
        lines.slice(3).forEach(l => nextActions.push(l.replace(bulletRe, '')));
      }
    }

    if (!parsedSummary) {
      parsedSummary = decisions.slice(0, 2).map(d => d.description).join('. ');
    }

    return {
      id: `resp-${uid()}`,
      relayPacketId,
      importedAt: now(),
      rawText,
      parsedSummary: parsedSummary || 'See raw response for details.',
      decisions,
      risks,
      nextActions,
      recommendedTarget,
      confidence: decisions.length > 0 ? 70 : 40,
    };
  }

  // ── Routing approval ──────────────────────────────────────────────────────

  async approveRoute(
    exchangeId: string,
    targetType: RelayTargetType
  ): Promise<RelayExchange | null> {
    const all = await this.listRelayHistory();
    const exchange = all.find(e => e.id === exchangeId);
    if (!exchange) return null;

    if (exchange.response) {
      exchange.response.recommendedTarget = targetType;
    }
    exchange.packet.status = 'approved_to_route';
    exchange.packet.updatedAt = now();
    exchange.packet.auditTrail.push(
      auditEvent('admin', 'route_approved', `Target: ${targetType}`)
    );
    await this.saveAll(all);
    return exchange;
  }

  async createHandoffFromRelay(exchangeId: string): Promise<RelayExchange | null> {
    const all = await this.listRelayHistory();
    const exchange = all.find(e => e.id === exchangeId);
    if (!exchange) return null;

    // ── 1. Create the persisted handoff ──────────────────────────────────────
    const handoff = await handoffService.createHandoffFromRelay(exchange);

    // ── 2. Create a memory entry ──────────────────────────────────────────────
    const resp = exchange.response;
    const packet = exchange.packet;
    const memEntry: PersistedMemoryEntry = {
      id: `mem-relay-${uid()}`,
      timestamp: now(),
      projectId: 'relay',          // placeholder — no project wiring yet in Phase 2D
      agentName: packet.sourceAgentId || packet.sourceType,
      category: 'handoff',
      title: `Relay: ${packet.title}`,
      summary: resp?.parsedSummary ?? packet.objective,
      details: [
        `Source: ${packet.sourceType} → Target: ${resp?.recommendedTarget ?? packet.targetType}`,
        resp?.risks?.length
          ? `Risks: ${resp.risks.join('; ')}`
          : '',
        resp?.nextActions?.length
          ? `Next Actions: ${resp.nextActions.join('; ')}`
          : '',
      ].filter(Boolean).join('\n'),
      relatedFiles: [],
      tags: [
        'relay',
        packet.packetType,
        packet.sourceType,
        resp?.recommendedTarget ?? 'manual',
      ],
      status: 'active',
    };
    await settingsService.addMemoryEntry(memEntry);

    // ── 3. Update exchange record ─────────────────────────────────────────────
    exchange.packet.status = 'routed_to_agent';
    exchange.packet.updatedAt = now();
    exchange.completedAt = now();
    exchange.createdHandoffId = handoff.id;
    exchange.createdMemoryEntryId = memEntry.id;
    exchange.routedAt = now();
    exchange.finalTargetType = handoff.targetType as RelayTargetType;
    if (handoff.targetAgentId) {
      exchange.finalTargetAgentId = handoff.targetAgentId;
    }
    exchange.packet.auditTrail.push(
      auditEvent('aura', 'handoff_created', `Handoff ID: ${handoff.id}`),
      auditEvent('aura', 'memory_entry_created', `Memory ID: ${memEntry.id}`)
    );
    await this.saveAll(all);
    return exchange;
  }

  async archiveExchange(exchangeId: string): Promise<void> {
    await this.updateRelayStatus(exchangeId, 'archived', 'admin');
  }
}

export const relayService = new RelayService();

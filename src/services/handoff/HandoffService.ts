/**
 * AURA Command Center — Handoff Service
 *
 * Persists and retrieves Handoff objects created when an admin approves
 * routing from a completed reasoning relay exchange or manual creation.
 *
 * All handoffs are stored in localStorage via the shared PersistenceAdapter.
 * Storage key: aura.handoffs.v1
 */

import { defaultAdapter } from '../persistence/PersistenceService';
import type { PersistenceAdapter } from '../../types/persistence';
import type { Handoff, HandoffStatus } from '../../types/handoff';
import type { RelayExchange } from '../../types/relay';

const STORAGE_KEY = 'aura.handoffs.v1';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

export class HandoffService {
  constructor(private adapter: PersistenceAdapter = defaultAdapter) {}

  // ── Storage helpers ───────────────────────────────────────────────────────

  async listHandoffs(): Promise<Handoff[]> {
    return (await this.adapter.get<Handoff[]>(STORAGE_KEY)) ?? [];
  }

  async getHandoffById(id: string): Promise<Handoff | null> {
    const all = await this.listHandoffs();
    return all.find(h => h.id === id) ?? null;
  }

  private async saveAll(handoffs: Handoff[]): Promise<void> {
    await this.adapter.set(STORAGE_KEY, handoffs);
  }

  // ── Creation ──────────────────────────────────────────────────────────────

  async createHandoff(handoffData: Omit<Handoff, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Handoff> {
    const handoff: Handoff = {
      ...handoffData,
      id: `hf-${uid()}`,
      createdAt: now(),
      updatedAt: now(),
      status: 'drafted',
    };

    const all = await this.listHandoffs();
    all.unshift(handoff);
    await this.saveAll(all);
    return handoff;
  }

  async createHandoffFromRelay(exchange: RelayExchange): Promise<Handoff> {
    const packet = exchange.packet;
    const resp = exchange.response;

    const handoff: Handoff = {
      id: `hf-${uid()}`,
      createdAt: now(),
      updatedAt: now(),
      sourceType: 'relay',
      sourceAgentId: packet.sourceAgentId,
      targetType: resp?.recommendedTarget ?? 'manual',
      originalRelayPacketId: packet.id,
      relayExchangeId: exchange.id,
      title: packet.title,
      objective: packet.objective,
      contextSummary: packet.objective,
      decisionSummary: resp?.parsedSummary ?? packet.objective,
      risks: resp?.risks ?? [],
      nextActions: resp?.nextActions ?? [],
      constraints: packet.constraints ?? '',
      priority: 'medium', // Default
      status: 'pending_admin_review',
      tags: ['relay', packet.packetType],
    };

    const all = await this.listHandoffs();
    all.unshift(handoff);
    await this.saveAll(all);
    return handoff;
  }

  // ── Updates ───────────────────────────────────────────────────────────────

  async updateHandoffStatus(id: string, status: HandoffStatus): Promise<Handoff | null> {
    const all = await this.listHandoffs();
    const handoff = all.find(h => h.id === id);
    if (!handoff) return null;
    
    handoff.status = status;
    handoff.updatedAt = now();
    await this.saveAll(all);
    return handoff;
  }

  async archiveHandoff(id: string): Promise<void> {
    await this.updateHandoffStatus(id, 'archived');
  }

  // ── Deletion and Export ───────────────────────────────────────────────────

  async clearHandoffs(): Promise<void> {
    await this.adapter.remove(STORAGE_KEY);
  }

  async exportHandoffsJson(): Promise<string> {
    const all = await this.listHandoffs();
    return JSON.stringify(all, null, 2);
  }
}

export const handoffService = new HandoffService();

/**
 * CapabilityMemoryService — AURA Phase 3G (Milestone 3)
 *
 * Persists a snapshot of AURA's capability state (what it last confirmed it
 * can/cannot do) so it survives a restart. The live truth is always
 * CapabilityRegistryService; this is the "last known" record for cold start
 * and for showing drift ("last self-test was 2 days ago").
 */

import type { CapabilityMemorySnapshot } from '../../types/aura-memory';
import { capabilityRegistryService } from '../capabilities/CapabilityRegistryService';

const STORAGE_KEY = 'aura.capabilityMemory';

class CapabilityMemoryServiceImpl {
  /** Capture the current registry state into a persisted snapshot. */
  snapshot(): CapabilityMemorySnapshot {
    const all = capabilityRegistryService.getAll();
    const pick = (s: string) => all.filter(c => c.status === s).map(c => c.id);
    const snap: CapabilityMemorySnapshot = {
      takenAt: new Date().toISOString(),
      available: pick('available'),
      degraded: pick('degraded'),
      blocked: pick('blocked'),
      planned: pick('planned'),
      untested: pick('unknown'),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snap)); } catch { /* full */ }
    return snap;
  }

  /** The last persisted snapshot, if any. */
  last(): CapabilityMemorySnapshot | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CapabilityMemorySnapshot) : null;
    } catch { return null; }
  }

  /** Speakable summary of remembered capability state. */
  summary(): string {
    const s = this.last();
    if (!s) return "I haven't recorded a capability snapshot yet. Ask me to run a self-test.";
    const when = new Date(s.takenAt).toLocaleString();
    return `As of ${when}: ${s.available.length} available, ${s.degraded.length} degraded, ` +
      `${s.blocked.length} blocked, ${s.planned.length} planned, ${s.untested.length} untested.`;
  }
}

export const capabilityMemoryService = new CapabilityMemoryServiceImpl();

/**
 * CapabilityGapService — AURA Phase 3G
 *
 * Turns the capability registry into an honest "what I can't do yet" report.
 * Used by the Capabilities panel, the self-test harness, and the gap planner.
 *
 * It never fabricates capability — it only reports what the registry knows.
 */

import { capabilityRegistryService } from './CapabilityRegistryService';
import type { Capability, CapabilityUpgrade } from '../../types/capabilities';

export interface CapabilityGap {
  capability: Capability;
  whyNot: string;
  upgrade: CapabilityUpgrade | null;
}

export interface CapabilityGapReport {
  generatedAt: string;
  summary: Record<string, number>;
  /** Capabilities that are not currently usable (planned/blocked/unknown). */
  gaps: CapabilityGap[];
  /** Capabilities that work but with caveats. */
  degraded: CapabilityGap[];
  /** Plain-text report, safe to speak or print. */
  text: string;
}

class CapabilityGapServiceImpl {
  /** Build a structured + textual gap report. */
  report(): CapabilityGapReport {
    const all = capabilityRegistryService.getAll();
    const summary = capabilityRegistryService.summary();

    const toGap = (c: Capability): CapabilityGap => ({
      capability: c,
      whyNot: capabilityRegistryService.whyNot(c.id),
      upgrade: capabilityRegistryService.recommendUpgrade(c.id),
    });

    const gaps = all
      .filter(c => c.status === 'planned' || c.status === 'blocked' || c.status === 'unknown')
      .map(toGap);
    const degraded = all.filter(c => c.status === 'degraded').map(toGap);

    const lines: string[] = [];
    const available = all.filter(c => c.status === 'available').length;
    lines.push(`I can currently do ${available} of ${all.length} tracked things.`);

    const planned = gaps.filter(g => g.capability.status === 'planned');
    const blocked = gaps.filter(g => g.capability.status === 'blocked');
    const untested = gaps.filter(g => g.capability.status === 'unknown');

    if (blocked.length) {
      lines.push(`Blocked (${blocked.length}): ` + blocked.map(g => `${g.capability.name}`).join(', ') + '.');
    }
    if (planned.length) {
      lines.push(`Planned, not built (${planned.length}): ` + planned.map(g => g.capability.name).join(', ') + '.');
    }
    if (degraded.length) {
      lines.push(`Works with caveats (${degraded.length}): ` + degraded.map(g => g.capability.name).join(', ') + '.');
    }
    if (untested.length) {
      lines.push(`Untested this session (${untested.length}): ` + untested.map(g => g.capability.name).join(', ') + '. Ask me to run a self-test to confirm these.');
    }
    if (gaps.length === 0 && degraded.length === 0) {
      lines.push('Everything tracked is available.');
    }

    return {
      generatedAt: new Date().toISOString(),
      summary,
      gaps,
      degraded,
      text: lines.join(' '),
    };
  }

  /** The single biggest "next missing capability" worth building. */
  nextMissing(): CapabilityGap | null {
    const all = capabilityRegistryService.getAll();
    // Prefer blocked (a prerequisite away) → planned (design work).
    const blocked = all.find(c => c.status === 'blocked');
    if (blocked) return { capability: blocked, whyNot: capabilityRegistryService.whyNot(blocked.id), upgrade: capabilityRegistryService.recommendUpgrade(blocked.id) };
    const planned = all.find(c => c.status === 'planned');
    if (planned) return { capability: planned, whyNot: capabilityRegistryService.whyNot(planned.id), upgrade: capabilityRegistryService.recommendUpgrade(planned.id) };
    return null;
  }
}

export const capabilityGapService = new CapabilityGapServiceImpl();

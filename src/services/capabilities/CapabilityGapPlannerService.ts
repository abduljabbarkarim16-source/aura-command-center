/**
 * CapabilityGapPlannerService — AURA Phase 3G (Milestone 13)
 *
 * Controlled self-improvement *planner* (not executor). When AURA can't do
 * something, it can: capture the gap, write a memory entry, propose a task,
 * propose a branch, and draft a handoff prompt for Claude/Codex — then STOP and
 * ask for approval. It never auto-executes a build or runs an external agent.
 */

import { capabilityRegistryService } from './CapabilityRegistryService';
import { capabilityGapService } from './CapabilityGapService';
import { auraMemoryService } from '../memory/AuraMemoryService';
import { sessionThreadService } from '../session/SessionThreadService';

export interface GapPlan {
  capabilityId: string;
  name: string;
  status: string;
  whyNot: string;
  missing: string[];
  steps: string[];
  effort: 'quick' | 'medium' | 'large';
  suggestedTask: string;
  branchPlan: string;
  /** Self-contained prompt for an external agent. No secrets, no repo source. */
  handoffPrompt: string;
  recordedToMemory: boolean;
}

class CapabilityGapPlannerServiceImpl {
  /** Build (but do not execute) a plan to close a capability gap. */
  planFor(capabilityId: string): GapPlan | null {
    const cap = capabilityRegistryService.get(capabilityId);
    if (!cap) return null;
    const upgrade = capabilityRegistryService.recommendUpgrade(capabilityId);
    const whyNot = capabilityRegistryService.whyNot(capabilityId);
    const missing = upgrade?.missing ?? [];
    const steps = upgrade?.steps ?? (cap.upgradePlan ? [cap.upgradePlan] : ['Design work required.']);
    const effort = upgrade?.effort ?? 'medium';

    const slug = capabilityId.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const branchPlan = `feat/${slug} — ${steps[0]}`;

    const handoffPrompt = [
      `Goal: implement the AURA capability "${cap.name}" (id: ${cap.id}).`,
      `Current status: ${cap.status}. ${whyNot}`,
      missing.length ? `Missing: ${missing.join('; ')}.` : '',
      `Plan: ${steps.join(' ')}`,
      `Constraints: route all execution through the existing allowlisted Rust layer; no secrets; no destructive commands; keep changes typechecked (npm run lint).`,
      `Acceptance: capabilityRegistryService.test("${cap.id}") returns ok=true, and the Capabilities panel shows it available.`,
    ].filter(Boolean).join('\n');

    return {
      capabilityId: cap.id,
      name: cap.name,
      status: cap.status,
      whyNot,
      missing,
      steps,
      effort,
      suggestedTask: `Build capability: ${cap.name}`,
      branchPlan,
      handoffPrompt,
      recordedToMemory: false,
    };
  }

  /** Persist the gap as a memory fact + thread fact, and return the plan. */
  recordGap(capabilityId: string): GapPlan | null {
    const plan = this.planFor(capabilityId);
    if (!plan) return null;
    try {
      auraMemoryService.add({
        category: 'task', source: 'explicit',
        content: `Capability gap: ${plan.name} — ${plan.missing.join(', ') || plan.status}. Plan: ${plan.steps[0]}`,
        context: `capability:${plan.capabilityId}`,
      });
      sessionThreadService.addFact(`Capability gap recorded: ${plan.name}.`);
      plan.recordedToMemory = true;
    } catch { /* memory optional */ }
    return plan;
  }

  /** The single next capability worth building, with a ready plan. */
  nextMissingPlan(): GapPlan | null {
    const next = capabilityGapService.nextMissing();
    if (!next) return null;
    return this.planFor(next.capability.id);
  }
}

export const capabilityGapPlannerService = new CapabilityGapPlannerServiceImpl();

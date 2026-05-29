# AURA Self-Build Orchestrator Foundation

**Milestone:** J  
**Branch:** `selfbuild-orchestrator-foundation`

## Purpose

AURA can now propose structured self-improvement plans. Given a goal description, `SelfBuildOrchestratorService` decomposes it into milestones, tasks, risk estimates, approval gates, and proposed git/command operations.

## Core Flow

```
Admin/AURA provides goal description
  → createPlanFromGoal(goal)
  → decomposeGoal() → milestones (preparation, impl, validation, commit, review)
  → estimateRisk() → SelfBuildRisk[]
  → computeOverallRisk() → CommandRiskClass
  → Plan persisted, notification sent

Admin reviews plan
  → exportPlan() → full JSON with command proposals, handoff plan, memory plan
  → updatePlanStatus() → 'awaiting_admin' → 'in_progress'

Each task → CommandProposalService → approval gate → (Phase 2J execution)
```

## Plan Structure

```typescript
SelfBuildPlan {
  goal: SelfBuildGoal;
  milestones: [
    Milestone 1: Preparation (branch creation, baseline lint)
    Milestone 2: Implementation (file creation/edits)
    Milestone 3: Validation (lint, build)
    Milestone 4: Commit + push
    Milestone 5: Human review + merge (admin-only)
  ];
  risks: SelfBuildRisk[];
  overallRisk: CommandRiskClass;
  requiresAdminApproval: true (if overallRisk !== 'safe');
}
```

## Integration Points

| Service | How Used |
|---|---|
| `GitAutomationService` | Branch name generation, branch/commit/merge plans |
| `CommandPolicyService` | Risk classification of proposed commands |
| `CommandProposalService` | Command execution gate (Phase 2J+) |
| `AgentRouterService` | Routing decision for implementation tasks |
| `NotificationService` | Plan creation/status notifications |

## Example Usage

```typescript
const plan = selfBuildOrchestrator.createPlanFromGoal({
  title: 'Add persistence layer for runtime timeline',
  description: 'Implement a new service that persists runtime events to localStorage',
  requestedBy: 'admin',
  priority: 'medium',
  estimatedEffort: 'small',
});

// Review
console.log(selfBuildOrchestrator.exportPlan(plan.id));

// Approve and track
selfBuildOrchestrator.updatePlanStatus(plan.id, 'in_progress');
```

## Phase 2J — Real Execution

When Phase 2J adds the workspace bridge:
1. Each approved `SelfBuildTask` calls `commandProposalService.proposeCommand()`
2. Admin approves via Voice Core tray
3. Command executes via Tauri native bridge
4. Result is recorded and next task proceeds
5. Memory entry is created on milestone completion

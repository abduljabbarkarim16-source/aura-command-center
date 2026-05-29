# AURA Git Automation Foundation

**Milestone:** E  
**Branch:** `selfbuild-git-automation-foundation`

## Purpose

Prepare AURA to manage git branches, commits, and merges safely through structured planning. All plans produce command proposals — no git execution happens without admin approval.

## Types (`src/types/git-automation.ts`)

- `GitBranchPlan` — create branch plan with proposed commands
- `GitCommitPlan` — stage files and commit with message
- `GitMergePlan` — merge plan with validation checklist
- `GitAutomationPlan` — full branch + commit + merge pipeline
- `GitRisk` — `none | low | medium | high | critical`
- `GitOperationStatus` — `planned → approved → running → succeeded/failed`

## Service (`src/services/git/GitAutomationService.ts`)

```typescript
// Create a full branch → commit → merge plan
const plan = gitAutomationService.createFullPlan({
  goal: 'Add workspace controller',
  baseBranch: 'main',
  newBranchName: 'selfbuild-workspace-controller',
  purpose: 'AURA self-building workspace awareness layer',
  commitMessage: 'Milestone B: Add workspace controller foundation',
  filesToCommit: ['src/types/workspace-controller.ts', ...],
  mergeTarget: 'main',
});

// Each plan.*.proposedCommands feeds into CommandProposalService
```

## Naming Convention

| Type | Pattern |
|---|---|
| Phase branch | `phase-{N}-{description}` |
| Self-build | `selfbuild-{description}` |
| Feature | `feature/{description}` |
| Fix | `fix/{description}` |

## Safe Merge Checklist (merge to main)

1. Branch is based on latest main
2. Working tree is clean
3. `npm run lint` passes
4. `npm run build` passes
5. `npm run tauri:build` produces valid installer
6. Manual visual check passes
7. No secrets in diff
8. No destructive changes in diff

## Integration

Plans feed into `CommandProposalService.proposeCommand()` which gates execution through the approval system. Real git command execution arrives in Phase 2J via Tauri native bridge.

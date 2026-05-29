# AURA Command Proposal Queue

**Milestone:** D  
**Branch:** `selfbuild-command-proposal-queue`

## Purpose

AURA can propose commands and track their approval/execution lifecycle without blindly executing them. Every command goes through: Proposed → Policy check → Approval → Ready → (Execute in Phase 2J) → Result.

## Lifecycle

```
proposeCommand()
  → CommandPolicyService.classifyCommand()
  → blocked?  → rejected + notification
  → safe?     → ready_to_run + tool notification
  → approval? → pending_approval + Voice Core approval tray
                (admin approves/rejects)
  → approved  → ready_to_run
  → (Phase 2J) markRunning() → markSucceeded() / markFailed()
```

## Types (`src/types/command-runner.ts`)

- `CommandProposalStatus` — full lifecycle: `drafted` → `pending_approval` → `approved` → `running` → `succeeded` / `failed` → `logged`
- `ProposedCommand` — full proposal record with risk, category, reason, affected paths
- `CommandExecutionResult` — stdout, stderr, exit code, summary
- `CommandAuditEvent` — actor, action, timestamp (immutable audit trail)
- `CommandQueueSnapshot` — reactive view for UI

## Service (`CommandProposalService`)

```typescript
commandProposalService.proposeCommand({
  command: 'npm run lint',
  reason: 'Validate TypeScript before branch push',
  workspaceId: 'ws-aura-command-center',
  expectedOutcome: 'tsc --noEmit exits 0 with no errors',
});
```

Safe commands → immediately `ready_to_run` + tool notification.  
Approval-required → Voice Core approval tray via `voiceRuntimeService.requestApproval()`.

## Notification Bridge

| Event | Notification |
|---|---|
| Blocked by policy | danger |
| Safe → ready_to_run | tool |
| Soft approval | info |
| Proposal rejected | info |
| Execution succeeded | success |
| Execution failed | danger |

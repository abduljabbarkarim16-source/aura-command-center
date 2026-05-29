# AURA Command Policy Engine

**Milestone:** C  
**Branch:** `selfbuild-command-policy`

## Purpose

Before AURA proposes or executes any command, it must classify the command by risk level and determine the appropriate approval requirement. This is the safety gating layer between "AURA proposes an action" and "action executes."

## Risk Classes

| Class | Example | Approval |
|---|---|---|
| `safe` | `npm run lint`, `git status`, `git log` | None — can auto-run |
| `moderate` | `npm run build`, `git commit`, `git checkout -b` | Required |
| `high` | `npm install`, `git push`, `tauri build`, file write | Required |
| `critical` | `rm -rf`, force push, port exposure, eval() | Blocked |

## Command Categories

`read_only` · `build` · `test` · `lint` · `install_dependency` · `git_status` · `git_branch` · `git_commit` · `git_push` · `file_write` · `file_delete` · `network` · `environment` · `process` · `unknown`

## Pattern Matching

`CommandPolicyService.classifyCommand(cmd)` returns a `CommandPolicyDecision`:

```typescript
{
  command: string;
  riskClass: CommandRiskClass;
  category: CommandCategory;
  approvalRequirement: CommandApprovalRequirement;
  reason: string;
  matchedPattern?: string;
  blocked: boolean;
  canAutoRun: boolean;
}
```

Patterns are checked in order (most specific first). Unknown commands default to `high` / `required`.

## Approval Requirements

| Value | Meaning |
|---|---|
| `none` | Safe — no approval, can auto-run |
| `soft` | Log it, don't block |
| `required` | Must be explicitly approved in UI (Voice Core tray) |
| `admin_only` | Must be approved by admin, not automatable |
| `blocked` | Never execute |

## Integration Points

- `CommandProposalService` (Milestone D) calls `classifyCommand()` before creating a proposal
- Voice Core approval tray surfaces `required`/`admin_only` proposals
- `WorkspaceControllerService` validation commands are pre-classified
- Settings page shows policy report

## Adding Custom Patterns

```typescript
commandPolicyService.addPolicy({
  id: 'my-policy',
  pattern: /my-risky-command/i,
  riskClass: 'high',
  category: 'unknown',
  approvalRequirement: 'required',
  description: 'My custom risky command',
});
```

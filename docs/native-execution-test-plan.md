# Native Execution Bridge — Test Plan

## Overview

This document covers the test cases for the Native Execution Bridge feature.
Since the project does not have a test framework (no vitest/jest), these are
manual verification steps and service self-check procedures.

## Test Categories

### 1. Allowlist Enforcement

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1.1 | Allowlisted command succeeds | Run `npm run lint` through native bridge | exit_code=0, stdout contains lint output |
| 1.2 | Unknown command rejected | Try running `echo hello` | `allowed: false`, error: "not in the allowlist" |
| 1.3 | Destructive command rejected | Try running `rm -rf /` | `allowed: false`, error: "Blocked: this executable is not allowed" |
| 1.4 | `del` rejected | Try `del /F something` | Blocked executable |
| 1.5 | `curl` rejected | Try `curl https://example.com` | Blocked executable |
| 1.6 | `git push --force` rejected | Try `git push --force origin main` | Not in allowlist (only specific git commands allowed) |
| 1.7 | `npm install` rejected | Try `npm install lodash` | Not in allowlist |
| 1.8 | Shell metacharacters rejected | Try program with `|` or `;` | "shell metacharacters detected" |

### 2. Command Result Capture

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 2.1 | stdout captured | Run `git status --short` | stdout contains git output |
| 2.2 | stderr captured | Run a command that produces stderr | stderr field is populated |
| 2.3 | Exit code captured | Run `npm run build` (success) | exit_code = 0 |
| 2.4 | Duration captured | Run any command | duration_ms > 0 |
| 2.5 | Failed command exit code | If lint fails | exit_code ≠ 0, succeeded = false |

### 3. Approval Flow

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 3.1 | Proposal created | Call `proposeCommand({command: 'npm', args: ['run', 'lint']})` | Proposal appears with status 'ready_to_run' (safe command) |
| 3.2 | Pending approval shown | Propose a moderate-risk command | Status = 'pending_approval' |
| 3.3 | Approve transitions status | Click Approve on pending proposal | Status → 'approved' |
| 3.4 | Reject transitions status | Click Reject on pending proposal | Status → 'rejected' |
| 3.5 | Run button appears | Approve an allowlisted command | Run button visible |
| 3.6 | Run button hidden for non-allowlisted | Approve a command not in allowlist | No Run button |

### 4. Execution Integration

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 4.1 | Execute approved command | Click Run on approved `npm run lint` | Status transitions: running → succeeded |
| 4.2 | Result stored | After execution | `getResult(id)` returns stdout/stderr/exitCode |
| 4.3 | Timeline event created | After execution | RuntimeTimeline has entry with entityId = proposalId |
| 4.4 | VoiceRuntime event emitted | After execution | tool_completed event emitted |
| 4.5 | Notification shown | After execution | Success/failure notification appears |

### 5. Web Mode Fallback

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 5.1 | Web build compiles | Run `npm run build` | No errors |
| 5.2 | Web mode doesn't crash | Navigate to /commands in web mode | Page renders, shows "unavailable" badge |
| 5.3 | Run button disabled | In web mode | No Run button visible |
| 5.4 | Bridge status shows unavailable | In web mode | Orange "Native Bridge Unavailable" badge |

### 6. Security

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 6.1 | No .env in git | Run `git diff --name-only` | No .env file |
| 6.2 | No secrets in stdout | Run any command | No API keys in output |
| 6.3 | No secrets in service code | Grep for hardcoded keys | None found |
| 6.4 | SecureKeyService placeholder | Call `storeKey()` | Returns "not implemented" |
| 6.5 | Key name validation | Call `validateKeyName('a')` | Returns invalid (too short) |
| 6.6 | Key name validation pass | Call `validateKeyName('openai-api-key')` | Returns valid |

### 7. UI Verification

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 7.1 | Commands page renders | Navigate to /commands | Page shows header, empty state, allowlist |
| 7.2 | Sidebar entry visible | Check sidebar | "Commands" entry with PlaySquare icon |
| 7.3 | Proposal card renders | Create a proposal | Card shows command, risk, status |
| 7.4 | Copy button works | Click copy on a proposal | Command text copied to clipboard |
| 7.5 | Result panel expands | Click "View result" | stdout/stderr visible in expandable panel |
| 7.6 | Risk badges correct | Create proposals with different risk levels | Correct colors: green/amber/orange/red |
| 7.7 | Voice Core unaffected | Navigate back to Console | Voice Core visualizer still works |

## Automated Pre-Commit Checks

```bash
# Must all pass before commit:
npm run lint          # tsc --noEmit — zero errors
npm run build         # Vite production build — no warnings
npm run tauri:build   # Rust + MSI/NSIS — compiles clean
```

## Desktop Launch Verification

```bash
npm run tauri:dev     # Launch desktop app
```

- App window opens at 1200x800
- Navigate to each page — no crashes
- Commands page shows native bridge status
- Console page Voice Core still renders

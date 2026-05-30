# Skill: codex-cli

**purpose:** Launch and observe Codex CLI agent sessions from inside AURA
**status:** foundation-only
**permission_class:** approval-required

## required_secrets
- None for availability check
- Codex CLI must be installed and authenticated separately

## allowed_actions
- Check if `codex` binary is available
- Display availability status in BackgroundTasksPanel

## blocked_actions
- Spawn without user approval
- Pass secrets as arguments
- Arbitrary shell via codex

## approval_policy
always-approve

## test_plan
1. Check codex CLI availability
2. Show status in Tasks panel

## memory_logging
yes

## owner
Claude (Anthropic · claude-sonnet-4-6) — Phase 3E

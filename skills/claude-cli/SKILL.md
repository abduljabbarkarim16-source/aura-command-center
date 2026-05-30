# Skill: claude-cli

**purpose:** Launch and observe Claude CLI agent sessions from inside AURA
**status:** foundation-only (availability check implemented; session spawn not yet active)
**permission_class:** approval-required

## required_secrets
- None for availability check
- Claude CLI must be installed and authenticated separately

## allowed_actions
- Check if `claude` binary is available via `check_cli_available("claude")`
- Display Claude CLI availability status in BackgroundTasksPanel
- Stream stdout/stderr from launched sessions (when spawn is enabled)
- Capture usage-limit messages and create reminders

## blocked_actions
- Spawn CLI session without user approval
- Pass secrets or API keys as CLI arguments
- Run arbitrary shell commands via Claude CLI
- Store CLI session output containing secrets

## approval_policy
always-approve — user must explicitly trigger any CLI session

## test_plan
1. Navigate to Background Tasks panel
2. AURA shows "Claude CLI: Available" or "Claude CLI: Not found"
3. (Future) User clicks "Launch session" — approval gate fires
4. (Future) Session output streams to Terminal panel

## memory_logging
yes — CLI availability and usage-limit events logged

## owner
Claude (Anthropic · claude-sonnet-4-6) — Phase 3E

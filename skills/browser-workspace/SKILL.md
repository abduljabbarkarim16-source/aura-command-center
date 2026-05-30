# Skill: browser-workspace

**purpose:** Control a browser window from inside AURA for web automation
**status:** planned (Phase 4)
**permission_class:** approval-required

## required_secrets
- None for basic browsing
- Service credentials for authenticated actions (per-service)

## allowed_actions (planned)
- Open URLs in embedded or external browser
- Read page content
- Fill forms with user approval
- Screenshot for visual context

## blocked_actions
- Submit forms with payment info without approval
- Store login credentials
- Interact with social platforms without approval
- Run JavaScript injections without audit

## approval_policy
always-approve for form submissions and destructive actions

## test_plan
Pending Phase 4 implementation

## memory_logging
yes — navigation events and errors

## owner
Claude (Anthropic · claude-sonnet-4-6) — planned Phase 4

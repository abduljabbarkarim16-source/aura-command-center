# AURA Skills Registry

Each subfolder is a skill. Skills are capability modules that AURA can activate.

## Manifest Format

Each skill has a `SKILL.md` with these required fields:

```
purpose: what this skill does
status: active | prototype | foundation-only | planned
required_secrets: list of env keys needed
allowed_actions: what this skill can do
blocked_actions: explicit prohibitions
approval_policy: none | user-confirm | always-approve
test_plan: how to verify this skill works
owner: who maintains this
memory_logging: yes | no | optional
```

## Permission Classes

| Class | Description |
|-------|-------------|
| `read-only` | Can read local state, no side effects |
| `safe` | Safe local actions, no network, no destructive ops |
| `network` | May make outbound network calls |
| `approval-required` | Must prompt user before acting |
| `blocked` | Hard block — do not implement |

## Adding a New Skill

1. Create `skills/<skill-name>/SKILL.md`
2. Implement service in `src/services/<skill-name>/`
3. Add types in `src/types/`
4. Add to `aura.capabilities.json`
5. Add test plan to SKILL.md
6. Update `skills/README.md`
7. Do not add shell execution without explicit allowlist review

## Testing Rules

- All skills with `status: active` must have a smoke test
- Skills that make API calls must have a dry-run mode
- Skills that modify files must have a preview mode
- Voice skill tests: must be manually verified by user

---

*Maintained by: Claude (Anthropic · claude-sonnet-4-6) · Phase 3E*

# AGENTS.md — AURA Agent Collaboration Rules

**Project:** AURA Command Center
**Version:** Phase 3G — Internal Agent OS (v0.4.3)
**Last updated:** 2026-05-31

---

## Identity

All agents working in this repo must include agent identity in any memory entry, bug report, or commit note:

```yaml
agent:
  name: <name>
  provider: <provider>
  model: <model-id>
  role: autonomous build agent | code reviewer | architect
  contribution_type: verified bug fix | project lesson | new feature | research
  confidence: high | medium | low
```

---

## Validation Before Coding

Before writing code:

1. Sync main:
   ```
   git fetch origin --prune
   git checkout main
   git pull origin main
   ```

2. Confirm secrets ignored:
   ```
   git check-ignore -v .env
   git check-ignore -v .env.local
   ```

3. Read memory repo bootstrap:
   `C:\Users\karim\Documents\AURA\ai-build-memory\AGENT_BOOTSTRAP_PROMPT.md`

4. Lookup memory index before debugging any issue.

5. Run baseline:
   ```
   cargo test
   npm run lint
   npm run build
   ```

---

## Branching Rules

- Create feature branches: `phase-XY-short-description`
- Never commit directly to `main`
- Merge to main with `--no-ff` only after validation passes
- One logical change per commit
- Never commit `.env`, `.env.local`, secrets, or raw audio

---

## Memory Repo Workflow

Memory repo: `C:\Users\karim\Documents\AURA\ai-build-memory`

When you fix a bug or learn a lesson:
1. Check if an entry exists in `index/error-index.json`
2. Update existing entry or create new one in `drafts/unverified-errors/`
3. After fix is confirmed, move to `errors/<category>/`
4. Run:
   ```
   python scripts/validate_entries.py
   python scripts/rebuild_index.py
   python scripts/rebuild_agent_performance.py
   ```
5. Commit memory repo separately from AURA repo

---

## Security Rules (Non-Negotiable)

- Do not print API keys in logs or responses
- Do not commit `.env` or `.env.local`
- Do not commit webhook URLs
- Do not log secrets
- Do not store raw audio permanently
- Do not silently enable always-on microphone
- Do not bypass approval gates for destructive actions
- Do not expand arbitrary shell execution beyond allowlist
- Do not install unknown repos without inspection

---

## UI QA Rules

- No overlapping buttons or notification banners
- All voice errors route to NotificationService (top-right tray)
- Transcript panel must not collide with bottom controls
- All persistent notifications stored in localStorage, capped at 500
- No inline error banners in center voice control area

---

## Voice QA Rules

- Test short speech (3–5s): must work
- Test medium speech (10–15s): must work
- Test long speech (20–30s): must not falsely return "No speech detected"
- Natural pause (1.5–2s) mid-sentence: must NOT trigger auto-stop
- Quiet environment: noise-floor calibration must set correct threshold
- Noisy environment: VAD must filter ambient noise before triggering

---

## CLI Allowlist (Tauri)

Safe binaries for `check_cli_available` and `spawn_agent_session`:
- `claude`
- `codex`

No arbitrary shell. No unknown binaries. No `rm`, `curl`, or system commands.

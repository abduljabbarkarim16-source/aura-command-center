# AURA Connection Readiness Audit

## Overview
AURA Command Center is currently in a "Foundation" state. It has the complete internal UI, routing, event bus, and safety boundaries necessary for autonomous operations, but is intentionally disconnected from all live APIs, webhook integrations, and secret storage.

This document tracks what is required to cross the threshold into "Connection-Ready Autonomous Operator" status.

## 1. What AURA Can Already Do
- Boot an interactive desktop window via Tauri.
- Enforce strict allowlists on native execution (e.g., `git`, `npm run lint`).
- Propose, queue, and execute commands safely.
- Intercept and block destructive actions (`rm`, `del`, shell metacharacters).
- Provide a Voice Core visualizer (currently hooked to mock audio frames).
- Record an immutable runtime timeline of all system events.

## 2. What is Still Mock/Dry-Run
- **Provider Adapters**: Currently validate configurations and return placeholder shapes without making HTTP requests.
- **Make.com Connector**: Plumbed internally but doesn't send webhook payloads.
- **Secure Key Storage**: Returns "not implemented" for all operations.
- **Self-Build Orchestrator**: Can plan sequences, but auto-execution is disabled.

## 3. What Needs API Keys
- `OpenAI` (Text & Realtime Voice)
- `Anthropic` (Claude)
- `Gemini` (Google)
- `ElevenLabs` (Voice TTS)
- `Antigravity` (Local Model/Custom Endpoints)

## 4. What Needs Secure Key Storage
To prevent storing the keys mentioned above in plaintext (`.env` or `localStorage`), we need an encrypted vault.
- **Target**: `tauri-plugin-stronghold` (XChaCha20-Poly1305 encrypted file).
- **Fallback**: Native OS Keyring if Stronghold proves unstable.

## 5. What Needs Make.com Webhook URLs
To bridge AURA's local capabilities with cloud integrations (e.g., Jira, Slack, Email), webhooks are required for:
- `self_build_plan_created`
- `approval_required`
- `memory_entry_created`
- `runtime_error`
- `build_completed`

## 6. What Needs Local/Native Permissions
- Tauri `fs` scope access for specific workspace directories (to read code and write plans).
- Tauri `shell` command configuration for any new native tools we add to the allowlist.

## 7. What Needs Approval Gates
The Automation Policy dictates what requires admin clicks vs what AURA does silently:
- **Silent/Automatic**: Workspace scans, dry-run validations, timeline event creation.
- **Admin Approval Required**: Push branches, merge main, execute shell commands, call external webhooks, paid API calls.

## 8. Exact Sequence to Reach Unsupervised Self-Build
1. Complete the Secure Key Storage implementation.
2. Complete Provider Adapter live-execution branches (using keys from storage).
3. Connect Make.com webhooks for outbound telemetry.
4. Implement Voice Realtime streams for audio control.
5. Relax the Automation Policy specifically for `safe` commands and local memory writes.
6. Trigger a Self-Build Goal and allow AURA to execute the full sequence with Make.com notifications serving as the "supervisory" loop.

---

## Readiness Matrix

| Capability | Status | Blocker |
|---|---|---|
| Native commands | Active (Allowlist) | None |
| Git automation | Active (Mocked Push) | Approval Policy |
| Workspace file scan | Active | None |
| Self-build orchestrator | Mocked | Policy & Keys |
| Memory repo writing | Manual only | Git automation policy |
| Installer build | Active | None |
| Release workflow | Active | None |
| Provider APIs | Dry-Run Only | API Keys + Secure Storage |
| Voice STT | Dry-Run Only | API Keys + Secure Storage |
| Voice TTS | Dry-Run Only | API Keys + Secure Storage |
| Make.com | Dry-Run Only | Webhook URLs |

# Phase 3K Self-Repair + Agent Handshake

Date: 2026-06-01
Version: v0.6.1
Branch: `phase-3k-aura-ui-visual-shell-port`

## Why This Exists

The full system diagnostic reported 7/9 because two checks were weak:

- `terminal.cargoTest` ran `cargo test` from the app root instead of `src-tauri`, so Cargo could not find `Cargo.toml`.
- `Core capabilities` passed the wrong argument key into `capabilities.can`.

The agent bridge also had two different meanings of "handshake": binary detection and real prompt response. The user expects a real prompt-response handshake.

## Implemented Behavior

- Rust commands now run `cargo` tools from `src-tauri` when `src-tauri/Cargo.toml` exists.
- Workspace fallback now prefers `agent-command-center-phase-3j` before the older `agent-command-center` folder.
- `system_diagnostic` now passes `capabilityId: voice.shortSpeech` into `capabilities.can`.
- `CliSessionService.spawnBackground()` starts a RuntimeTask-backed CLI session and returns immediately.
- `agent.handshakeAllBackground` sends real sentinel prompts to all detected CLI agents and returns session/task ids.
- `agent.sendPromptBackground` can send a user-approved prompt to Claude or Codex as a background task.
- `agent.getSession` and `agent.listSessions` let AURA inspect background agent responses later.
- `repair_last_diagnostic` analyzes the previous diagnostic, logs the repair to memory, reruns the full diagnostic, and reports the result.
- Native `append_memory_repo_event` writes only to the local `ai-build-memory/logs/agent-events.jsonl` event log when that repo exists.

## User Phrases

- "Do a full system check" runs `system_diagnostic`.
- "Fix the diagnostic issues" runs `repair_last_diagnostic`.
- "Handshake with the agents" can call `agent.handshakeAllBackground`.
- "Send this to Codex in the background" can call `agent.sendPromptBackground` after permission handling.

## Guardrails

- Only `claude` and `codex` CLI binaries are allowed.
- Background prompts still go through the Rust prompt sanitizer.
- Prompt text must not include secrets or private credentials.
- Antigravity remains planned/local-workspace coordination only; no hidden credential search.
- Memory repo writes are path-fixed and append-only to `logs/agent-events.jsonl`.


# Phase 3G — Agent OS Research & Design Rationale

**Date:** 2026-05-31 · **Agent:** Claude (Anthropic · claude-opus-4-8)

> Synthesis from established agent-tooling patterns (knowledge cutoff Jan 2026),
> mapped to the concrete decisions made in this sprint. Per the brief, no
> unknown repos were cloned or run inside the main project; any future
> exploratory clones belong in `C:\Users\karim\Documents\AURA\research\`.

---

## 1. Claude Code CLI integration patterns

- **Non-interactive / headless:** `claude --print "<prompt>"` (a.k.a. `-p`) returns a single completion and exits — ideal for a bridge "tiny prompt". `--output-format json` gives structured results when available.
- **Permissions:** Claude Code gates tool use; for unattended runs people use a permission-mode flag, but that should be opt-in and scoped, never the default.
- **MCP:** Claude Code can attach MCP servers for tools/resources; a future AURA could expose its own tools to Claude via MCP rather than scraping stdout.
- **AURA decision:** the Claude bridge uses detection (`--help`/version) + an approval-gated `--print` sentinel ("AURA_CLAUDE_BRIDGE_OK"). We parse stdout for the sentinel and for usage-limit phrases. We do **not** grant file-edit or pass repo source. See `ClaudeBridgeService`.

## 2. Codex CLI non-interactive usage

- **`codex exec "<prompt>"`** is the non-interactive entry point (vs the interactive TUI). Output goes to stdout.
- **Windows:** the binary is typically a `.cmd`/`.ps1` shim; spawning must go through `cmd.exe /C` (handled in the Rust layer, Phase 3H) or the shim isn't found.
- **AURA decision:** the Codex bridge mirrors Claude — detect, then approval-gated `codex exec` sentinel. `.cmd` spawn + 60s timeout + usage-limit detection live in Rust. See `CodexBridgeService`, `src-tauri/src/cli_commands.rs`.

## 3. AGENTS.md patterns

- A repo-root `AGENTS.md` is becoming the lingua franca for telling coding agents how to behave (build/test commands, conventions, do/don'ts). It's tool-agnostic (Codex, Claude Code, others read it).
- **AURA decision:** `AGENTS.md` is kept current (version header synced to Phase 3G). It encodes the safety rules (allowlist-only, no secrets, approval gates) that both the in-app dispatch and external CLIs should respect.

## 4. MCP connector / plugin UX

- Good MCP UX shows: which servers are connected, what tools each exposes, auth state, and a per-tool risk/approval surface. Users want to see *what an agent can call* before it calls it.
- **AURA decision:** the Capabilities panel + Agent Bridges panel are AURA's version of this — every tool/capability is enumerable with status and evidence, and bridges show connection state. This is the "see before it calls" principle applied internally.

## 5. OpenHands / OpenDevin tool architecture

- These separate **agent loop** (plan → act → observe) from a small set of **typed actions** (run command, edit file, browse) executed in a sandbox, with observations fed back. Safety comes from the sandbox boundary, not from trusting the model.
- **AURA decision:** the same shape — `useConversationLoop`/`useConsoleConversation` are the loop; `ToolRegistryService` is the typed-action set; the **Rust allowlist is the sandbox boundary**. The model never executes arbitrary shell; it selects from a catalog.

## 6. Claude Code / Codex UI layouts

- Effective coding-agent UIs: a centered conversation/log stream, a compact composer (not a giant box), and a right rail for artifacts/tasks/tools/diff. Status is ambient, not a wall of chips.
- **AURA decision:** the console was rebuilt to exactly this — centered stream, compact composer with small quick-prompts, right panel (Tools / Bridges / Caps / Gaps / Mem / Test). Voice Core was decluttered to an orb-centric view. Mock data was removed so the stream is live.

## 7. Agent bridge protocols

- A robust bridge tracks: detected, authenticated, version, supported modes, last handshake, last error, usage-limit/login state. Treat "binary present" and "authenticated" as distinct.
- **AURA decision:** `AgentBridgeState` encodes exactly these fields; connection is derived (`connected` / `auth-required` / `missing` / `rate-limited` / `planned`). Authentication is only asserted after a successful sentinel run, never assumed.

## 8. Memory & thread compaction

- Scalable agent memory separates **durable facts** (small, curated, injected) from **transcript** (large, compacted). Compaction summarizes old turns and keeps a few verbatim; LLM-assisted summaries are better but a heuristic is a safe floor.
- Injected memory must be framed as **untrusted** so it can't act as instructions (prompt-injection hygiene).
- **AURA decision:** `AuraMemoryService` (facts, "untrusted user-provided" framing) + `SessionThreadService` (rolling summary, heuristic compaction, last-N verbatim). `memory.compaction` is registered `degraded` — LLM compaction is the documented next step.

## 9. Tool permission models

- A useful gradient: read-only auto-run → ask for writes/medium → block destructive/unknown always. Modes should be **visible** and **logged**, and a hard floor (secrets, destructive, unknown binaries) must never be bypassable by any mode.
- **AURA decision:** `PermissionModeService` implements Safe Auto / Approval / Admin Bypass / Locked, logs every decision, and treats the Rust allowlist as the immovable floor. There is intentionally no true unrestricted bypass.

## 10. Local self-improving agent safety

- Safe self-improvement = **plan, don't execute autonomously**. Capture the gap, propose a task/branch/handoff, require human approval before any build or external-agent run. Keep changes typechecked and reversible; never let the agent widen its own permissions silently.
- **AURA decision:** `CapabilityGapPlannerService` produces a plan + handoff prompt and records a memory entry, then stops. Execution stays behind approval (bridge tiny-prompts are approval-gated; no auto file edits). This sprint deliberately proves *controlled* internal operation before any autonomous self-modification.

---

## Net mapping

| Pattern | AURA artifact |
|---|---|
| Headless CLI bridges | `ClaudeBridgeService`, `CodexBridgeService`, Rust `cli_commands.rs` |
| Sandbox boundary | Rust allowlist (`commands.rs`) |
| Typed action set + loop | `ToolRegistryService` + `useConsoleConversation` / `useConversationLoop` |
| See-before-call UX | `CapabilitiesPanel`, `AgentBridgesPanel` |
| Durable vs transcript memory | `AuraMemoryService` + `SessionThreadService` |
| Visible permission gradient | `PermissionModeService` + selector |
| Plan-not-execute self-improvement | `CapabilityGapPlannerService` |
| Verify without trust | `AuraSelfTestService` |

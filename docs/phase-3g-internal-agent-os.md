# Phase 3G — Internal Agent Operating System

**Branch:** `phase-3g-internal-agent-operating-system`
**Base commit:** `c871b88` (Merge Phase 3H: Codex CLI fix and AURA tool dispatch)
**Audit date:** 2026-05-31
**Auditing agent:** Claude (Anthropic · claude-opus-4-8)

> This is the Milestone 1 current-state audit. It is written from reading the
> actual source on `main`, not from prior agent reports. Where a capability is
> claimed, the source file and line are cited so the claim can be checked.

---

## 0. Checkpoint reconciliation (important)

The build brief's "current known checkpoint" is **stale**. Reality on `main`:

| Brief says | Actual `main` state |
|---|---|
| Latest Phase 3F QA merge `17f45ed` is the tip | `17f45ed` is 7 commits back |
| `c789b792` (Phase 3H) "exists, may not be on main" | **Already merged to main** via `c871b88` |
| Current phase ≈ 3F/3H | Main already contains **Phase 3G** (`de30fdb` "AURA intelligence, memory, and personality") **and Phase 3H** (`c789b79`) |
| Version | `0.4.2` across package.json, Cargo.toml, tauri.conf.json |

**c789b792 confirmation:** full hash `c789b7927c1eb323c3d0a1cb6adf5e223f8acb51`, contained in branches `main` and `phase-3h-codex-fix-tool-dispatch`. **No merge needed — it is already on main.**

**Authorship:** all 94 commits are authored as "AURA Agent" — Git cannot distinguish Claude vs Codex work by author. The Phase 3H commit message ("fix Codex CLI spawn") indicates Codex-integration work landed and is on main. Reviewed by content, not author.

**Phase label decision:** because `main` already carries "Phase 3G (intelligence/memory/personality)" and "Phase 3H", but Milestone 11 of the brief explicitly instructs labeling this sprint *"internal agent OS / Phase 3G"*, this sprint is labeled **Phase 3G — Internal Agent Operating System** and treated as the continuation of the 3G arc. Version will bump to `0.4.3` on completion. Earlier 3G/3H work is left intact.

**Secrets:** `.gitignore:7-8` ignores `.env` and `.env.local`; neither is tracked (`git ls-files` shows none). ✅

**Baseline:** `npm run lint` (`tsc --noEmit`) → **exit 0, clean**. (cargo test / full tauri build deferred to Milestone 16 validation to avoid burning time before changes exist.)

---

## 1. What already exists (do NOT rebuild)

The "Phase 3G intelligence/memory/personality" and "Phase 3H tool dispatch" merges
already shipped a large amount of the infrastructure this brief asks to "create".
Verified by reading source:

### Tool registry — REAL
`src/services/tools/ToolRegistryService.ts`
- Catalog of 10 tools: `terminal.gitStatus/gitBranch/gitLog/npmLint/npmBuild/cargoTest`, `cli.claudeCheck/codexCheck/claudeRunTiny/codexRunTiny`.
- Each tool has `risk`, `requiresApproval`, `allowedInputKeys`, `blockedInputPatterns`, `timeoutMs`.
- `execute()` validates inputs, gates approval, records `ToolExecution` history (subscribable), routes terminal tools to Rust `run_allowed_command`, CLI tools to `cliDiscoveryService` / `cliSessionService`.

### Tool dispatch (OpenAI function calling) — REAL, voice-only
`src/services/tools/AuraToolDispatchService.ts`
- Converts `ToolDefinition` → OpenAI function schema (`.`→`__`), parses `tool_call` responses, executes, feeds result back via `openai_chat_tool_result` for a natural reply.
- **Wired into the voice loop** (`useConversationLoop.ts:412-426`, default `toolDispatchEnabled=true`).
- **Gap:** `getToolSchemas({includeApprovalRequired:false})` is the only call site, so medium-risk tools are filtered out *before the model sees them* — the `onApprovalNeeded` path (`AuraToolDispatchService.ts:158`) is currently unreachable.

### Rust backend — REAL, safety-hardened
`src-tauri/src/`
- `commands.rs`: `run_allowed_command` runs in `get_project_root()` which resolves (1) persisted AppData `workspace.txt` → (2) walk-up for repo markers → (3) cwd fallback. Allowlist + `is_blocked_executable` + `contains_metacharacters`; unit tests reject `git reset --hard` and metacharacters.
- `voice_commands.rs`: `openai_chat_with_tools`, `openai_chat_tool_result`, `openai_extract_memory`, plus STT/chat/TTS.
- `cli_commands.rs`: `spawn_agent_session`, `get_cli_help`, allowlist + prompt sanitiser + usage-limit detection (`detect_usage_limit`).

### Memory — REAL, persistent
`src/services/memory/AuraMemoryService.ts` (+ `src/types/aura-memory.ts`)
- localStorage-backed (survives restart), personal/task categories, auto/explicit sources, pin/archive/delete, dedup, `buildContextString()` that injects memories into the system prompt with an explicit "untrusted user-provided facts" guard. Subscribable.

### Personality / system prompt — REAL
`src/services/personality/AuraPersonalityService.ts`
- Builds the dynamic system prompt: base identity + preset/custom + **structured `userName` slot** (`setUserName`, persisted, injected as "The user's name is X") + injected memories + tool-awareness + style suffix.
- Tool-awareness block lists terminal/cli tools (not memory/capabilities — they don't exist yet).

### CLI discovery — REAL
`src/services/agents/CliDiscoveryService.ts` — `discover()` calls Rust `check_cli_available` + `get_cli_help`, caches 5 min, infers `--print` / non-interactive / `exec` support. Plus `ClaudeCliService.ts`, `CliSessionService.ts`, `AgentSessionService.ts`.

### UI surfaces that exist
`BackgroundTasksPanel.tsx`, `AuraMemoryPanel.tsx`, `AuraPersonalityPanel.tsx`, `TerminalPanel.tsx`, `OperatorRightPanel.tsx`, `AuraCommandConsole.tsx`, `AuraComposer.tsx`, `AuraVoiceCore.tsx`, plus pages `Console/Memory/Agents/ToolLogs/...`.

---

## 2. The 10 audit questions

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | NL request → choose a tool? | **Yes, in voice.** Function calling picks a tool. | `AuraToolDispatchService.chatWithTools` |
| 2 | `terminal.gitStatus` from its own console? | **No.** Console renders mock messages; composer `onSend` not wired. Works in voice only. | `Console.tsx:31`, `AuraCommandConsole.tsx:200` |
| 3 | `terminal.npmLint` from console? | **No** (same reason). Tool itself works. | same |
| 4 | `cli.claudeCheck` from console? | **No** from console; tool + backend work. | `ToolRegistryService.ts:260` |
| 5 | `cli.codexCheck` from console? | **No** from console; tool + backend work. | `ToolRegistryService.ts:271` |
| 6 | Run a tiny Claude CLI prompt? | **Yes, plumbing exists** (`cli.claudeRunTiny` → `cliSessionService.spawn` → Rust `spawn_agent_session`), medium-risk/approval. Unreachable via model (see dispatch gap). | `ToolRegistryService.ts:283` |
| 7 | Run a tiny Codex CLI prompt? | **Yes, plumbing exists** (`codex exec`, Windows `.cmd` handled in 3H). | `cli_commands.rs` |
| 8 | Update memory? | **Yes** (`auraMemoryService.add`), but only via voice auto-extract / "Remember" button — no `memory.*` tool the model can call. | `AuraMemoryService.ts:68` |
| 9 | Remember identity across restart? | **Partially.** `personality.userName` + memories persist in localStorage. No structured profile (preferred name, prefs) and no console path to set it. | `AuraPersonalityService.ts:85` |
| 10 | State what it cannot do / gap report? | **No.** No capability registry, no gap service. `aura.capabilities.json` is stale static JSON (v0.3.5/Phase 3E, `spawnReady:false`). | `aura.capabilities.json` |

---

## 3. Gaps to close this sprint (the real work)

1. **Console cannot run real prompts** — THE linchpin. `Console.tsx` feeds `mockMessages`; `<AuraComposer/>` gets no `onSend`. Voice has real dispatch; console does not. → M5/M10.
2. **No capability registry** — `capabilities.ts`, `CapabilityRegistryService`, `CapabilityGapService`, `CapabilitiesPanel` don't exist; manifest is stale. → M2.
3. **No `memory.*` / `capabilities.*` tools** — model can't remember/recall/query capabilities via function calling. → M5.
4. **Memory is freeform** — no structured user profile. → M3.
5. **No session/thread continuity service.** → M4.
6. **No agent bridge layer** (`AgentBridgeService`/Claude/Codex/Antigravity) over the existing CLI services. → M6.
7. **No self-test harness/panel.** → M8.
8. **Voice Core clutter** — 4-chip status strip (Memory/Relay/Tools/Voice) + "Mission" box at top. → M9.
9. **Stale manifest/docs** (capabilities.json 0.3.5/3E). → M11.
10. **No explicit permission-mode model** surfaced in UI. → M12.
11. **No capability gap planner.** → M13.
12. **Dispatch approval gap** — medium-risk tools filtered before the model sees them (M5 fix).

---

## 4. Architecture decisions for this sprint

- **Reuse, don't rebuild.** New services wrap existing ones: `CapabilityRegistryService` reads live state from `toolRegistryService` / `cliDiscoveryService` / `auraMemoryService`; agent bridges wrap `cliDiscoveryService`/`cliSessionService`.
- **Console testing path** is built as a text-mode sibling of the voice loop, calling the *same* `auraToolDispatchService.chatWithTools` — so console and voice share one dispatch brain.
- **Capability state is evidence-based.** A capability is `available` only when a real test (tool exec, CLI discovery, persistence round-trip) has confirmed it — never asserted blindly. This directly serves "do not claim AURA can do something unless tested."
- **No new unrestricted execution.** All execution still routes through the existing allowlisted Rust layer. Permission modes only relax *approval prompts* for already-allowlisted low/medium tools — never the allowlist itself.

(Per-milestone results appended below as work completes.)

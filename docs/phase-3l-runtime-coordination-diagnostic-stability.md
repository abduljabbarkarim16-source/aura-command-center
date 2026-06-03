# Phase 3L — Runtime Coordination & Diagnostic Stability

## Root-Cause Audit

### 1. What triggers full system diagnostics?

There is **no unified diagnostic runner** in the current codebase. "Full system diagnostics" are triggered manually in two ways:

- **TerminalPanel** (`src/components/operator/TerminalPanel.tsx`): The user (or AURA via tool dispatch) clicks individual command buttons (git status, npm lint, cargo test, etc.). Each fires a separate `invoke('run_allowed_command', ...)` Tauri call.
- **ToolRegistryService** (`src/services/tools/ToolRegistryService.ts`): AURA can autonomously call tools via function calling (`chatWithTools`). Tools like `terminal.gitStatus`, `terminal.npmLint`, `terminal.cargoTest`, `cli.claudeCheck`, `cli.codexCheck`, and `capabilities.test` are all executed through `ToolRegistryService.execute()`.
- **CapabilityRegistryService**: The `capabilities.test` tool runs per-capability probes which themselves call `invoke('run_allowed_command', ...)` and `cliDiscoveryService.discover()`.

When a user says "run a full diagnostic" or AURA decides to run multiple checks, the tool dispatch loop fires **multiple tools sequentially or in rapid succession**, each creating a separate `RuntimeTask`, each calling Rust `run_allowed_command` synchronously.

### 2. Which commands run?

From `ALLOWED_COMMANDS` in `commands.rs` and `TOOL_CATALOG` in `ToolRegistryService.ts`:

| Tool ID | Command | Duration |
|---|---|---|
| `terminal.gitStatus` | `git status --short` | <1s |
| `terminal.gitBranch` | `git branch --show-current` | <1s |
| `terminal.gitLog` | `git log --oneline -20` | <1s |
| `terminal.npmLint` | `npm run lint` | 5–30s |
| `terminal.npmBuild` | `npm run build` | 20–120s |
| `terminal.cargoTest` | `cargo test` | 10–120s |
| `cli.claudeCheck` | `where claude` + `claude --help` | 2–10s |
| `cli.codexCheck` | `where codex` + `codex --help` | 2–10s |
| `capabilities.test` | various | varies |

### 3. Are they sequential or parallel?

**Sequential within `chatWithTools`** — the tool dispatch loop calls one tool at a time, waits for the result, sends it back to OpenAI, then the model may request another.

**However**, the TerminalPanel allows the user to click multiple buttons simultaneously, which fires parallel `invoke()` calls. This is the more dangerous case — multiple `run_allowed_command` calls executing concurrently, each spawning `cmd.exe` processes and each triggering `RuntimeTask` log events that flood React state.

### 4. Are they run on the UI thread or backend?

The commands are executed in the **Rust Tauri backend** via `std::process::Command`. However, `run_allowed_command` is a **synchronous** Tauri command (`pub fn run_allowed_command(...)` — not `pub async fn`). This means:

- The Rust side blocks the thread until the command completes.
- The JavaScript `invoke()` call is async and properly awaits the result.
- But **Tauri's thread pool** has limited concurrency. If multiple synchronous commands run simultaneously (especially `npm run lint` or `cargo test` which take 10–120s), the thread pool can saturate, causing other IPC calls (including voice-related ones) to queue behind them.

**This is a critical root cause.** When diagnostics are running, voice commands (STT, TTS, chat) contend for the same Tauri IPC thread pool.

### 5. Are logs streamed too frequently?

**Yes.** `RuntimeTaskService.appendLog()` calls `this.saveTasks()` (writes to `localStorage`) and `this.emit('task_log_appended', task)` on **every single log line**. During a diagnostic run with many tools:

- Each tool execution triggers at least 2 log events (start + complete/fail)
- Each log event calls `JSON.stringify(allTasks)` + `localStorage.setItem()`
- Each log event notifies all subscribers, causing React re-renders
- `localStorage.setItem()` is synchronous and can block the main thread

With 8+ diagnostic steps, this creates 16+ synchronous `localStorage` writes and 16+ React state updates in rapid succession — a **setState storm**.

### 6. Can the task be cancelled?

`RuntimeTaskService` has a `cancelTask()` method, but:
- The underlying `std::process::Command` in Rust uses `.output()` (blocking wait), not a spawned child with `try_wait()` polling.
- `run_allowed_command` does not accept a cancellation token.
- There is no way to abort a running command from the frontend.
- Only `spawn_agent_session` in `cli_commands.rs` implements timeout and kill logic.

**Effectively: no, diagnostic commands cannot be cancelled.**

### 7. Does diagnostic mode change the same state used by voice?

**Indirectly, yes.** The shared state points:

1. **React rendering**: `RuntimeTaskService` subscribers trigger re-renders in components like `RuntimeTaskDrawer`, `BackgroundTasksPanel`, and `RuntimeTaskHistoryPanel`. These re-renders compete with voice-related state updates (`loopPhase`, `liveTranscript`, `vadPhase`, `micLevel`).

2. **Tauri IPC thread pool**: Diagnostic commands (`run_allowed_command`) and voice commands (`openai_transcribe_audio`, `openai_chat_response`, `openai_synthesize_speech`) share the same IPC channel. Long-running diagnostic commands can starve voice calls.

3. **No voice-diagnostic coordination**: There is no mechanism to tell the voice loop "diagnostics are running, don't interpret UI glitches as user intent." The voice loop has no awareness of background tasks at all.

### 8. Can old voice responses still speak after new user speech begins?

**Yes.** This is a confirmed bug. The current architecture has no `turnId`-based invalidation:

- `processTranscript()` in `useConversationLoop.ts` is an `async` function that runs to completion once started.
- If the user speaks again while AURA is still processing an older transcript, the old `processTranscript()` continues running and will eventually call `synthesizeSpeech()` and `play()`.
- The `runningRef.current` flag is a simple boolean — it prevents concurrent starts but does NOT invalidate stale turns.
- In `PATH 1 (Fast mode)`: The old fast reply's `audio.onended` callback can call `startListeningCycle()` even while a newer transcript is being processed.
- The barge-in analyser pauses old audio but doesn't prevent the old chat response from being spoken later.

### 9. Why CMD windows appear.

**Root cause identified in `commands.rs` lines 225-236 and `cli_commands.rs` lines 181-190.**

On Windows, when `Command::new("cmd")` is used (for npm/.cmd resolution), the default behavior creates a visible console window. The fix is to use the Windows-specific `CREATE_NO_WINDOW` flag via `std::os::windows::process::CommandExt`.

Affected spawn sites:
1. `commands.rs:226` — `Command::new("cmd")` for npm commands
2. `commands.rs:232` — `Command::new(&program)` for git/cargo (these don't show CMD but could flash on some systems)
3. `commands.rs:304` — `Command::new(check_cmd)` for `where` checks
4. `cli_commands.rs:182` — `Command::new("cmd")` for claude/codex CLI spawning
5. `cli_commands.rs:334` — `Command::new("cmd")` for `--help` calls
6. `cli_commands.rs:307` — `Command::new(check_cmd)` for `where` checks

All 6 sites need `CREATE_NO_WINDOW` applied.

### 10. Why the Speak button becomes delayed/sticky.

Multiple contributing factors:

1. **Main thread contention**: `localStorage.setItem()` in `RuntimeTaskService.saveTasks()` is synchronous and called on every log append. During a diagnostic burst, this blocks the main thread.

2. **React render storms**: Each `RuntimeTaskService` event triggers subscriber callbacks → React `setState` → re-render. With multiple simultaneous diagnostic tasks, the render queue saturates.

3. **No click debounce**: The Speak/Start/Finish buttons in `AuraVoiceCore.tsx` have no debounce. A double-click on "Speak" during a sluggish render can fire `handleOneShotStart` twice.

4. **IPC contention**: While Tauri diagnostic commands are running, voice-related IPC calls (transcribe, chat, TTS) may be queued behind them, making the entire voice pipeline feel delayed even after the button responds.

5. **No transition guard**: There is no guard preventing button clicks during phase transitions. The `disabled` prop on the Speak button checks `oneShotPhase !== 'idle'`, but race conditions during rapid state changes can allow double-firing.

---

## Summary of Required Fixes

| Issue | Fix |
|---|---|
| CMD windows visible | Add `CREATE_NO_WINDOW` flag to all `Command::new("cmd")` calls |
| Stale voice responses | Implement `VoiceTurnCoordinator` with turn invalidation |
| UI freeze during diagnostics | Create `DiagnosticTaskRunner` that runs as a single background task with throttled UI updates |
| No runtime coordination | Create `RuntimeOrchestratorService` to mediate voice vs. diagnostic state |
| Speak button sticky | Add click debounce + transition guards |
| Log storms | Throttle `RuntimeTaskService.appendLog()` → batch `saveTasks()` + `emit()` |
| IPC contention | Make `run_allowed_command` async in Rust (use `tokio::spawn_blocking`) |
| No cancellation | Add cancellation support to diagnostic runs |
| No internal console | Create `InternalDiagnosticConsole` component |
| Voice/diagnostic state coupling | Separate diagnostic state from voice phase state |

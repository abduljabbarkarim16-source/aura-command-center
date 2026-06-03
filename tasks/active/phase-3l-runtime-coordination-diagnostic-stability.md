# Phase 3L — Runtime Coordination & Diagnostic Stability

## Status: IN PROGRESS

---

## MILESTONE 1 — Root-cause audit
- [x] Inspected `useConversationLoop.ts` (708 lines)
- [x] Inspected `useSegmentedVoiceSession.ts` (referenced, segmented VAD)
- [x] Inspected `RuntimeTaskService.ts` (201 lines) — localStorage on every log, emit on every event
- [x] Inspected `RuntimeTaskContinuationService.ts` (listed, 1.4KB)
- [x] Inspected `ToolRegistryService.ts` (573 lines) — TOOL_CATALOG with 20 tools
- [x] Inspected `AuraToolDispatchService.ts` (219 lines) — function-calling tool loop
- [x] Inspected `TerminalPanel.tsx` (314 lines) — manual command buttons
- [x] Inspected system diagnostic trigger path — no unified runner exists
- [x] Inspected CLI bridge services (`CliSessionService`, `CliDiscoveryService`)
- [x] Inspected `commands.rs` (610 lines) — `run_allowed_command` synchronous, cmd.exe without CREATE_NO_WINDOW
- [x] Inspected `cli_commands.rs` (398 lines) — `spawn_agent_session` with cmd.exe, no hidden window
- [x] Inspected `AuraVoiceCore.tsx` (901 lines) — no click debounce on Speak
- [x] Created `docs/phase-3l-runtime-coordination-diagnostic-stability.md`
- [x] Documented all 10 audit questions

## MILESTONE 2 — RuntimeOrchestratorService
- [ ] Create `src/services/runtime/RuntimeOrchestratorService.ts`
- [ ] Implement voice/diagnostic state tracking
- [ ] Implement `canAuraSpeak()`, `markUserSpeaking()`, etc.

## MILESTONE 3 — VoiceTurnCoordinator
- [ ] Create `src/services/voice/VoiceTurnCoordinator.ts`
- [ ] Integrate into `useConversationLoop.ts`
- [ ] Stale turn prevention

## MILESTONE 4 — DiagnosticTaskRunner
- [ ] Create `src/services/diagnostics/DiagnosticTaskRunner.ts`
- [ ] Run all checks as child RuntimeTasks
- [ ] Throttle log updates

## MILESTONE 5 — Hide CMD windows
- [ ] Add `CREATE_NO_WINDOW` to `commands.rs`
- [ ] Add `CREATE_NO_WINDOW` to `cli_commands.rs`
- [ ] Verify no visible windows

## MILESTONE 6 — Internal diagnostic console
- [ ] Create `InternalDiagnosticConsole.tsx`
- [ ] Integrate into operator panel

## MILESTONE 7 — UI responsiveness protection
- [ ] Add click debounce to Speak/Finish buttons
- [ ] Throttle RuntimeTask log updates
- [ ] Transition guards

## MILESTONE 8 — Voice vs diagnostic state separation
- [ ] Separate state machines
- [ ] Combined visual state

## MILESTONE 9 — Smooth callback policy
- [ ] Queue spoken callbacks
- [ ] Wait until user not speaking

## MILESTONE 10 — Testing harness
- [ ] Create `AuraRuntimeCoordinationSelfTest.ts`
- [ ] 10 test cases

## MILESTONE 11 — Memory update
- [ ] Update ai-build-memory
- [ ] Run validation scripts

## MILESTONE 12 — Version and documentation
- [ ] Bump version to 0.6.1
- [ ] Update docs
- [ ] Smoke test doc

## MILESTONE 13 — Validation and installer
- [ ] cargo test
- [ ] npm run lint
- [ ] npm run build
- [ ] npm run tauri:build

## MILESTONE 14 — Commit, push, report
- [ ] Final commit
- [ ] Push branch
- [ ] Final report

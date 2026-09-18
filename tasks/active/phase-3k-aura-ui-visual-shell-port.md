# Phase 3K Aura UI Visual Shell Port

Date: 2026-06-01
Branch: phase-3k-aura-ui-visual-shell-port
Agent: Codex / OpenAI / GPT-5

## Objective

Port the Aura-ui visual shell into the real AURA desktop runtime without replacing AURA's Tauri, voice, RuntimeTask, tool-dispatch, memory, or operator systems.

## Ground Rules

- Active AURA repo: `C:\Users\karim\Documents\AURA\agent-command-center-phase-3j`.
- Prototype repo: `C:\Users\karim\Documents\AURA\Aura-ui`.
- No localhost/browser visual QA in this run; the user will perform visual QA from the installed build.
- Do not fake terminal output, diagnostics, working states, or completed tasks.
- Do not replace AURA's existing STT/TTS, RuntimeTask, tool, memory, permission, notification, or Tauri systems.
- End by building and launching the v0.6.0 installer wizard if validation succeeds.

## Stage Plan

1. Resolve active repo and baseline state.
2. Audit AURA, Aura-ui, and memory guidance.
3. Create branch and active task plan.
4. Write integration mapping document.
5. Add visual shell types and state service.
6. Port canvas, orb, terminal overlay, and diagram renderer.
7. Add visual tools and prompt/tool awareness.
8. Integrate visual shell into Voice Core without voice/runtime regression.
9. Preserve right panel and version/release identity.
10. Update docs and memory repo.
11. Run cargo, lint, build, and Tauri build validations.
12. Launch installer wizard for user testing.
13. Commit, push, and report if validation passes.

## Log

### 2026-06-01 - Repo Resolution

- Compared `agent-command-center` and `agent-command-center-phase-3j`.
- Chose `agent-command-center-phase-3j` because it is the newer active app at v0.5.5 / Phase 3K+ and contains the current voice/runtime work.
- Confirmed `agent-command-center` is older at v0.5.0 / Phase 3H.
- Confirmed `.env` and `.env.local` are ignored.
- Cloned missing Aura-ui prototype from `https://github.com/abduljabbarkarim16-source/Aura-ui`.
- Stopped the temporary Vite dev server from the earlier inspection.
- Created branch `phase-3k-aura-ui-visual-shell-port`.

### 2026-06-01 - Baseline Validation

- `npm run lint`: passed.
- `npm run build`: passed with existing Vite chunk/dynamic-import warnings.
- `cargo test`: first run timed out at 3 minutes while waiting on/compiling artifacts; rerun with longer timeout passed.
- Cargo result: 8 tests passed, 0 failed.

### 2026-06-01 - Integration Mapping

- Created `docs/phase-3k-aura-ui-visual-shell-port.md`.
- Documented Aura-ui visual behavior, AURA runtime systems to preserve, items to port, items not to port, visual state mapping, terminal visual rules, diagram model, component changes, visual tools, and dependency order.
- Key decision: visual shell must be driven by real voice/runtime/tool state, not by Aura-ui prototype server logic or simulated terminal diagnostics.

### 2026-06-01 - Visual Shell Implementation

- Added visual shell types, command state service, runtime-derived visual hook, canvas, orb, diagram renderer, and terminal overlay.
- Integrated the visual shell into Voice Core while keeping the existing voice controls and operator right panel.
- Added `visual.showDiagram`, `visual.closeDiagram`, `visual.showTerminalVisual`, `visual.closeTerminalVisual`, `visual.setCanvasTheme`, `visual.focusTask`, and `visual.resetCanvas`.
- Updated tool dispatch and personality guidance so AURA can call visual tools without pretending terminal output was executed.
- Updated package, Tauri, Cargo, README, app version constants, changelog, and capability manifest to v0.6.0 / Phase 3K Visual Shell.
- Added `docs/phase-3k-visual-shell-smoke-test.md` for installed-app manual QA.
- `npm run lint`: passed after integration.
- `npm run build`: passed before version/doc updates; full final validation still pending.

### 2026-06-01 - Final Validation

- `cargo test`: passed. 8 tests passed, 0 failed.
- `npm run lint`: passed.
- `npm run build`: passed with existing Vite chunk/dynamic-import warnings.
- `npm run tauri:build`: passed.
- Installer produced: `src-tauri\target\release\bundle\nsis\AURA Command Center_0.6.0_x64-setup.exe`.
- MSI produced: `src-tauri\target\release\bundle\msi\AURA Command Center_0.6.0_x64_en-US.msi`.

## Current Status

Stage 12 in progress. Next: launch the v0.6.0 NSIS installer wizard for user testing, then commit and push.

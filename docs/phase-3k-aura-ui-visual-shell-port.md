# Phase 3K Aura UI Visual Shell Port

Date: 2026-06-01
Branch: `phase-3k-aura-ui-visual-shell-port`
Agent: Codex / OpenAI / GPT-5

## Scope

Port the Aura-ui visual identity into the real AURA Command Center desktop runtime. The goal is a canvas-first, orb-first default screen while preserving AURA's existing voice, Tauri, RuntimeTask, tool-dispatch, memory, notification, permission, and operator panel systems.

Active implementation repo:

`C:\Users\karim\Documents\AURA\agent-command-center-phase-3j`

Prototype source repo:

`C:\Users\karim\Documents\AURA\Aura-ui`

## What Aura-ui Does Visually

Aura-ui is a focused visual/interaction prototype:

- Opens directly into a full-screen voice operator shell.
- Uses a full-screen animated digital canvas behind the interface.
- Keeps the voice orb as the central presence.
- Moves/shrinks the orb when the canvas is used for diagrams.
- Shows structured diagrams on the canvas with node cards, colors, icons, and layout modes.
- Shows a floating terminal panel as a temporary visual element.
- Uses state-driven screen modes: idle/ambient, listening, thinking, speaking, working, diagram.
- Treats the canvas as something the AI can control.

## What AURA Already Does Better Technically

AURA Command Center already has real desktop/runtime systems that must remain authoritative:

- Tauri/Rust backend and installer pipeline.
- OpenAI STT/chat/TTS request pipeline through existing services.
- Segmented voice sessions, VAD, long-speech handling, and current voice fixes.
- RuntimeTaskService for real task lifecycle and logs.
- ToolRegistryService and AuraToolDispatchService for model-callable tools.
- Permission modes and approval gating.
- Notification and transcript persistence.
- Memory/profile/capability/recipe systems.
- Right-side operator panel with Activity, Tasks, Terminal, Logs, Memory, Capabilities, Recipes, Notifications, and Details.
- Claude/Codex bridge work and safe terminal command path.

## Aura-ui Items To Port

- `LiveCanvas` visual shell concept.
- `AuraVoiceVisualizer` orb behavior concept.
- `CanvasMode` model, expanded for AURA states.
- `DiagramData` model, expanded with AURA-compatible node status, emoji, and bento layout.
- Diagram rendering model.
- Terminal popup visual model.
- Orb-first layout behavior.
- AI-controlled visual tool schema.
- Compact voice-first layout direction.

## Aura-ui Items Not To Port

- Express server as production backend.
- `/api/chat` as the production reasoning path.
- Gemini-specific prototype server tool loop.
- `webkitSpeechRecognition` as AURA's main STT.
- `window.speechSynthesis` as AURA's main TTS.
- Simulated mic levels.
- Fake diagnostic logs.
- Simulated system checks.
- Fake terminal output.
- Browser-only assumptions.
- Prototype comments as production implementation guidance.

## Runtime Mapping

The visual shell should be controlled by real AURA state:

| AURA State | Visual Mode |
| --- | --- |
| No active voice or task | `ambient` |
| One-shot recording or conversation listening | `listening` |
| Transcribing, acknowledging, preparing voice, thinking | `thinking` |
| AURA TTS playback | `speaking` |
| Running terminal RuntimeTask | `terminal` |
| Running CLI/task RuntimeTask | `working` |
| Running memory RuntimeTask | `memory` |
| RuntimeTask completed | `completed` briefly, then `ambient` |
| RuntimeTask failed/blocked/cancelled | `failed` briefly, then `ambient` |
| Active visual diagram | `diagram` |

Voice state wins over ambient. Active diagrams win over ordinary task modes because they deliberately use the canvas as the primary display surface. Terminal visuals may overlay diagram/canvas state only when backed by a real RuntimeTask or explicit visual tool data.

## Diagram Tool Model

The diagram system should render structured `DiagramData`:

- `title`
- `description`
- `layoutMode`: `grid`, `list`, `flow`, `bento`
- `themeColor`
- `nodes` with `label`, `detail`, `color`, `icon`, `emoji`, `animation`, and `status`
- optional `edges` for flow diagrams

The diagram renderer may be implemented inside `AuraLiveCanvas` or as `AuraDiagramRenderer`. Keeping it separate is preferred for maintainability.

## Terminal Visual Model

The terminal visual must be RuntimeTask-backed:

- Shows active terminal/CLI task command, status, logs, duration, and result summary.
- Never invents compiler output, command output, or success/failure.
- Can be opened by real task activity or visual tool state.
- Can be closed/minimized.
- Must not block orb, bottom voice controls, or the right panel.
- Completed/failed terminal overlay should auto-close after a short delay unless manually held open.

## Components To Add

- `src/types/visual-canvas.ts`
- `src/types/visual-shell.ts`
- `src/services/visual/VisualShellStateService.ts`
- `src/hooks/useVisualShellState.ts`
- `src/components/visual/AuraLiveCanvas.tsx`
- `src/components/visual/AuraOrbVisualizer.tsx`
- `src/components/visual/AuraTerminalOverlay.tsx`
- `src/components/visual/AuraDiagramRenderer.tsx`

## Components To Change

- `src/components/operator/AuraVoiceCore.tsx`
  - Replace direct `LiveCanvas` / `AuraVoiceVisualizer` usage with the new visual shell components.
  - Preserve all current voice controls and state transitions.
  - Keep transcript/technical details secondary.

- `src/services/tools/ToolRegistryService.ts`
  - Add low-risk visual tools.

- `src/services/tools/AuraToolDispatchService.ts`
  - Ensure visual tools are exposed to model function calling.
  - Avoid implying terminal output has been executed unless a real RuntimeTask exists.

- `src/services/personality/AuraPersonalityService.ts`
  - Teach AURA when to use visual tools and diagrams.

- Version files:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
  - `src/lib/appVersion.ts`
  - `README.md`
  - `aura.capabilities.json`

## Visual Tools

Add these tools as low-risk visual controls:

- `visual.showDiagram`
- `visual.closeDiagram`
- `visual.showTerminalVisual`
- `visual.closeTerminalVisual`
- `visual.setCanvasTheme`
- `visual.focusTask`
- `visual.resetCanvas`

Rules:

- Visual tools do not execute shell commands.
- Visual tools do not fake terminal output.
- Terminal visual tools must either point at a real RuntimeTask or clearly mark the display as illustrative.
- Diagram tools may render explanations, workflows, architecture maps, task breakdowns, and conceptual visuals.

## Dependency Order

1. Types first, because components/services depend on shared contracts.
2. Visual state service second, because UI components need a single state source.
3. Canvas/orb/diagram/terminal visual components third.
4. Tool registry and tool dispatch fourth, once visual state can receive commands.
5. Voice Core integration fifth, once components and service contracts compile.
6. Prompt/system-awareness updates sixth.
7. Version/docs/memory seventh.
8. Full validation and installer build last.

## Acceptance

- AURA opens to a visual shell that is canvas-first and orb-first.
- Visual shell is driven by real voice/runtime/tool state.
- Existing voice modes still compile and remain wired.
- Right panel remains available and unchanged in purpose.
- No fake live task, terminal, or diagnostic output is introduced.
- `cargo test`, `npm run lint`, `npm run build`, and `npm run tauri:build` pass before installer launch.

## Implemented In v0.6.0

- Added shared visual shell contracts in `src/types/visual-canvas.ts` and `src/types/visual-shell.ts`.
- Added `VisualShellStateService` as the single command state source for diagrams, terminal visuals, task focus, theme, and reset.
- Added `useVisualShellState` to merge visual commands with real voice and RuntimeTask state.
- Ported Aura-ui-style canvas, orb, diagram, and terminal overlay components into `src/components/visual`.
- Replaced Voice Core's direct canvas/visualizer usage with the layered visual shell.
- Added `visual.*` low-risk tools to the tool registry and model dispatch layer.
- Updated AURA personality guidance so visual tools are used for diagrams and honest terminal displays.
- Updated app identity to v0.6.0 / Phase 3K Visual Shell.

Manual visual QA checklist: `docs/phase-3k-visual-shell-smoke-test.md`.

## Final Validation

- `cargo test`: passed. 8 tests passed, 0 failed.
- `npm run lint`: passed.
- `npm run build`: passed with existing Vite chunk/dynamic-import warnings.
- `npm run tauri:build`: passed.
- NSIS installer: `src-tauri\target\release\bundle\nsis\AURA Command Center_0.6.0_x64-setup.exe`.
- MSI installer: `src-tauri\target\release\bundle\msi\AURA Command Center_0.6.0_x64_en-US.msi`.

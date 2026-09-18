# Phase 3K Visual Shell Smoke Test

Date: 2026-06-01
Version: v0.6.0
Branch: `phase-3k-aura-ui-visual-shell-port`

## Purpose

This checklist is for manual visual QA after installing the v0.6.0 build. Browser/localhost visual checks were intentionally skipped because final visual approval belongs in the installed desktop app.

## Install Check

1. Run `AURA Command Center_0.6.0_x64-setup.exe`.
2. Launch AURA Command Center from the installer or Start menu.
3. Open Settings or Details and confirm the build marker starts with `v0.6.0 / Phase 3K Visual Shell`.

## Visual Shell Check

1. Open the main Voice Core surface.
2. Confirm the first screen is canvas-first and orb-first.
3. Confirm the right operator panel is still available with Activity, Tasks, Terminal, Logs, Memory, Capabilities, Recipes, Notifications, and Details.
4. Confirm bottom voice controls remain reachable and are not covered by the canvas, diagram surface, or terminal overlay.

## Voice Reactivity Check

1. Start a voice turn.
2. Confirm the orb and canvas change into a listening state.
3. Stop or finish speaking.
4. Confirm the visual state moves through thinking and speaking when AURA responds.
5. Confirm no old duplicate canvas or duplicate visualizer appears.

## Diagram Check

Ask AURA for a visual explanation, for example:

```text
Show me a diagram of how the voice canvas, orb, runtime tasks, and right panel work together.
```

Expected result:

- A diagram appears on the canvas.
- The orb moves/shrinks upward so the diagram has room.
- Diagram nodes are structured cards, not fake terminal output.
- Closing or resetting the visual shell returns the canvas to normal.

## Terminal Visual Check

Ask AURA to show a terminal visual only for a real task, or explicitly ask for an illustrative terminal visual.

Expected result:

- Real RuntimeTask terminal/CLI visuals show real task logs only.
- Illustrative terminal visuals are labeled `Illustrative only`.
- No command output is invented.
- Closing the terminal overlay does not delete runtime task history.

## Regression Check

Confirm these still work:

- Voice on/off toggle.
- Push-to-talk button.
- Conversation transcript.
- Memory/profile panel.
- Runtime task drawer and history.
- Notifications.
- Settings and API key readiness panels.

# Phase 3J UI Inspiration Notes

Date: 2026-05-31
Branch: `phase-3j-operator-ui-ux-refinement`

## Sources Reviewed

- OpenAI Codex CLI: https://github.com/openai/codex
- Claude Code docs: https://code.claude.com/docs
- Warp Command Palette: https://docs.warp.dev/terminal/command-palette
- Warp Session Navigation: https://docs.warp.dev/terminal/sessions/session-navigation
- Raycast Keyboard Shortcuts: https://manual.raycast.com/keyboard-shortcuts
- shadcn/ui Theming: https://ui.shadcn.com/docs/theming
- Linear Peek Preview: https://linear.app/docs/peek
- Cursor Agent Modes: https://docs.cursor.com/agent

## Findings To Borrow

1. Codex and Claude Code both frame the agent as a local operator that can read, edit, run commands, and report results. AURA should foreground command execution and runtime evidence, not dashboard decoration.
2. Claude Code exposes permissions, sessions, memory, and workflows as core concepts. AURA's permission mode, memory, and task history should be always reachable.
3. Warp's command palette groups workflows, prompts, files, actions, sessions, and launch configs behind one searchable operator surface. AURA should keep prompt presets compact and action-oriented.
4. Warp's session navigation emphasizes recency, command status, and current running work. AURA's Activity and Tasks tabs should prioritize active RuntimeTasks first, then recent history.
5. Raycast is keyboard-first. AURA should preserve compact controls, predictable labels, and low-friction commands instead of relying on large explanatory panels.
6. Linear's Peek pattern supports a right-side detail preview without opening a full page. AURA's right panel should behave like an inspector for Activity, Tasks, Terminal, Memory, Capabilities, Recipes, Notifications, and Details.
7. shadcn's token approach reinforces restrained dark surfaces, semantic color roles, and consistent border/radius choices. AURA should stay in zinc/indigo/emerald/amber/rose states with tight radii.
8. Agent consoles should show state transitions clearly: idle, listening, thinking, running, blocked, completed, failed. AURA should avoid animated "working" states unless a real RuntimeTask or voice state exists.
9. Terminal-oriented tools benefit from block-like output. AURA should show command/task summaries as compact blocks with readable logs/results.
10. Right-side panels should make status discoverable without stealing the center surface. AURA's center remains Voice Core or Console; the right panel holds operational detail.
11. Empty states should tell the user what will appear there and how to trigger it. They should not imply fake active data.
12. The composer should feel like a command line plus chat input: one row by default, short prompt chips, Enter to submit, Shift+Enter for longer text.
13. Mode and permission controls should be visible but not dominant. AURA should show mode, permission, active task count, and current tool status in compact rows.
14. Voice-first surfaces need a quiet idle state. The orb/canvas is primary; transcript and technical details should stay secondary.
15. Premium dark tooling usually uses fewer cards, stronger hierarchy, and denser lists. AURA should avoid nested cards, oversized input areas, and stale marketing copy.

## Applied In This Branch

- Replaced the duplicate console-local right panel with one shared OperatorRightPanel.
- Added required right-panel tabs: Activity, Tasks, Terminal, Logs, Memory, Capabilities, Recipes, Notifications, Details.
- Made Activity and Tasks RuntimeTask-first.
- Added terminal/CLI RuntimeTask summaries above the safe TerminalPanel.
- Compact console composer, prompt chips, and status row.
- Kept Console and Voice Core center areas focused on current work instead of mock dashboard data.
- Reduced Voice Core clutter and moved detailed transcript/bridge/self-test surfaces into Details.
- Made LivingVisualCanvas compact while idle and rich only when a real task exists.
- Repositioned RuntimeTaskDrawer so it peeks without blocking the main controls on desktop.
- Updated active version/phase language to Phase 3J and removed visible stale old-phase labels from the operator flow.

## Avoid

- Do not use fake live dots, mock project/agent pills, or placeholder "coming soon" panels in primary operator space.
- Do not let right panels duplicate each other.
- Do not make the composer or idle canvas the dominant visual object.
- Do not show simulated task activity when no RuntimeTask exists.
- Do not bury Terminal, Tasks, Memory, Capabilities, or Recipes behind a generic "Details" drawer only.

## Recommended Follow-Up

- Add keyboard shortcuts for panel tab switching and command focus after the branch is reviewed.
- Consider a true command palette index over tools, recipes, memory, terminal presets, and settings.
- Replace seeded dashboard/project/agent data with real adapters or route those pages behind explicit demo notices.

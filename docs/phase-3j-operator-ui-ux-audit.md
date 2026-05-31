# Phase 3J Operator UI/UX Audit

Date: 2026-05-31
Branch: `phase-3j-operator-ui-ux-refinement`
Agent: Codex / OpenAI / GPT-5

## Scope

Focused audit of AURA Command Center's operator interface before Phase 3J UI work. This audit intentionally stays in the UI layer unless a UI defect cannot be fixed without a data surface adjustment.

Reviewed surfaces:

- Console page
- Voice Core page
- Layout, Sidebar, TopBar
- OperatorRightPanel
- RuntimeTaskDrawer
- RuntimeTaskHistoryPanel
- BackgroundTasksPanel / background activity surfaces
- TerminalPanel
- CapabilitiesPanel
- MemoryPanel
- RecipePanel
- LivingVisualCanvas
- Notification tray and history
- Settings voice/provider sections

Memory entries checked first:

- ERR-0007: Voice Core overlay and notification placement
- ERR-0013: Mock data masquerading as live UI
- ERR-0014: Capability reachable through only one path
- Phase 3H Runtime Nervous System pattern
- Phase 3I Tool Loop Reliability pattern
- LESSON-002 AURA full audit

## High-Impact Findings

### 1. Console has two competing right-side concepts

`AuraCommandConsole` renders its own right-side tab strip while the app layout also renders `OperatorRightPanel` on xl screens. This creates a split operator model: some live panels are in the console, some are in the global panel, and the user can see duplicate right-side areas.

Impact:

- Wasted horizontal space.
- Important panels are hard to find.
- Console does not feel like one intentional Claude Code / Codex-style workspace.

Fix target:

- Use one operator right panel for Console and Voice Core.
- Move console-side activity into the shared OperatorRightPanel.

### 2. OperatorRightPanel tabs do not match the current runtime system

Current global tabs are Notifications, Tasks, Transcript, Planning, Terminal, Diff, Files, Logs. Several are placeholders, while important active systems such as Memory, Capabilities, Recipes, and RuntimeTasks are not first-class tabs there.

Impact:

- RuntimeTask work is hidden.
- Memory/capability state is discoverable only through another console-local side panel.
- Placeholder tabs occupy prime operator space.

Fix target:

- Required tabs: Activity, Tasks, Terminal, Logs, Memory, Capabilities, Recipes, Notifications, Details.
- Use explicit "Planned" copy only where a surface is not implemented.

### 3. Console status feedback is split between header, canvas, and tool panels

The console shows `ready` or `busyLabel`, but it does not expose a compact operator status row with active mode, permission mode, active task count, and current tool status.

Impact:

- The user cannot quickly tell whether AURA is idle, thinking, running a tool, blocked, or waiting for approval.
- Tool cards are visible only inside the console-local side panel.

Fix target:

- Add a compact status strip below the console header.
- Keep tool/task result cards compact.

### 4. Voice Core still carries dashboard-style status noise

Voice Core is much cleaner than earlier phases, but the center still includes a transcript card, multiple status hints, history toggles, technical chips, and a two-row bottom control cluster. These compete with the voice orb.

Impact:

- The page reads like a dashboard instead of a primary voice interface.
- Idle state has too many labels for a voice-first screen.

Fix target:

- Keep the central orb/canvas primary.
- Collapse transcript/history details into a small activity strip or Details panel.
- Keep only essential controls visible: Speak/Start Conversation, Fast mode, permission mode, Console, Details.

### 5. TopBar uses mock project/agent data as if it were live

`TopBar` imports `mockProjects` and `mockAgents`, displays an active project switcher, and shows an active agent pill with a live-looking status dot.

Impact:

- Violates ERR-0013.
- Looks like real project/agent routing even though it is fixture-backed.

Fix target:

- Replace with static/operator context and real RuntimeTaskBadge.
- Avoid fake live status dots.

### 6. Settings contains stale voice/provider copy

Settings still shows "Voice Runtime - Mock Mode", "Phase 2F", and says no microphone or API calls happen, even though request-based OpenAI voice exists. Provider copy also says keys require secure storage configuration, which is misleading because current storage is AppData `.env`.

Impact:

- User trust problem.
- Conflicts with current voice implementation and memory audit notes.

Fix target:

- Rewrite active voice/provider text to current request-based Tauri/OpenAI behavior.
- Label AppData `.env` storage honestly.

### 7. RuntimeTaskDrawer is useful but can block controls on small windows

The drawer appears fixed at bottom-right. It shows status, icon, logs, and result/error state, but it can collide with the voice bottom control zone and the global right panel edge.

Impact:

- Violates the small-height/non-overlap lessons from ERR-0007.

Fix target:

- Move it up slightly on desktop/right-panel layouts.
- Keep it compact, non-blocking, and auto-hide after completion/failure unless pinned.

### 8. RuntimeTaskHistoryPanel is readable but not connected to the main right panel

The history panel is not currently exposed as the main Tasks tab in OperatorRightPanel. The panel also has minor type hygiene issues (`any` for the inline empty-state icon).

Impact:

- Users cannot quickly find task history.
- Strict UI work should remove avoidable type looseness when touched.

Fix target:

- Wire it into the shared Tasks tab.
- Replace the custom `any` icon typing or use an existing icon.

### 9. LivingVisualCanvas idle state is too large for console use

When no task exists, the canvas renders a large dashed empty card that says "Canvas idle. Waiting for task execution...".

Impact:

- It adds a placeholder-looking block to the console.
- It contradicts the request for a useful working surface without clutter.

Fix target:

- Make idle state compact/subtle.
- Show richer state only when real RuntimeTasks exist.
- Add mode language for terminal, CLI, memory, task completed, and task failed states using actual task data.

### 10. Terminal activity is split across TerminalPanel and RuntimeTasks

`TerminalPanel` can run allowlisted commands directly, while terminal tools run through RuntimeTasks. The right panel does not show terminal tool results and direct terminal output in one place.

Impact:

- Users may not know where command output went after asking the console.

Fix target:

- Terminal tab should show recent terminal/CLI RuntimeTasks and the safe command runner.

### 11. Notification history is useful but ordered after placeholders

Notifications are live and persistent, but the panel starts on Notifications and includes placeholder tabs. For operator work, Activity/Tasks should be more prominent while Notifications remain easy to find.

Impact:

- The right panel feels like a notification drawer rather than an operator panel.

Fix target:

- Activity should be the default tab.
- Notifications remains first-class with unread badge.

### 12. Active UI/version labels are stale or inconsistent

Active files still reference old phases:

- `APP_PHASE` is Phase 3H.
- README says v0.4.3 Phase 3G while package is 0.5.0.
- Top-level guidance docs still say Phase 3G.
- Settings active voice copy says Phase 2F.
- Dashboard active label says Phase 3G.

Impact:

- User cannot trust which build they are looking at.

Fix target:

- Fix active UI and current docs for Phase 3J UI branch.
- Do not rewrite historical docs that are intentionally archival.

## Surface Notes

### Console Page

Problems:

- Own right panel duplicates the global OperatorRightPanel concept.
- Composer is mostly compact but still allows growth to 120px and sits below quick actions that can wrap heavily.
- No compact status row with active mode/permission/tasks/tool status.
- Tool result cards are only in the local console panel.
- Canvas idle card looks like a placeholder.

Improvements:

- One shared right panel.
- Status row below header.
- Smaller composer max height and tighter quick actions.
- Compact tool/task summaries in Activity/Terminal tabs.

### Voice Core Page

Problems:

- Center has too many status hints and secondary labels.
- Transcript/history occupy the primary visual plane.
- Bottom controls have too many small buttons in the main row.
- Permission mode is not visible on the primary voice control surface.

Improvements:

- Center: orb/canvas first, compact last-turn surface second.
- Move detailed status/history into Details tab.
- Bottom: primary action, conversation mode, fast mode, permission mode, Console, Details.

### Layout / Sidebar / TopBar

Problems:

- TopBar mock project/agent pill pretends live project routing.
- Sidebar footer says "Online & Monitoring" with a pulsing dot that is not tied to a live monitor.
- Layout renders global right panel on the Console route, while the Console component also renders its own right panel.

Improvements:

- Replace fake TopBar status with version/operator context and RuntimeTaskBadge.
- Hide the global panel for Console route, then render one page-owned panel beside Voice/Console.
- Make Sidebar footer less live-claiming.

### OperatorRightPanel

Problems:

- Required tabs are missing.
- Placeholder tabs use "Coming in a future phase".
- Tasks tab says no active tasks even when RuntimeTask history exists elsewhere.
- No Memory, Capabilities, Recipes tabs.

Improvements:

- Activity default tab.
- Tasks uses RuntimeTaskHistoryPanel.
- Terminal shows runtime terminal results + safe command runner.
- Logs shows incidents/tool executions.
- Details shows transcript/agent bridge/self-test details.

### RuntimeTaskDrawer

Problems:

- Can occupy the same bottom-right zone as voice controls.
- Shows raw elapsed milliseconds only.
- Final result summary can disappear after auto-hide too quickly unless pinned.

Improvements:

- Offset above the voice controls/right rail.
- Format elapsed time compactly.
- Keep result/failure summary visible briefly without blocking primary controls.

### RuntimeTaskHistoryPanel

Problems:

- Not exposed in main right panel.
- Uses inline custom SVG with `any`.
- Status rows are useful but dense for a narrow panel.

Improvements:

- Wire into Tasks tab.
- Use a lucide icon for empty state.
- Keep readable narrow widths.

### Background Activity

Problems:

- There are two "background tasks" concepts: CLI agent background panel and RuntimeTask system.
- The runtime mock panel under `src/components/runtime/BackgroundTasksPanel.tsx` still imports `mockRuntimeState`.

Improvements:

- Activity tab should prioritize RuntimeTasks and tool executions.
- Any mock runtime panels stay behind explicit demo notices and outside the primary operator flow.

### TerminalPanel

Problems:

- Direct command runner works, but terminal tool results are not grouped with it.
- Empty state says "Run a command to see output" and misses console-driven terminal task output.

Improvements:

- Add recent terminal/CLI RuntimeTask results above the safe command runner.

### CapabilitiesPanel

Problems:

- Useful and mostly current, but hidden in console-local panel rather than the shared right panel.

Improvements:

- Wire into shared Capabilities tab.

### MemoryPanel

Problems:

- Useful and mostly current, but hidden in console-local panel rather than the shared right panel.
- Placeholder "Your name" is acceptable form placeholder, not a stale fake row.

Improvements:

- Wire into shared Memory tab.

### RecipePanel

Problems:

- Useful learned-recipes view, but not discoverable in global panel.

Improvements:

- Wire into shared Recipes tab.
- Empty state should not imply fake recipes exist.

### LivingVisualCanvas

Problems:

- Idle card is too large and placeholder-like.
- Mode vocabulary is implicit and only task-driven.

Improvements:

- Compact idle surface.
- Clear real-state modes: idle, tool_running, terminal_running, cli_running, memory_update, task_completed, task_failed.
- No fake animation when idle.

### Notification Tray / History

Problems:

- Notifications are live and useful.
- Notification history is discoverable, but currently surrounded by placeholder tabs.

Improvements:

- Keep as required Notifications tab with unread badge.
- Keep transient errors routed there.

### Settings Voice / Provider Sections

Problems:

- Stale "Mock Mode" and Phase 2F text.
- Provider security copy is misleading about current AppData `.env` storage.
- "Automatic - router selects agent (mock)" should be labeled as planned/preview, not mock-live.

Improvements:

- Update active copy to request-based OpenAI/Tauri behavior.
- Label optional/planned capabilities clearly.

## Not Fixed In This UI Sprint

These issues are noted but intentionally outside this branch unless required by UI wiring:

- `AuraToolDispatchService.chatWithTools` creates RuntimeTasks with `source: 'voice'` even when used by the console. Fixing that touches tool-dispatch logic.
- Replacing seeded dashboard/projects/agents/connectors data with real backend adapters. This is backend/data-model work.
- OS keychain/Stronghold secure storage. This is security/backend work.
- OpenAI Realtime full-duplex voice. This is backend/runtime work.
- ElevenLabs Rust TTS path. This is backend/provider work.

## Phase 3J Fix Plan

1. Make Console and Voice Core use one shared OperatorRightPanel.
2. Replace OperatorRightPanel tabs with required operator tabs and real panels.
3. Add compact console status row and tighten composer/canvas behavior.
4. Simplify Voice Core center and control surface.
5. Polish RuntimeTask drawer/history/canvas without changing runtime logic.
6. Sweep active UI/docs labels and remove fake live claims.
7. Add a UI smoke-test checklist.
8. Validate with lint/build and browser visual QA.

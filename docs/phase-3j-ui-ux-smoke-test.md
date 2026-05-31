# Phase 3J UI/UX Smoke Test

Date: 2026-05-31
Branch: `phase-3j-operator-ui-ux-refinement`

## Goal

Verify that the operator workspace is clean, compact, and honest about live versus planned/demo state.

## Manual QA Checklist

1. Open AURA Command Center.
2. Confirm the first screen is Voice Core with a clean central orb/canvas and no dashboard-style clutter.
3. Confirm the right operator panel is visible on desktop and starts on Activity.
4. Collapse the right panel and confirm the icon rail remains visible.
5. Reopen the right panel and click each tab: Activity, Tasks, Terminal, Logs, Memory, Capabilities, Recipes, Notifications, Details.
6. Confirm empty states are useful and do not pretend fake live data exists.
7. Switch to Console.
8. Confirm there is only one right-side operator panel, not two sidebars.
9. Confirm the console composer is compact and does not become oversized.
10. Confirm the console status row shows mode, permission, active task count, and tool status.
11. Send `Check git status`.
12. Confirm a RuntimeTask starts, the drawer peeks without blocking the composer or voice controls, and Activity shows the task.
13. Open the right panel Activity tab and confirm active/recent RuntimeTasks are visible.
14. Open the Terminal tab and confirm terminal/CLI RuntimeTask results appear above the safe command runner.
15. Open the Tasks tab and confirm RuntimeTask history is readable.
16. Send `Check Claude and Codex availability`.
17. Confirm tool cards/logs appear compactly in Activity or Logs.
18. Send `Remember my name is Karim`.
19. Open Memory and confirm the saved profile/fact is visible.
20. Send `What can you do?`.
21. Confirm the response is readable and no fake demo rows appear in the console stream.
22. Switch back to Voice Core.
23. Confirm idle canvas/orb is quiet and no fake working animation is running.
24. Start conversation or Speak.
25. Confirm essential controls remain visible: primary voice action, conversation mode, Fast mode, permission mode, Console, Details.
26. Confirm technical details/history are available through the right panel Details tab, not cluttering the center.
27. Open Capabilities and confirm capability status/test controls are visible.
28. Open Recipes and confirm learned recipe empty state is honest.
29. Open Notifications and confirm notifications/history are reachable.
30. Confirm no active UI labels still say Phase 2G, Phase 2F, Phase 3G, Phase 3H, or v0.4.3.
31. Resize to a normal desktop window and confirm no overlap.
32. Resize to a smaller laptop window and confirm the right panel remains usable.
33. Resize to a narrow window and confirm the right panel collapses away while the main UI remains usable.
34. Resize to a short-height window and confirm bottom voice controls and the RuntimeTask drawer do not overlap.
35. Confirm scroll areas work in Console, Voice Core, and the right panel.

## Expected Result

- Console feels like a real operator console, not a mock chat.
- Voice Core is orb-first and uncluttered.
- Right-side panels are discoverable and useful.
- RuntimeTask feedback is visible without blocking the main UI.
- Stale phase/version/mock labels are absent from active UI.

## Visual QA Note

In-app browser visual QA was attempted during branch closeout, but the Browser surface could not reach the local Vite server even though PowerShell returned HTTP 200 from `http://localhost:3000/`. Manual visual QA should be performed by the user from the installed app or a normal local browser after this branch is pushed.

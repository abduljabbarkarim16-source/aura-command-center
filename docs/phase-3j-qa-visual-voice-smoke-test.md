# Phase 3J QA — Visual + Voice Smoke Test (v0.5.1)

Date: 2026-05-31
Branch: `phase-3j-qa-visual-voice-fix`
Installer: `AURA Command Center_0.5.1_x64-setup.exe`

Run this after installing the **0.5.1** build. The single most important check is
#1 — it proves you are running the new build, which was the whole "UI looked
unchanged" problem.

## A. Build identity (proves you have the new build)

1. Open the app. TopBar reads **`v0.5.1 / Phase 3J QA · Visual + Voice Fix`**.
2. Open the right operator panel → **Details** tab → **Build** card shows
   `v0.5.1`, phase `Phase 3J QA`, a **commit** SHA, **branch**
   `phase-3j-qa-visual-voice-fix`, and a **built** timestamp.
3. The installer file name is `..._0.5.1_x64-setup.exe` (not `0.5.0`).

## B. Visual surface (Voice Core)

4. Voice Core opens orb-first; the center background is a **living ambient
   field** (soft drifting glow + faint dot grid), not flat black — and calm while
   idle (no fake "working" animation).
5. Start/Speak → ambient shifts toward sky/cyan while listening, violet while
   thinking, indigo/emerald while speaking. Returns to calm when idle.
6. Bottom controls stay compact: Speak/Start, One-shot, Console, Details,
   permission mode, voice On/Off, Fast/Std. No center clutter, no overlap.

## C. Operator right panel

7. On a desktop-width window the right panel is visible; collapse/expand via the
   icon rail. Tabs: Activity, Tasks, Terminal, Logs, Memory, Capabilities,
   Recipes, Notifications, Details.
8. Notifications appear top-right (toast) and in the Notifications tab with an
   unread badge — never center-screen or under the voice controls.

## D. Voice name + spelling capture (the main voice fix)

9. **Typed**, in Console: `Remember my name is Karim` → AURA confirms it saved
   Karim. Then `What is my name?` → answers **Karim**.
10. **Voice**, spelled: say *"Remember my name is Karim. It is spelled K A R I M."*
    → AURA saves **Karim** (spelling is authoritative) and reads it back
    ("…spelled K-A-R-I-M"). It must **not** save "Kareem".
11. **Voice**, heard-only mishearing: say *"My name is Kareem"* (no spelling) →
    AURA does **not** save silently; it asks you to confirm or spell it.
    Reply *"K A R I M"* (or *"K as in kite, A as in apple, R as in river, I as in
    igloo, M as in mother"*) → saves **Karim**.
12. **NATO**: say *"spelled kilo alpha romeo india mike"* → saves **Karim**.
13. Ask *"What is my name?"* by voice → answers **Karim**.

## E. Voice diagnostics (Details tab)

14. After the steps above, Details → **Voice diagnostics** shows recent turns:
    intent (name.committed / name.confirm / name.query), `spelling` badge when a
    spelling was parsed, the heard vs cleaned text, the saved value, confidence,
    and timings.

## F. Tool loop (unchanged behaviour, confirm still healthy)

15. Console: `Check git status` → a RuntimeTask runs; result appears in Activity
    / Terminal; the task drawer peeks without blocking controls.
16. Console: `Check Claude and Codex availability` → tool cards/logs appear
    compactly.
17. Console: `What can you do?` → readable answer, no fake demo rows.

## Expected result

- You can tell at a glance (TopBar + Details/Build) that this is **0.5.1**.
- The Voice Core center is a real, premium, state-reactive surface.
- Names are captured correctly via spelling and confirmed before saving when
  heard-only — "Kareem" is never saved silently.
- Voice diagnostics make any future voice failure debuggable (STT vs cleanup vs
  intent vs save).

## Not in this build (tracked, intentionally out of scope)

- OpenAI Realtime/WebRTC full-duplex voice (separate phase).
- Browser Workspace.
- Replacing remaining seeded dashboard/projects data with live adapters.

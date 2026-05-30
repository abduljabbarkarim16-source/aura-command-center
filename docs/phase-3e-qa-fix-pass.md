# Phase 3E QA Fix Pass

**Branch:** `phase-3e-qa-handsfree-voice-terminal-fix`
**Date:** 2026-05-30
**Agent:** Claude (Anthropic · claude-sonnet-4-6)

---

## QA Issues Confirmed and Fixed

### QA-01 — 20–25 second speech still fails

**Root cause found:** `voice_commands.rs` used `max(no_speech_prob)` across ALL segments.
For a 20–25s recording, any natural pause between sentences creates a segment with
`no_speech_prob > 0.60`. The old code discarded the **entire transcript** due to that one pause,
even when Whisper successfully transcribed real speech.

**Fix:** If Whisper returns non-empty text, always return it. Hallucination filter (`is_likely_hallucination`)
still runs. No_speech_prob check now only runs when text is empty, using average not max.

**Test:**
- 3–5s speech: ✓
- 10–15s speech: ✓  
- 20–25s speech: should now work — Whisper transcribes real speech → returned regardless of pauses

---

### QA-02 — Hands-free conversation loop missing

**Fix:** `useConversationLoop.ts` — full state machine:
`idle → listening → transcribing → thinking → speaking → listening (auto-repeat)`

- User clicks "Start Conversation" once
- AURA keeps listening after each response
- Stop phrases: "stop listening" / "pause conversation" / "that's all" / "go idle"
- Dormancy: 90s with no speech → dormant state, visible indicator
- Resume: click or hotkey

---

### QA-03 — Natural barge-in (speak while AURA talks)

**Fix:** `useConversationLoop.ts` `startBargeInAnalyser()`

While AURA's TTS audio plays:
- Secondary MediaStream opened with echoCancellation: true
- AnalyserNode polls RMS every 100ms
- If user speech detected (RMS > 0.025 for 4 consecutive frames): TTS stopped, recording started
- Higher threshold than VAD to avoid speaker echo false positives
- Manual Interrupt button still available as fallback

---

### QA-04 — Wake phrase not activating

**Status:** SpeechRecognition in WebView2 is environment-dependent.
The improved wake phrase now:
- Shows "Wake phrase" / "unavailable" / "Hey AURA!" status clearly
- Triggers `startConversation()` in conversation mode when activated
- Triggers one-shot Speak in manual mode when activated
- More phrases: hey aura / aura / aurora / hey aurora / hey ora / hey laura

If WebView2 SpeechRecognition is unavailable, the badge shows clearly.
Full fallback (STT-based sampling) is planned for Phase 3F.

---

### QA-05 — Right panel tabs not discoverable

**Fix:** `OperatorRightPanel.tsx` redesigned:
- **Always-visible collapsed icon rail** on the right edge
- All 8 tab icons shown even when panel is closed
- Click any icon → opens panel and switches to that tab
- Notification badge visible on collapsed Notifications icon
- `defaultOpen={true}` in Layout.tsx — panel open by default

Tabs: Notifications · Tasks · Transcript · Planning · **Terminal** · Diff · Files · Logs

---

### QA-06 — Terminal panel not available

**Fix:** `TerminalPanel.tsx` wired to Terminal tab.

Allowed command buttons (no arbitrary shell):
- git status --short
- git branch --show-current
- git log --oneline -20
- npm run lint
- npm run build
- cargo test

Shows: stdout/stderr, exit code, duration, timestamp, copy button.
Failures → NotificationService.

---

### QA-07 — Console section too large / consumer-app style

**Fix:** `AuraCommandConsole.tsx` — Claude Code-style operator console:
- Dense text (10–12px) instead of 14–16px bubbles
- No rounded consumer chat bubbles
- Role badges (User/AURA) as small colored labels
- Timestamps inline, small and right-aligned
- Approval/handoff/tool-status rows are compact
- Max-width 2xl (672px) instead of 4xl (896px) — less spread
- Clean header bar with small navigation

Console.tsx chatConsole mode now renders `AuraCommandConsole` instead of `AssistantMessage` bubbles.

---

## How to Test Long Speech

1. Click "Start Conversation" (conversation mode)
2. Speak naturally for 20–25 seconds including natural pauses
3. After you pause for ~2 seconds, AURA auto-stops and processes
4. Expected: transcript appears, AURA responds, then AURA listens again

## How to Use Conversation Mode

1. Voice must be On (toggle shows "On")
2. Click the "One-shot" button next to the Speak button to switch to "Conv" mode
3. Click "Start Conversation" — green button
4. Speak, pause, wait for AURA to respond
5. AURA returns to listening automatically
6. Say "stop listening" or click "End" to stop

## How to Use Barge-in

1. While AURA is speaking, start talking
2. AURA should stop within ~400ms of detecting your speech
3. If echo causes false positives: interrupt button is still available

## How to Open Right Panel Tabs

1. A thin icon rail is always visible on the right edge of the screen
2. Each icon = one tab (hover for tooltip)
3. Click any icon to open the panel and switch to that tab
4. Click the collapse button (›) to close the panel while keeping the icon rail

## How to Use Terminal Panel

1. Open right panel → click Terminal tab (4th from top in the icon rail)
2. Command buttons appear at top: git status, npm lint, etc.
3. Click a button to run it — output appears below
4. Click copy icon to copy output

## Limitations (Phase 3E QA)

- Wake phrase requires WebView2 SpeechRecognition support — may show "unavailable"
- Barge-in requires headphones for best results (speaker echo can cause false positives)
- Natural barge-in uses higher threshold (0.025) to avoid echo; click Interrupt if needed
- Conversation mode dormancy is 90s — configurable in a future settings panel
- Agent CLI sessions (claude, codex) are availability-check only — spawn in next phase

---

*QA fix agent: Claude (Anthropic · claude-sonnet-4-6) · 2026-05-30*

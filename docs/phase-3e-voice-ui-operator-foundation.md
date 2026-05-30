# Phase 3E — Voice UI Hardening & Operator Foundation

**Branch:** `phase-3e-voice-ui-operator-foundation`
**Started:** 2026-05-30
**Agent:** Claude (Anthropic · claude-sonnet-4-6)

---

## Confirmed Bugs

### Bug A — Voice VAD False Negative / Long Speech Failure

**Symptoms:**
- Short speech (under 10s) works reliably.
- Speech of 20–25 seconds fails or returns "No speech detected."
- VAD auto-stop fires prematurely on natural pauses within a sentence.
- Current `RMS_SILENCE_THRESHOLD = 0.01` is too strict for many mic environments.
- `speechDetectedRef` resets on cleanup and may not survive full 20–25s recording.
- A single-frame spike is enough to set `speechDetected = true` — too fragile.
- After a 1.2s silence, VAD auto-fires even mid-long-thought speech.

**Root cause:**
- `speechDetectedRef` requires only 1 RMS sample above threshold — too sensitive to noise spikes.
- Silence detection fires after `silenceThresholdMs` (1200ms default) without considering natural pauses in connected speech.
- No noise floor calibration — absolute 0.01 RMS threshold may be wrong for different mic setups.
- No fallback: if VAD fires on a long speech where blob is large, it still says "No speech detected" because the STT response comes back empty (Whisper can fail on very long audio with high silence ratio at end).

**Fix applied (Phase 3E):**
- Added noise floor calibration in first 500ms after mic start.
- Require 5 consecutive speech frames (500ms) before `speechDetected = true`.
- Track peak RMS and rolling average RMS.
- Dynamic threshold: `max(BASE_THRESHOLD, noiseFloor * 2.0)`.
- Silence timer only starts after `speechDetected = true`, resetting if any speech frame appears.
- If blob is large (>500KB) even when VAD says "no speech," attempt STT anyway.
- Improved "No speech detected" messages with actionable advice.
- Default silence threshold raised to 1800ms (from 1200ms).
- Default max duration raised to 45s (from 30s, adjustable up to 60s).

---

### Bug B — UI Overlay / Button Collision

**Symptoms:**
- Buttons in the bottom strip overlap with notification/error text in the transcript panel.
- Error messages appear inline in the voice core transcript area.
- In error state, a button-height block collides with the error banner.
- Bottom controls and transcript panel do not have guaranteed separation.

**Fix applied (Phase 3E):**
- Errors/warnings route to `notificationService` (top-right tray) instead of inline `convError` state.
- Inline `convError` removed from the transcript panel entirely.
- Voice Core uses a cleaner fixed-height layout: status strip → orb zone → transcript panel → button strip, each in non-overlapping zones.
- Right-side operator panel now owns persistent notifications and approval cards.

---

### Bug C — Notification Placement

**Symptoms:**
- Toasts/errors/approval banners appear in the center voice area or bottom controls zone.
- They collide with the Speak button and transcript display.
- No persistent notification history.

**Fix applied (Phase 3E):**
- All transient voice errors routed to `notificationService.add()` with `ttl`.
- `NotificationService` now persists to `localStorage` (key: `aura.notification.history`).
- Cap: 500 entries (configurable).
- Right-side `OperatorRightPanel` with `Notifications` tab owns the persistent view.
- `NotificationToast` in top-right remains for ephemeral toasts only.

---

### Bug D — Transcript Persistence Gap

**Symptoms:**
- Voice conversation turns are in-memory only (lost on refresh/restart).
- No local history reviewable by AURA.
- No export capability.

**Fix applied (Phase 3E):**
- `VoiceTranscriptLogService` created: stores full conversation turns to localStorage.
- Stores: timestamp, userText, auraText, provider, duration, status, error summary.
- Privacy toggle: `persistTranscripts` setting (default: `false` for safety).
- Clear history and export to JSON/Markdown in Transcript History panel.

---

### Bug E — Operator Layout Missing

**Symptoms:**
- No structured right-side panel for admin, notifications, transcript, tasks.
- Claude/Codex-style panel structure (Preview, Diff, Terminal, Files, Tasks, Planning, Logs) absent.
- Notification tray and approval history have no dedicated space.

**Fix applied (Phase 3E):**
- `OperatorRightPanel` created with collapsible tabs: Notifications · Tasks · Transcript · Planning · Terminal · Diff · Files · Logs.
- Notifications tab wired to `notificationService`.
- Transcript tab wired to `VoiceTranscriptLogService`.
- Tasks tab shows `BackgroundTasksPanel`.
- Other tabs: clean placeholders with short labels.

---

### Bug F — Agent / CLI Control Missing

**Symptoms:**
- No way to launch or observe Claude CLI / Codex CLI sessions from AURA.
- No background task tracking for external agent sessions.
- No usage-limit reminder when Claude/Codex hits rate limits.

**Fix applied (Phase 3E — foundation only):**
- `src/types/agent-session.ts` — typed agent session model.
- `src/services/agents/AgentSessionService.ts` — session registry.
- `src/services/agents/ClaudeCliService.ts` — availability check + dry-run scaffold.
- `src/services/agents/CodexCliService.ts` — availability check + dry-run scaffold.
- `src/services/agents/UsageLimitReminderService.ts` — parses limit messages → reminders.
- Rust: `check_cli_available(binary)` command added to safe allowlist.
- No arbitrary shell. Binary allowlist: `claude`, `codex`.

---

## Milestones

| # | Title | Status |
|---|-------|--------|
| 1 | Document bugs and create memory entries | ✅ |
| 2 | Research voice dictation / WhisperFlow | ✅ |
| 3 | Fix VAD false negatives and long speech | ✅ |
| 4 | Add keyboard hotkey voice activation | ✅ |
| 5 | Fix UI overlay and layout collision | ✅ |
| 6 | Notification tray + persistent history | ✅ |
| 7 | Voice transcript persistence | ✅ |
| 8 | Claude/Codex-style operator layout | ✅ |
| 9 | Identity + capabilities + skills | ✅ |
| 10 | Context compression foundation | ✅ |
| 11 | Agent CLI integration foundation | ✅ |
| 12 | Reminder / event scheduler | ✅ |
| 13 | Research pass | ✅ |
| 14 | README update | ✅ |
| 15 | Validation and build | pending |
| 16 | Commit, push, merge | pending |

---

## Voice Dictation Research Summary

See: `docs/phase-3e-voice-dictation-research.md`

Key findings applied:
- Wispr Flow: noise-floor calibration + frame counting before committing to "speech detected"
- RealtimeSTT: rolling RMS + dynamic threshold
- Whisper hallucination: size-gated fallback (attempt STT even if VAD uncertain, if blob is large)
- Global hotkey: Tauri `globalShortcut` plugin available — wired as optional setting
- VAD: moved from "single spike" to "sustained N-frame" detection

---

*Phase 3E build agent: Claude (Anthropic · claude-sonnet-4-6) · 2026-05-30*

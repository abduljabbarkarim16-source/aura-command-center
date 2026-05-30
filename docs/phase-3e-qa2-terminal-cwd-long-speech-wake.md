# Phase 3E QA2 Fix Pass

**Branch:** `phase-3e-qa2-terminal-cwd-long-speech-wake`
**Date:** 2026-05-30
**Agent:** Claude (Anthropic · claude-sonnet-4-6)

---

## Confirmed Bugs and Fixes

### QA2-01 — Terminal commands run from AppData install directory

**Bug:** In the installed AURA app, the terminal panel ran commands from:
`C:\Users\karim\AppData\Local\AURA Command Center\`

This caused:
- `npm run lint` → ENOENT: `package.json` not found
- `git status` → `fatal: not a git repository`

**Root cause:** `get_project_root()` in `commands.rs` walked up from `current_dir()` (AppData install dir) looking for `package.json`. No `package.json` anywhere up that path.

**Fix applied:**
1. `get_project_root()` now checks `%USERPROFILE%\Documents\AURA\agent-command-center` first (the known AURA default location)
2. Added `get_workspace_path()` and `set_workspace_path()` Tauri commands
3. Persists custom path to `%APPDATA%\com.aura.commandcenter\workspace.txt`
4. `TerminalPanel` shows resolved workspace path and "Use AURA repo" button when misconfigured

---

### QA2-02 — Terminal shows "exit undefined"

**Bug:** `exit undefined` shown instead of `exit 0` or real exit code.

**Root cause:** Rust `CommandResult` struct had no `#[serde(rename_all = "camelCase")]` attribute.
Rust serialized `exit_code` as `exit_code` (snake_case) but TypeScript read `.exitCode` (camelCase) → `undefined`.

**Fix applied:** Added `#[serde(rename_all = "camelCase")]` to `CommandResult`. Also added `cwd` field to show which directory was used per command.

---

### QA2-03 — Long speech (>13s) fails transcription

**Bug:** Speech up to ~13 seconds works. Speech at 20–25 seconds fails.

**Investigation:**
- Rust `no_speech_prob` fix was correctly applied in Phase 3E QA
- The remaining issue is audio file size and transfer
- Browser MediaRecorder default bitrate (Chromium/WebView2): ~48–128 kbps Opus
- 25s at 64 kbps = ~200 KB binary → serialized as JSON array = ~600 KB of JSON text
- Large JSON payload can cause Tauri IPC slowness or Whisper API timeout

**Fix applied:**
1. `useVoiceActivityRecorder.ts` + `useVoiceRecorder.ts`: `audioBitsPerSecond: 16_000`
   - 16 kbps Opus is excellent quality for speech recognition (Whisper-1 uses 16kHz input)
   - 25s at 16 kbps = ~50 KB binary → ~150 KB JSON (4x smaller than before)
2. `voice_commands.rs`: added 90s `reqwest` timeout on all three HTTP clients (STT, Chat, TTS)
   - Prevents silent timeout failures on slow connections for long audio

---

### QA2-04 — Wake phrase "Hey AURA" not working

**Status:** WebView2 SpeechRecognition is environment-dependent on Windows.
The wake phrase badge correctly shows "unavailable" when not supported.

**Current behavior:**
- If SpeechRecognition is available: wake phrase activates conversation mode
- If unavailable: badge shows "Wake phrase unavailable" — no fake "working" status

**For reliable wake**: use `Ctrl+Shift+Space` hotkey or click "Start Conversation".
Full VAD-based wake sampling is planned for Phase 3F.

---

## How to Test

### Terminal panel
1. Open right panel → Terminal tab
2. If panel shows amber "Workspace not configured": click "Use AURA repo" button
3. Run `git status` → should show clean/dirty tree from correct repo
4. Run `npm lint` → should pass TypeScript check
5. Should show `exit 0` and correct `cwd` in each result

### Long speech
1. Click "Start Conversation" (Conv mode)
2. Speak continuously for 20–25 seconds with natural pauses
3. Should transcribe correctly with reduced bitrate audio

---

*QA2 fix agent: Claude (Anthropic · claude-sonnet-4-6) · 2026-05-30*

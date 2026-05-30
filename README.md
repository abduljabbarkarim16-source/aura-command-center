# AURA Command Center

**AURA** — *Autonomous Unified Reasoning Agent* — is a voice-first AI desktop operator built with Tauri (Rust + React/TypeScript).

**Current version:** v0.3.5 · Phase 3E

---

## What Works Now

### Voice Conversation (Phase 3C–3E)
- **OpenAI Whisper STT** — speaks → Tauri backend → Whisper → transcript
- **GPT-4o-mini chat** — transcript → Tauri backend → response
- **OpenAI TTS** — response → Tauri backend → audio playback
- **VAD-lite auto-stop** — noise-floor calibration, N-frame speech gate, smart silence detection
- **Barge-in interrupt** — click Speak or press Ctrl+Shift+Space while AURA is speaking
- **Keyboard hotkey** — Ctrl+Shift+Space starts/stops voice without clicking
- **Wake phrase prototype** — "Hey AURA" (environment-dependent; WebView2 may not support)
- **Response style** — brief / normal / detailed
- **Long speech support** — up to 45s, false "No speech detected" significantly reduced
- **Transcript persistence** — optional local storage (Settings → persist transcripts)

### Operator UI (Phase 3E)
- **Voice Core** — clean center panel, no overlapping buttons or inline error banners
- **Voice errors** — all route to notification tray (top-right), not inline
- **Right-side operator panel** — Notifications · Tasks · Transcript · Planning · Terminal · Diff · Files · Logs tabs
- **Notification persistence** — up to 500 notifications stored locally
- **Collapsible right panel** — clean by default, expand to view history

### Automation & Integrations
- **Make.com relay** — trigger automation scenarios from AURA
- **OpenAI** — STT, chat, TTS (key stored in AppData/Rust, never in frontend)
- **Gemini** — wired but pending credit restoration (add credit at ai.studio)
- **ElevenLabs** — optional, not yet wired in Tauri backend

### Native Bridge (Tauri)
- Safe allowlist-based command execution (npm, cargo, git — pre-approved commands only)
- Agent CLI availability check: `claude`, `codex` (does not launch — check only)
- Context compression service (local, no auto-send)
- Reminder scheduler (localStorage, polls every 60s)

---

## How to Install

### Installer (Recommended)
Download from `src-tauri/target/release/bundle/nsis/`:
```
AURA Command Center_0.3.5_x64-setup.exe
```
Run the installer, launch AURA Command Center from Start menu.

### Set OpenAI Key (Required for voice)

**In-app:** Settings → API Keys → enter key → Save  
**Manual:** Create `%APPDATA%\com.aura.commandcenter\.env`:
```
VITE_OPENAI_API_KEY=sk-...
```

---

## Development Setup

```bash
# Install dependencies
npm install

# Run Tauri desktop app (hot-reload frontend, Rust requires manual restart)
npm run tauri:dev

# Web-only (no native features)
npm run dev

# Lint
npm run lint

# Web build
npm run build

# Production Tauri build (NSIS + MSI installers)
npm run tauri:build
```

**Requirements:** Node.js 18+, Rust 1.77+, VS Build Tools 2022 with C++ workload

---

## Voice Hotkeys

| Hotkey | Action |
|--------|--------|
| `Ctrl+Shift+Space` | Start/stop voice from anywhere in AURA |
| `Space` / `V` | Start/stop when no text field has focus |
| Speak button | Always works |

---

## Architecture

```
src/
  components/operator/   — Voice Core, Operator Right Panel, etc.
  hooks/                 — useVoiceActivityRecorder (VAD), useVoiceHotkey, etc.
  services/
    voice/               — OpenAIVoiceSessionService, VoiceTranscriptLogService
    notifications/       — NotificationService (localStorage persistence)
    context/             — ContextCompressionService
    agents/              — AgentSessionService (CLI availability checks)
    reminders/           — ReminderService (usage-limit + task reminders)
  types/                 — transcript-log, agent-session, reminders, etc.

src-tauri/src/
  voice_commands.rs      — Whisper STT, GPT-4o-mini chat, TTS (API key never leaves Rust)
  commands.rs            — Safe native command bridge + check_cli_available
  config_commands.rs     — OpenAI key save/load/delete (AppData)
  lib.rs                 — Tauri setup + command registration

AGENTS.md               — Agent collaboration rules
SOUL.md                 — AURA identity and purpose
aura.capabilities.json  — Machine-readable capability manifest
skills/                 — Skill manifests (voice, make, claude-cli, codex-cli, browser-workspace)
```

---

## Security Model

- **API key**: stored in Rust (AppData `.env`), never returned to frontend
- **Audio**: captured in browser → Tauri → OpenAI; only text returned to frontend
- **Raw audio**: never stored permanently
- **Notifications**: no secrets, no raw audio, no webhook URLs stored
- **Transcript log**: text only, opt-in, user-clearable
- **Shell commands**: strict allowlist — only pre-approved programs + args
- **Agent CLI**: availability check only (`claude`, `codex`); no spawn without approval

---

## Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 3C | ✅ merged | Voice conversation MVP (Whisper + GPT-4o-mini + TTS) |
| 3D | ✅ merged | VAD-lite, barge-in, wake phrase prototype, hallucination filter |
| 3E | ✅ current | Voice UI hardening, operator layout, notifications, transcript persistence |
| 3F | planned | OpenAI Realtime API WebRTC bridge (full-duplex voice) |
| 4 | planned | Browser workspace automation |

---

## Known Remaining Items

- Wake phrase requires WebView2 SpeechRecognition support (may show "unavailable")
- Gemini requires credit restoration at ai.studio/projects
- ElevenLabs TTS not yet wired in Rust backend
- Claude/Codex CLI spawn (not just availability check) requires Phase 3F+ approval gate
- OpenAI Realtime API (Phase 3F) requires ephemeral token bridge

---

*Built by Claude (Anthropic · claude-sonnet-4-6) as autonomous build agent · Phase 3E · 2026-05-30*

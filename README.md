# AURA Command Center

**AURA** - *Autonomous Unified Reasoning Agent* - is a voice-first AI desktop operator built with Tauri, Rust, React, and TypeScript.

**Current version:** v0.4.1 - Phase 3G

## What Works Now

### Voice Conversation

- **OpenAI Whisper STT** - microphone audio goes through the Tauri backend to Whisper.
- **GPT-4o-mini chat** - transcript goes through the Tauri backend for assistant response generation.
- **OpenAI TTS** - assistant responses are synthesized through the Tauri backend and played locally.
- **VAD-lite auto-stop** - noise-floor calibration, speech gate, and smart silence detection.
- **Barge-in interrupt** - click Speak or press Ctrl+Shift+Space while AURA is speaking.
- **Keyboard hotkey** - Ctrl+Shift+Space starts/stops voice without clicking.
- **Wake phrase prototype** - "Hey AURA" when WebView2 SpeechRecognition supports it.
- **Response style** - brief, normal, detailed.
- **Long speech support** - up to 45 seconds.
- **Transcript persistence** - optional local text storage.
- **Auto-memory extraction** - off by default; enable in Voice Readiness settings.

### Operator UI

- **Voice Core** - primary operator surface with voice controls, approvals, memory, and technical drawers.
- **Notifications** - voice/runtime errors route to the notification tray.
- **Right-side operator panel** - notifications, transcript, terminal, tasks, planning, diff, files, and logs.
- **Provider readiness** - local status and approval-gated smoke tests in Settings.
- **Demo-data notices** - mock-backed pages and panels are visibly labeled.

### Automation & Integrations

- **Make.com relay** - trigger configured automation scenarios from AURA.
- **OpenAI** - STT, chat, and TTS.
- **Gemini** - wired but dependent on account quota/credits.
- **ElevenLabs** - optional key detection; Rust TTS path is not implemented yet.

### Native Bridge

- Safe allowlist-based command execution for approved npm, cargo, git, and CLI-agent commands.
- Agent CLI discovery for `claude` and `codex`.
- Agent CLI session launch through approval-gated commands.
- Context compression service.
- Local reminder scheduler.

## How to Install

### Installer

Download the installer from `src-tauri/target/release/bundle/nsis/`:

```text
AURA Command Center_0.4.1_x64-setup.exe
```

Run the installer, then launch AURA Command Center from the Start menu.

### Set OpenAI Key

In-app: Settings -> API Keys -> enter key -> Save.

Manual: create `%APPDATA%\com.aura.commandcenter\.env`:

```env
VITE_OPENAI_API_KEY=sk-...
```

Current storage is a local AppData `.env` file, not OS keychain storage.

## Development Setup

```bash
npm install
npm run tauri:dev
npm run dev
npm run lint
npm run typecheck:strict
npm run build
npm run tauri:build
```

Requirements: Node.js 18+, Rust 1.77+, Visual Studio Build Tools 2022 with the C++ workload.

## Voice Hotkeys

| Hotkey | Action |
| --- | --- |
| `Ctrl+Shift+Space` | Start/stop voice from anywhere in AURA |
| `Space` / `V` | Start/stop when no text field has focus |
| Speak button | Start/finish one-shot voice mode |

## Architecture

```text
src/
  components/operator/   Voice Core, operator panels, approvals
  hooks/                 voice, runtime, workspace hooks
  services/
    voice/               OpenAI voice session and transcript services
    notifications/       local notification persistence
    context/             context compression
    agents/              CLI discovery and session services
    reminders/           local reminder scheduler
  types/                 typed contracts

src-tauri/src/
  voice_commands.rs      Whisper STT, chat, TTS, memory extraction
  cli_commands.rs        approval-gated CLI agent sessions
  commands.rs            native command bridge and CLI discovery
  config_commands.rs     local AppData key save/load/delete
  lib.rs                 Tauri setup and command registration
```

## Security Model

- API keys are never returned to the frontend.
- Current OpenAI key persistence is local AppData `.env`; OS keychain storage remains future work.
- Audio is captured locally, sent to Tauri, then sent to OpenAI only for explicit voice actions.
- Raw audio is not stored permanently.
- Transcript persistence is opt-in and user-clearable.
- Shell commands and CLI sessions use explicit allowlists.
- Tauri CSP is enabled; development localhost connections remain allowed.

## Known Remaining Items

- Several operational pages still use seeded/demo data while backend adapters are built; they are labeled in the UI.
- Wake phrase support depends on WebView2 SpeechRecognition availability.
- Gemini usage depends on account quota/credits.
- ElevenLabs TTS is not wired to the Rust backend yet.
- OpenAI Realtime API full-duplex voice still requires an ephemeral token bridge.

---

Initial autonomous build by Claude/Anthropic. Current audit hardening by Codex/OpenAI.

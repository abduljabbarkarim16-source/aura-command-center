# Phase 3F: Fast Voice Response + Agent CLI Runner

## Status: Merged to main (v0.4.0)

## Confirmed QA from Phase 3E QA3

| Feature | Result |
|---------|--------|
| Short speech (3–5s) | ✅ works |
| Long speech (20+s) segmented | ✅ works |
| Conversation mode | ✅ works |
| Terminal git status | ✅ correct cwd |
| Terminal npm commands | ✅ finds package.json |
| Remaining issue | ⚠️ perceived response latency |

## What Phase 3F Changes

### 1. Voice Latency Audit

The full voice pipeline latency breakdown:

```
User speaks → [VAD silence] → segmented STT → chat → TTS → audio playback
                 ~0ms          ~500ms-2s/seg   ~1-3s   ~1-2s   ~0.1s
```

Typical perceived latency (pause → first audio): **3–7 seconds**

Bottlenecks by stage:
- **STT**: ~0.5–1.5s per 8s segment (usually overlaps with user still speaking)
- **Chat**: **1–3s** — biggest bottleneck for short questions
- **TTS**: ~0.5–1.5s — starts only after full chat text arrives
- **Playback**: <100ms

### 2. VoiceLatencyService

- Tracks per-turn: recording, STT, chat, TTS, playback
- Stores last 20 metrics in localStorage
- Shows perceived latency (ms) in voice panel status bar
- API: `startTurn()` → `mark*()` → `finalize()`

### 3. Fast Response Mode

When enabled (`fastResponseMode: true`, ⚡ button in voice panel):

1. Generate 1-sentence brief reply immediately
2. Synthesize and start playing it
3. Generate full response **in background** while brief reply plays
4. Display full response in panel when ready

Expected improvement: first audio ~1–2s faster for simple questions.

### 4. Sentence-First TTS

When enabled (`sentenceFirstTTS: true`, default on):

1. Generate full chat response (normal path)
2. Split into sentences
3. Synthesize **first sentence** immediately, start playing
4. Synthesize **remaining sentences** while first plays
5. Queue remaining audio after first finishes

Expected improvement: audio starts ~0.5–1s sooner for longer responses.

### 5. CLI Agent Runner

New Rust backend (`cli_commands.rs`):

| Command | Description |
|---------|-------------|
| `spawn_agent_session` | Spawn claude/codex with prompt, 60s timeout |
| `get_cli_help` | Get --help text (first 50 lines) |

Security constraints:
- Allowlist: `claude`, `codex` only
- Max prompt: 2,000 chars
- Blocked chars: backtick, `$`, `\`
- No shell invocation (direct process spawn)
- No API keys in prompts
- No repo source in prompts
- Usage-limit detection: parses quota/rate-limit messages

### 6. Frontend Agent Services

| Service | Purpose |
|---------|---------|
| `CliDiscoveryService` | Discover CLI availability + help summary, 5min cache |
| `CliSessionService` | Manage sessions (max 2 concurrent), store output |
| `ClaudeCliService` | Claude-specific smoke test |
| `ToolRegistryService` | 9 approved tools with approval gate |

### 7. Tool Registry

9 tools registered:

```
terminal.gitStatus     low     auto-approved
terminal.gitBranch     low     auto-approved
terminal.gitLog        low     auto-approved
terminal.npmLint       low     auto-approved
terminal.npmBuild      medium  requires approval
terminal.cargoTest     low     auto-approved
cli.claudeCheck        low     auto-approved
cli.codexCheck         low     auto-approved
cli.claudeRunTiny      medium  requires approval
cli.codexRunTiny       medium  requires approval
```

## How to Use

### Fast mode toggle
Click the ⚡ button in the voice panel bottom bar. Toggles `fastResponseMode`.

### Check CLI availability (terminal)
```
From the Background Tasks panel (future UI milestone):
  - Click "Check Claude CLI"
  - Click "Check Codex CLI"

From code:
  import { cliDiscoveryService } from '../services/agents/CliDiscoveryService';
  const cap = await cliDiscoveryService.discover('claude');
  // cap.available, cap.path, cap.helpSummary
```

### Run a tool (approved)
```
import { toolRegistryService } from '../services/tools/ToolRegistryService';
const result = await toolRegistryService.execute('terminal.gitStatus');
// result.output, result.exitCode
```

### CLI smoke test (requires approval)
```
const result = await toolRegistryService.execute(
  'cli.claudeRunTiny',
  { prompt: 'Reply exactly: AURA_CLAUDE_CLI_OK' },
  { approved: true }
);
```

## Latency Metrics Display

The voice panel shows `⏱ Nms` after each turn (perceived latency from final pause to first audio).

Full metrics available via `voiceLatencyService.getLastMetrics()`:
- `perceivedLatencyMs` — pause → first audio
- `chatTotalMs` — chat request time
- `ttsSynthesisMs` — TTS generation time
- `sttTotalMs` — total STT across all segments

## Remaining Before Phase 3G (OpenAI Realtime)

1. Background Tasks UI panel — needs wiring to `CliSessionService`
2. Latency panel — full breakdown in Transcript tab
3. Usage-limit reminder — `ReminderService` integration
4. OpenAI Realtime / WebRTC — true streaming, eliminates STT+TTS round-trips

## Phase 3G Plan (OpenAI Realtime)

- `create_realtime_ephemeral_session` Rust command
- Ephemeral client secret (not API key) returned to frontend
- WebRTC audio connection direct to OpenAI
- No audio sent through Tauri IPC
- Eliminates STT + Chat + TTS latency (reduces to ~300ms perceived)

## Manual QA Checklist (v0.4.0)

- [ ] App opens
- [ ] Short speech (3–5s) → transcribes → AURA responds
- [ ] Long speech (20+s) → partial transcript builds live → AURA responds
- [ ] Conversation mode → auto-listens after each response
- [ ] ⚡ Fast mode button toggles on/off
- [ ] First audio starts sooner in Fast mode
- [ ] ⏱ Latency ms shows after each turn
- [ ] Terminal git status shows correct cwd
- [ ] Terminal npm lint passes
- [ ] No exit undefined in terminal
- [ ] CLI check: reports claude/codex availability

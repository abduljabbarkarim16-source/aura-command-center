# AURA Phase 3D Sprint Research
*Compiled: 2026-05-29 — Covers hallucination prevention, advanced voice pipelines, CLI integration, agent self-awareness*

---

## Area 1: Whisper Hallucination Prevention

### Root Cause

Whisper was trained on YouTube transcripts, Wikipedia, and other web sources where non-speech segments were often transcribed as subtitles or captions. When the model receives audio with insufficient acoustic signal (silence, brief coughs, keyboard clicks, breath sounds), it pattern-matches to its training distribution instead of outputting nothing. Research (arxiv 2501.11378) shows hallucinations occur in approximately **40% of non-speech audio inferences**.

### Known Hallucination Phrases (English)

The most common English hallucinations from `sachaarbonel/whisper-hallucinations` (7,890-row dataset):
- "thanks for watching"
- "thank you for watching"
- "please subscribe"
- "subtitles by the amara org community"
- "[BLANK_AUDIO]"
- "you" / "bye"

Top 10 outputs account for over 50% of all hallucinations. The pattern is identical across 100+ languages.

### Does `whisper-1` API Expose Confidence Scores?

`response_format: "verbose_json"` exposes per-segment: `avg_logprob`, `compression_ratio`, `no_speech_prob`. These are available via the API and are the most reliable post-filter signal.

### Pre-Filter Strategies (Before API Call)

**1. Duration Gate (Highest Priority)**
Do not send audio shorter than 500ms. Available via `durationMs` tracked in `useVoiceActivityRecorder`.

**2. RMS Energy Gate**
AURA already has `getRMS()` in `useVoiceActivityRecorder`. The gap: VAD only governs auto-stop — it doesn't gate whether the Blob is sent to the API. Fix: if `speechDetectedRef.current === false`, skip the API call entirely.

**3. Speech-Detection Gate via `speechDetectedRef`**
If VAD phase `speech_detected` was never reached during the recording, return empty without API call.

### Post-Filter Strategies (After API Response)

**1. Blocklist Pattern Match**
```typescript
const HALLUCINATION_BLOCKLIST = new Set([
  'thanks for watching', 'thank you for watching', 'thank you',
  'please subscribe', 'subscribe to my channel',
  'subtitles by the amara org community',
  'you', 'bye', '', '[blank_audio]', '[music]', '[applause]', '...',
]);
function isHallucination(transcript: string): boolean {
  return HALLUCINATION_BLOCKLIST.has(transcript.trim().toLowerCase().replace(/[^\w\s]/g, ''));
}
```

**2. Compression Ratio Check**
High compression ratio indicates repetitive/looping output. Reject if `compression_ratio > 2.4`.

**3. `verbose_json` + `no_speech_prob` Filtering (Most Reliable)**
```typescript
const response = await openai.audio.transcriptions.create({
  file: audioFile, model: 'whisper-1',
  response_format: 'verbose_json', temperature: 0,
});
const cleanSegments = response.segments?.filter(seg => seg.no_speech_prob < 0.72) ?? [];
const cleanText = cleanSegments.map(s => s.text).join(' ').trim();
```

**NOTE:** AURA's Rust backend already implements `verbose_json` + `no_speech_prob` filtering as of the Phase 3D hallucination fix commit (92695d3). See `voice_commands.rs`.

### Repo Reference Table

| Repo | Stars | Key Technique |
|---|---|---|
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 23.2k | Silero VAD filter, `no_speech_prob` per segment, `condition_on_previous_text=False` |
| [WhisperX](https://github.com/m-bain/whisperX) | 22.2k | VAD preprocessing on by default, batching |
| [insanely-fast-whisper](https://github.com/Vaibhavs10/insanely-fast-whisper) | ~18k | Flash Attention 2, VAD filtering |
| [RealtimeSTT](https://github.com/KoljaB/RealtimeSTT) | 9.8k | WebRTC VAD + Silero VAD dual-layer |
| [pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat) | 12.5k | Typed frame pipeline, hallucination filter as frame processor |
| [sachaarbonel/whisper-hallucinations](https://huggingface.co/datasets/sachaarbonel/whisper-hallucinations) | dataset | 7,890-phrase blocklist |

### whisper.cpp Parameters (for reference if AURA ever moves local)
```
--no-speech-thold 0.6    # treat as silence if no_speech_prob exceeds this
--logprob-thold -1.25    # rejects uncertain decoding
--entropy-thold 2.6      # prevents repetitive looping
--no-fallback            # prevents temperature escalation
```

---

## Area 2: Advanced Voice Pipeline Patterns

### What AURA Already Has Correctly
- RMS-based VAD via Web Audio API (AnalyserNode + getFloatTimeDomainData)
- Speech detection state machine (speech_detected, silence_detected, auto_stopping)
- Silence threshold 1200ms after speech detected
- Minimum speech duration 400ms guard
- Hard max 30s cap

The gap: VAD result (`speechDetectedRef`) is not used to gate the API call.

### Pipecat Frame Pipeline Pattern

Pipecat (12.5k stars) structures voice as a typed frame pipeline:
`AudioRawFrame → TranscriptionFrame → LLMMessagesFrame → TTSAudioRawFrame → AudioRawFrame`

Each stage is a `FrameProcessor` that can filter, transform, or drop frames. AURA equivalent:
```typescript
type TranscriptMiddleware = (text: string) => string | null;
const middlewares: TranscriptMiddleware[] = [
  (text) => text.trim().length < 4 ? null : text,       // length gate
  (text) => isHallucination(text) ? null : text,         // blocklist
];
function runMiddleware(text: string): string | null {
  let result: string | null = text;
  for (const mw of middlewares) {
    if (result === null) return null;
    result = mw(result);
  }
  return result;
}
```

### Sentence Boundary Streaming (RealtimeTTS Pattern)

Start TTS synthesis before the LLM finishes generating. Dispatch each complete sentence immediately:
```typescript
const sentenceBuffer = '';
for await (const chunk of claudeStream) {
  sentenceBuffer += chunk;
  const sentences = extractCompleteSentences(sentenceBuffer);
  for (const sentence of sentences) {
    ttsService.speak(sentence); // dispatch immediately
    sentenceBuffer = sentenceBuffer.slice(sentence.length);
  }
}
if (sentenceBuffer.trim()) ttsService.speak(sentenceBuffer);
function extractCompleteSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+\s*/g) ?? [];
}
```

---

## Area 3: Claude Code CLI Integration

### Complete Flag Reference

| Flag | Purpose |
|---|---|
| `claude -p "query"` | Non-interactive (print mode), exits after response |
| `--output-format stream-json` | NDJSON output (one JSON object per line) |
| `--output-format json` | Single JSON object after completion |
| `--input-format stream-json` | Accept NDJSON on stdin (multi-turn) |
| `--include-partial-messages` | Stream text deltas in real-time |
| `--verbose` | Full turn-by-turn output |
| `--max-turns 5` | Limit agentic turns |
| `--max-budget-usd 1.00` | Spending cap |
| `--no-session-persistence` | Don't write to disk |
| `--bare` | Skip CLAUDE.md, MCP, plugins — faster startup |
| `--cwd /path/to/project` | Set working directory |
| `--session-id <uuid>` | Resume specific session |
| `--bg "task"` | Start as background agent, return session ID |
| `claude agents --json` | List running background sessions as JSON |
| `claude logs <session-id>` | Stream logs from background session |

### stream-json Event Types (NDJSON line format)

```jsonc
// Session init
{"type":"system","subtype":"init","session_id":"abc123","tools":["Bash","Read","Edit"],"cwd":"/path"}

// Text streaming
{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello "}}}

// Tool use start
{"type":"stream_event","event":{"type":"content_block_start","content_block":{"type":"tool_use","name":"Bash"}}}

// Complete assistant message
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}

// Result (final)
{"type":"result","subtype":"success","cost_usd":0.0023,"duration_ms":1842,"session_id":"abc123"}
```

### Tauri v2 Rust Implementation

```rust
// In src-tauri/src/commands.rs — add alongside run_allowed_command:
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tauri::Emitter;

#[tauri::command]
pub async fn spawn_claude_session(
    app_handle: tauri::AppHandle,
    prompt: String,
    cwd: Option<String>,
    session_id: String,
) -> Result<(), String> {
    if prompt.contains(['|', '&', ';', '$', '`', '>', '<']) {
        return Err("Invalid prompt".into());
    }
    let working_dir = cwd.unwrap_or_else(|| ".".to_string());
    let mut child = TokioCommand::new("claude")
        .args(["-p", &prompt, "--output-format", "stream-json",
               "--verbose", "--include-partial-messages", "--no-session-persistence"])
        .current_dir(&working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn claude: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let app = app_handle.clone();
    let sid = session_id.clone();

    tauri::async_runtime::spawn(async move {
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app.emit("claude_stream_event", serde_json::json!({
                "session_id": sid, "line": line,
            }));
        }
        let _ = app.emit("claude_stream_done", serde_json::json!({"session_id": sid}));
    });
    Ok(())
}
```

### Frontend TypeScript Listener Pattern

```typescript
// ClaudeSessionService.ts
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export class ClaudeSessionService {
  async startSession(
    prompt: string, cwd: string,
    onTextDelta: (text: string) => void,
    onDone: (cost: number) => void,
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    await listen<{ session_id: string; line: string }>('claude_stream_event', (event) => {
      if (event.payload.session_id !== sessionId) return;
      try {
        const parsed = JSON.parse(event.payload.line);
        if (parsed.type === 'stream_event') {
          const delta = parsed.event?.delta;
          if (delta?.type === 'text_delta') onTextDelta(delta.text);
        }
      } catch {}
    });
    await listen<{ session_id: string }>('claude_stream_done', (e) => {
      if (e.payload.session_id === sessionId) onDone(0);
    });
    await invoke('spawn_claude_session', { prompt, cwd, sessionId });
    return sessionId;
  }
}
```

### Antigravity CLI

Integration pattern is identical to Claude Code: spawn as subprocess, pipe stdin/stdout, parse JSON output. The underlying CLI binary (`claude` vs `antigravity`) is the only difference — implement a `provider` abstraction with swappable binary names.

---

## Area 4: Agent Self-Awareness & Capabilities Manifest

### SOUL.md Pattern

SOUL.md is the de facto standard for agent identity in the Claude Code ecosystem. Create `C:\Users\karim\Documents\AURA\SOUL.md`:

```markdown
# AURA — Autonomous Unified Runtime Agent

## Identity
AURA is a Tauri v2 desktop AI command center built by Karim.
Platform: Windows 11, Rust backend + React/TypeScript frontend.

## Role
AURA is the control plane for an AI-assisted development workflow.
It orchestrates Claude Code sessions, manages voice I/O, monitors running
agents, and provides a dashboard for multi-agent operations.

## Current Phase
Phase 3D — Voice pipeline hardening + CLI integration.

## Available Capabilities
- Voice: STT (OpenAI Whisper API), TTS (OpenAI TTS API)
- VAD: Web Audio API RMS detection with auto-stop on silence
- Native bridge: Allowlisted command execution via Tauri IPC
- CLI tools: claude (Claude Code), git, npm, node

## What AURA Cannot Do
- Execute arbitrary shell commands (strict allowlist enforced in Rust)
- Store API keys in plain text
- Run as a server — desktop-only
```

### Capabilities Manifest TypeScript Type

```typescript
export interface AURACapabilityManifest {
  version: string;
  buildTime: string;
  platform: { os: string; arch: string; tauriVersion: string; nativeBridgeAvailable: boolean };
  voice: { sttAvailable: boolean; ttsAvailable: boolean; vadActive: boolean; micPermission: MicPermission; wakeWordEnabled: boolean };
  cliTools: { claudeCode: boolean; antigravity: boolean; git: boolean; npm: boolean; node: boolean };
  services: { openaiKeyPresent: boolean; makeWebhookConfigured: boolean };
  identity: { name: 'AURA'; phase: string; role: string; activeAgents: string[] };
}
```

### Rust Capability Check Command

```rust
#[tauri::command]
pub fn get_capabilities() -> serde_json::Value {
    serde_json::json!({
        "platform": { "os": std::env::consts::OS, "arch": std::env::consts::ARCH },
        "cliTools": {
            "claudeCode": check_path_binary("claude"),
            "antigravity": check_path_binary("antigravity"),
            "git": check_path_binary("git"),
            "npm": check_path_binary("npm"),
        }
    })
}
fn check_path_binary(name: &str) -> bool {
    let cmd = if cfg!(target_os = "windows") { "where" } else { "which" };
    std::process::Command::new(cmd).arg(name).output()
        .map(|o| o.status.success()).unwrap_or(false)
}
```

---

## Priority Execution Order for Next Sprint

### Tier 1: Fix — Address reported bugs (already implemented in 92695d3)
1. ✅ **Hallucination gate** — `no_speech_prob` + blocklist filter in Rust
2. ✅ **Minimum size gate** — 3 KB floor before API call
3. ✅ **`verbose_json`** — per-segment no_speech_prob

### Tier 2: Enhance — Reliability improvements (1 session each)
4. **Speech-detection gate on blob dispatch** — Check `speechDetectedRef.current === false` before calling API; zero API cost savings. 1 hour.
5. **Middleware chain for transcript post-processing** — TypeScript pipeline that can add future filters without changing core logic. 2 hours.

### Tier 3: Expand — New capabilities (1-2 days each)
6. **Claude Code CLI integration** — `spawn_claude_session` Tauri command + `ClaudeSessionService.ts` + stream-JSON event listener. 1 day.
7. **Capabilities manifest + CapabilityService** — AURA self-reports what it can do. 1 day.
8. **AURA SOUL.md** — Identity file for when Claude acts as AURA. 2 hours.
9. **Antigravity CLI integration** — Same as Claude Code with provider abstraction. Half-day.
10. **Sentence boundary TTS streaming** — Dispatch sentences to TTS as LLM streams. Half-day.

---

## Key Source References

- [openai/whisper Discussion #679 — hallucination solutions](https://github.com/openai/whisper/discussions/679)
- [arxiv 2501.11378 — Investigation of Whisper Hallucinations](https://arxiv.org/html/2501.11378v1)
- [faster-whisper (23.2k stars)](https://github.com/SYSTRAN/faster-whisper)
- [WhisperX (22.2k stars)](https://github.com/m-bain/whisperX)
- [RealtimeSTT (9.8k stars)](https://github.com/KoljaB/RealtimeSTT)
- [pipecat-ai/pipecat (12.5k stars)](https://github.com/pipecat-ai/pipecat)
- [sachaarbonel/whisper-hallucinations dataset](https://huggingface.co/datasets/sachaarbonel/whisper-hallucinations)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
- [SOUL.md framework](https://www.soul-md.xyz/)
- [Tauri async Rust process](https://rfdonnelly.github.io/posts/tauri-async-rust-process/)
- [google-antigravity/antigravity-cli](https://github.com/google-antigravity/antigravity-cli)

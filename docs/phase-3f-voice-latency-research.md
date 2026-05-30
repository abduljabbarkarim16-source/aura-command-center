# Phase 3F Voice Latency Research

**Compiled**: 2026-05-30  
**Purpose**: Document findings on low-latency voice agent architectures to guide AURA Phase 3G

---

## What Request-Based STT → LLM → TTS Can Realistically Achieve

The current AURA architecture is:

```
Speech → MediaRecorder → Whisper API → gpt-4o-mini → tts-1 → Audio playback
```

Each step is a synchronous HTTP request. The theoretical minimum for this chain:

| Step | Theoretical Min | Real World (gpt-4o-mini + tts-1) |
|---|---|---|
| STT (Whisper) | 300ms | 500–1200ms |
| Chat (gpt-4o-mini) | 200ms | 500–2000ms |
| TTS synthesis (tts-1) | 200ms | 400–1200ms |
| **Total to first audio** | **700ms** | **1400–4400ms** |

**Realistic best case with optimizations**: ~1.2–1.8 seconds to first audio.  
**Realistic average without optimizations**: 2–5 seconds.

---

## Why Current Fast Mode Still Feels Slow

1. **Same model, same token budget**: `createFastChatResponse` was calling the same `openai_chat_response` command with `max_tokens = 300`. No shorter generation = no latency reduction.

2. **No acknowledgement gap fill**: After speech ends, there is silence until first audio plays. Even 1.5 seconds of silence feels like a crash.

3. **No prompt optimization for fast path**: The 'brief' style allows 1–3 sentences. The truly fast path should force ≤12 words.

4. **TTS blocks on full text**: Even with sentence-first TTS, if the first sentence is 50+ words, TTS synthesis itself takes 500–800ms.

---

## What Can Be Improved Without Realtime

### Short-term (Phase 3F QA):
- **Instant visual ack**: Show "Got it." at 0ms after speech pause. No API call. Fills the silence perceptually.
- **Ultra-low-token fast command**: New Rust command `openai_fast_chat_response` with `max_tokens = 40`. Forces ≤12-word reply. Cuts chat latency from ~1000ms to ~300–500ms.
- **Skip history for fast path**: Zero history in fast mode = smaller request payload = ~50ms saved.
- **Aggressive TTS for short text**: A 10-word reply synthesizes in ~300ms with tts-1.

### Medium-term (Phase 3G prep):
- **Streaming LLM + sentence detection**: Start TTS synthesis as soon as first sentence boundary is detected in the stream. Reduces chat→TTS gap from sequential to overlapping.
- **Edge TTS**: Self-hosted Piper TTS or CoquiTTS for sub-100ms synthesis on local GPU.
- **Faster Whisper**: faster-whisper (CTranslate2) running locally can transcribe 5s of audio in ~100ms on modern CPU.

### Long-term (Phase 3G):
- OpenAI Realtime API (WebRTC) — see below.

---

## OpenAI Realtime API

**What it is**: WebRTC-based full-duplex voice session. OpenAI handles VAD, STT, and streaming TTS in one WebSocket/WebRTC connection. No discrete API calls.

**Latency**: Server-side VAD detects speech end → first audio chunk returns in ~300–500ms.

**Key endpoints**:
- `POST /v1/realtime/sessions` — create ephemeral client secret (backend only)
- WebRTC peer connection — negotiated from frontend using the ephemeral token

**Security constraint for AURA**: The OpenAI API key must NEVER reach the frontend. The ephemeral client secret has a 60-second TTL and is safe to send to the frontend. Backend creates it via Tauri command.

**Tauri command needed**:
```rust
#[tauri::command]
pub async fn create_openai_realtime_session() -> Result<RealtimeSessionResponse, String>
```
Returns `{ client_secret: { value: "...", expires_at: N } }` — ephemeral token only.

**Frontend flow**:
1. Call `create_openai_realtime_session` via `invoke()`
2. Use returned `client_secret.value` to create WebRTC peer connection
3. Audio tracks go directly to OpenAI's media server
4. Response audio streams back via WebRTC audio track

---

## Pipecat

**What it is**: Open-source real-time AI voice agent framework (Daily Bots). Handles STT → LLM → TTS pipeline with streaming.

**Architecture**: Python server, WebRTC transport via Daily or LiveKit.

**Relevance to AURA**: High for Phase 3G. Could replace the request-based pipeline entirely. Runs as a local server process that AURA's Tauri backend spawns.

**Key project**: `pipecat-ai/pipecat` on GitHub.

**Latency**: Sub-500ms first audio with streaming LLM + streaming TTS (e.g., Deepgram Nova + ElevenLabs turbo).

---

## LiveKit Agents

**What it is**: LiveKit's open-source agent framework. Real-time voice agents using WebRTC transport.

**Architecture**: Python agent server connects to LiveKit room. Frontend connects as participant.

**Latency**: ~400–700ms to first spoken word with GPT-4o streaming + TTS streaming.

**Relevance to AURA**: Phase 3G candidate. Requires a LiveKit server (self-hosted or LiveKit Cloud).

---

## RealtimeSTT / faster-whisper

**RealtimeSTT** (`KoljaB/RealtimeSTT`): Python library that streams audio chunks to faster-whisper and returns partial + final transcripts in real time.

**faster-whisper**: 4–10x faster than OpenAI Whisper API for local transcription. On a modern CPU, transcribes 5s audio in 80–200ms.

**Relevance to AURA**: Replace `whisper-1` API call with local faster-whisper for zero-network STT latency. Requires a local Python process (Tauri sidecar).

---

## Deepgram Realtime Transcription

**What it is**: Streaming STT via WebSocket. Sends audio chunks continuously, receives partial/final transcripts in real time.

**Latency**: ~300–500ms from speech end to final transcript.

**Advantage over Whisper**: No waiting for speech to end — can start LLM with high-confidence partial transcript.

**Relevance to AURA**: Phase 3G STT replacement. Would require a WebSocket connection from Tauri backend to Deepgram.

---

## AssemblyAI Realtime Transcription

Similar to Deepgram. Streaming WebSocket STT with partial transcripts.

**Latency**: ~200–400ms after speech ends.

---

## ElevenLabs Low-Latency TTS

**ElevenLabs streaming TTS**: Streams MP3 chunks as they're synthesized. First audio chunk arrives in ~100–200ms.

**turbo v2.5**: Fastest model. Comparable latency to OpenAI tts-1 but supports chunk streaming.

**Relevance to AURA**: Phase 3G TTS replacement. Would allow first audio to play before synthesis completes — even for long responses.

---

## Top Recommended Architecture for AURA

### Phase 3F QA (now): Request-based with ack layer
```
Speech end → "Got it." visual (0ms) → openai_fast_chat_response (40 tok, ~400ms) → tts-1 short text (~300ms) → first audio (~700ms total)
```

### Phase 3G (next): Streaming pipeline
```
faster-whisper partial → gpt-4o-mini streaming → sentence detection → tts-1 first sentence → audio starts
Target: ~800ms–1.2s total
```

### Phase 3H (future): Full realtime
```
OpenAI Realtime API WebRTC or Pipecat + Deepgram + ElevenLabs
Target: ~300–500ms total
```

---

## Short-Term Fixes (Phase 3F QA)

1. **New Rust command** `openai_fast_chat_response` — `max_tokens = 40`, no history, 1-sentence forced
2. **Frontend fast path uses new command** — not the 300-token normal path
3. **Instant visual acknowledgement** — "Got it." shown at 0ms after speech capture
4. **Status phases in UI** — heard / transcribing / thinking / preparing voice / speaking
5. **Latency metrics visible** — `perceivedLatencyMs` chip in transcript panel

---

## Long-Term Phase 3G Plan

| Component | Replace With | Target Latency Improvement |
|---|---|---|
| Whisper API (remote) | faster-whisper local sidecar | 500ms → 100ms |
| gpt-4o-mini request-response | gpt-4o streaming + sentence detection | 800ms → first-token ~200ms |
| tts-1 full-text synthesis | ElevenLabs streaming or chunk-first tts-1 | 500ms → first-chunk ~150ms |
| No-VAD silence detection | RealtimeSTT VAD (local) | Eliminates recording overhead |
| **Total** | | **~1500ms → ~500ms** |

Full realtime (Phase 3H) requires OpenAI Realtime API WebRTC or Pipecat + LiveKit.

---

## References

- OpenAI Realtime API: `platform.openai.com/docs/guides/realtime`
- Pipecat: `github.com/pipecat-ai/pipecat`
- LiveKit Agents: `github.com/livekit/agents`
- RealtimeSTT: `github.com/KoljaB/RealtimeSTT`
- faster-whisper: `github.com/SYSTRAN/faster-whisper`
- Deepgram streaming: `developers.deepgram.com/docs/streaming`
- ElevenLabs streaming TTS: `elevenlabs.io/docs/api-reference/streaming`

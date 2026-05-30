# Phase 3F QA: Fast Voice and CLI Task Controls

**Branch**: `phase-3f-qa-fast-voice-cli-ui`  
**Base**: Phase 3F (`4a6b604`)  
**Date**: 2026-05-30  

---

## Manual QA Results (Pre-Fix State)

| Feature | Status | Notes |
|---|---|---|
| Conversation mode | ✅ Works | Hands-free loop, auto-listen, barge-in all functional |
| 20+ second speech | ✅ Works | Segmented session assembles long transcripts correctly |
| Terminal git status | ✅ Works | Tool returns current branch + status |
| Terminal npm lint | ✅ Works | Runs lint in configured workspace |
| Fast Mode | ❌ Too slow | First audio still takes 2–5 seconds after speech ends |
| Background Tasks / CLI panel | ⚠️ Partial | Services exist; no dedicated visible panel |
| Claude/Codex CLI controls | ⚠️ Partial | Services exist; no UI test buttons |

---

## Fast Mode Failure Analysis

### What Fast Mode is supposed to do
1. After speech ends → immediately show acknowledgement
2. Send short prompt to fast model → get 1-sentence reply
3. Start TTS for that sentence immediately
4. Play it, then continue with full response in background

### What actually happens (root cause)

**Root cause 1 — `createFastChatResponse` is not faster than normal chat:**
- Both fast and normal paths call the same Rust command `openai_chat_response`
- Both use `CHAT_MODEL = "gpt-4o-mini"`
- Both use `MAX_RESPONSE_TOKENS = 300`
- The fast path only differs by sending 2 history items instead of 5 — negligible difference

**Root cause 2 — No instant acknowledgement:**
- After speech stops, AURA enters `thinking` state silently
- There is no immediate visual or audio ack before the API call starts
- The user experiences a 2–5 second dead silence gap

**Root cause 3 — Full context sent even in fast mode:**
- The fast path should use zero history and a strict 1-sentence system prompt
- Currently it sends `history.slice(-2)` and uses 'brief' style which still allows multi-sentence output

### Latency budget (request-based voice, observed)

| Stage | Typical Duration | Notes |
|---|---|---|
| STT (Whisper) | 500–1200ms | Already happening concurrently in segmented mode |
| Chat (gpt-4o-mini, 300 tok) | 800–2500ms | Dominant bottleneck |
| TTS (tts-1, full response) | 500–1500ms | Depends on response length |
| Audio playback start | 0–50ms | Negligible |
| **Perceived total** | **1800–5200ms** | User waits this long after speech ends |

### Target latency

| Target | Value |
|---|---|
| Ideal: first acknowledgement after pause | 200–500ms (visual) |
| Good: first audio start | 1500–2500ms |
| Current Fast Mode | 2000–5000ms (no improvement over Normal) |

---

## Fixes Applied in This QA Pass

### Fix 1: New Rust command `openai_fast_chat_response`
- `max_tokens: 40` (was 300)
- No conversation history
- System prompt forces single sentence, max 12 words
- Same `gpt-4o-mini` model

### Fix 2: Frontend `createFastChatResponse` uses new command
- Calls `openai_fast_chat_response` instead of `openai_chat_response`
- Expects 1 short sentence in return

### Fix 3: Instant visual acknowledgement layer
- As soon as transcript is captured, `loopPhase` transitions via a new `acknowledging` sub-state
- `liveTranscript` shows "Got it." / "Checking." / "On it." immediately
- No TTS API call for acknowledgement — visual only (default)

### Fix 4: Status phases exposed to UI
- heard → transcribing → thinking → preparing voice → speaking
- Each phase shown in the transcript panel with distinct labels

### Fix 5: Background Tasks panel
- New `BackgroundTasksPanel` component shows CLI status
- Claude CLI and Codex CLI availability checks
- Tiny test buttons (approval required)

---

## How to Test Fast Mode

1. Open AURA in dev mode
2. Enable Conversation Mode (click Conv button)
3. Enable Fast Mode (⚡ button turns amber)
4. Say a short question ("What time is it?")
5. After speech pause: you should see "Got it." within 500ms
6. First audio should play within 2.5 seconds
7. Check latency chip in transcript panel

**Compare with Balanced mode:**
- Toggle ⚡ off
- Same question
- First audio should take measurably longer

---

## How to Read Latency Metrics

The `⏱ NNNms` chip in the transcript panel shows `perceivedLatencyMs`.  
Hover for full breakdown:
- STT time (Whisper)
- Chat request time
- TTS synthesis time
- Audio playback start

Full history in: `localStorage['aura.voice.latency.history']`

---

## How to Use Background Tasks

1. Open Admin panel
2. Click "Background Tasks" tab
3. Panel shows:
   - Claude CLI: available / unavailable / auth required
   - Codex CLI: available / unavailable / auth required
   - Active sessions
   - Failed sessions
4. "Check Claude" button runs discovery
5. "Tiny Test" button requires approval, sends: `Reply exactly: AURA_CLAUDE_CLI_OK`

---

## Limitations Before True Realtime Voice

| Limitation | Impact |
|---|---|
| STT is request-based (Whisper) | Cannot stream partial transcripts during speech |
| Chat is request-response (OpenAI) | Cannot stream tokens to TTS in real time |
| TTS is request-based (tts-1) | Must receive full audio before playback |
| Minimum perceived latency | ~1.5s even with all optimizations |
| WebRTC Realtime API | Requires Phase 3G — separate implementation plan |

For sub-1s response latency, the OpenAI Realtime API (WebRTC) is required.  
See: `docs/openai-realtime-implementation-plan.md`

---

## Remaining Blockers Before True Realtime WebRTC Voice

1. OpenAI Realtime API ephemeral session requires backend bridge (Tauri command)
2. WebRTC negotiation must happen in Rust or a secure proxy
3. Frontend must handle streaming audio chunks (Web Audio API)
4. VAD for Realtime must move to server-side (OpenAI handles it)
5. Barge-in detection already exists but must be wired to WebRTC channel close
6. Security review needed before exposing any WebRTC peer connection

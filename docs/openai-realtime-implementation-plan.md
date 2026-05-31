# Phase 3G / 3H — OpenAI Realtime API WebRTC Voice Support

**Status:** Planning (Phase 3F QA merged, commit 17f45ed)  
**Goal:** Break the 500 ms first-audio barrier via OpenAI Realtime API  
**Target latency:** < 300 ms perceived end-to-end

---

## 1. What the OpenAI Realtime API Is and Why It Is Needed

The OpenAI Realtime API is a persistent, bidirectional audio session that combines STT, LLM reasoning, and TTS into a single WebRTC connection. Unlike the request-response pattern used in Phase 3F, audio is streamed continuously in both directions: the server begins synthesizing speech while it is still generating tokens.

### Current baseline (Phase 3F — Fast Mode)

| Leg | Latency |
|-----|---------|
| STT (Whisper HTTP) | 200–400 ms |
| LLM first token (Claude streaming) | 300–600 ms |
| TTS first chunk (OpenAI TTS HTTP) | 150–300 ms |
| **Total first audio** | **700–1 500 ms** |

### Why HTTP can't close the gap

Each HTTP call incurs a full round-trip plus cold-start overhead. Even with aggressive sentence-first TTS (Phase 3G), three sequential HTTP calls impose a floor of roughly 500 ms on a fast connection. The Realtime API collapses all three into a single persistent channel where the server pipeline runs concurrently, targeting:

| Leg | Realtime API |
|-----|-------------|
| STT (server-side VAD + Whisper) | ~0 ms additional (streamed in) |
| LLM first token | ~150–250 ms |
| TTS first chunk | begins before LLM finishes |
| **Total first audio** | **< 300 ms** |

---

## 2. Security Architecture — Ephemeral Token, Key Never in Frontend

The AURA security model requires that the raw OpenAI API key remain exclusively in Rust. The Realtime API supports this via a two-step auth flow.

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri Rust backend                                         │
│                                                             │
│  1. Holds OPENAI_API_KEY in encrypted Tauri store           │
│  2. On demand: POST /v1/realtime/sessions with the key      │
│  3. Receives { client_secret: { value, expires_at } }       │
│  4. Returns ONLY the client_secret object to the frontend   │
│                                                             │
│  ← Raw API key never crosses the IPC boundary →            │
└──────────────────────────────┬──────────────────────────────┘
                               │ IPC: invoke("create_openai_realtime_session")
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  React frontend                                             │
│                                                             │
│  5. Receives client_secret.value (60 s TTL ephemeral token) │
│  6. Opens RTCPeerConnection using the ephemeral token       │
│  7. Streams mic audio → server, receives TTS audio ← server │
│  8. Token expires; connection closes; key was never exposed │
└─────────────────────────────────────────────────────────────┘
```

**Threat model notes:**
- The ephemeral token is single-use-session scoped and expires after 60 seconds regardless of use.
- Even if the frontend process were compromised, the attacker obtains only a short-lived session credential, not the API key.
- The Rust command must validate that the calling window is the trusted AURA frontend before issuing a token (origin check via Tauri allowlist).

---

## 3. Rust Tauri Command — `create_openai_realtime_session`

### Command signature

```rust
#[tauri::command]
pub async fn create_openai_realtime_session(
    state: tauri::State<'_, AppState>,
) -> Result<RealtimeSessionResponse, String> {
    let api_key = state.openai_key.read().await
        .clone()
        .ok_or("OpenAI API key not configured")?;

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/realtime/sessions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": "gpt-4o-realtime-preview-2024-12-17",
            "voice": "alloy"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Realtime session creation failed {}: {}", status, body));
    }

    resp.json::<RealtimeSessionResponse>()
        .await
        .map_err(|e| e.to_string())
}
```

### Response type

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ClientSecret {
    pub value: String,        // ephemeral token for WebRTC
    pub expires_at: u64,      // unix timestamp, ~60 s from now
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RealtimeSessionResponse {
    pub id: String,
    pub object: String,
    pub model: String,
    pub voice: String,
    pub client_secret: ClientSecret,
}
```

### Tauri allowlist entry

```json
{
  "tauri": {
    "allowlist": {
      "http": {
        "all": false,
        "request": true,
        "scope": ["https://api.openai.com/v1/realtime/*"]
      }
    }
  }
}
```

The command must be registered in `main.rs` or the command handler module:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    create_openai_realtime_session,
])
```

---

## 4. Frontend WebRTC Flow

The React frontend uses the ephemeral token to open a WebRTC peer connection directly to OpenAI's Realtime servers. No audio data routes through the Tauri backend.

### Step-by-step

```typescript
async function startRealtimeSession(): Promise<void> {
  // 1. Obtain ephemeral token from Rust backend
  const session = await invoke<RealtimeSessionResponse>(
    "create_openai_realtime_session"
  );
  const ephemeralKey = session.client_secret.value;

  // 2. Create RTCPeerConnection
  const pc = new RTCPeerConnection();

  // 3. Add audio output element — server TTS arrives here
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };

  // 4. Capture microphone and add as input track
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  pc.addTrack(stream.getTracks()[0]);

  // 5. Create SDP offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // 6. Exchange SDP with OpenAI Realtime endpoint using ephemeral token
  const sdpResponse = await fetch(
    "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    }
  );
  const answerSdp = await sdpResponse.text();

  // 7. Complete WebRTC handshake
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  // 8. Open data channel for events (transcript, VAD events, etc.)
  const dc = pc.createDataChannel("oai-events");
  dc.onmessage = handleRealtimeEvent;
}
```

### State machine

```
IDLE
  │  user triggers voice
  ▼
REQUESTING_TOKEN  (invoke Rust command)
  │  client_secret received
  ▼
WEBRTC_HANDSHAKE  (SDP offer/answer)
  │  ICE connected
  ▼
LISTENING         (mic streaming, server VAD active)
  │  server speech_started event
  ▼
USER_SPEAKING
  │  server speech_stopped event (VAD silence)
  ▼
PROCESSING        (LLM generating)
  │  server response.audio.delta event
  ▼
SPEAKING          (TTS playing)
  │  response.done event
  ▼
LISTENING         (back to waiting)
```

---

## 5. VAD, STT, and TTS Shift to Server-Side

With the Realtime API, the three client-side processing stages are replaced by server-managed equivalents.

| Concern | Phase 3F (client) | Phase 3H (server) |
|---------|-------------------|-------------------|
| **VAD** | Client JS energy detector; custom silence timer | OpenAI server-side VAD; `speech_started` / `speech_stopped` events delivered over data channel |
| **STT** | HTTP POST to Whisper endpoint after recording stops | Continuous streaming transcription; `conversation.item.input_audio_transcription.completed` event |
| **TTS** | HTTP POST to TTS endpoint per sentence | Audio delta chunks streamed directly into the WebRTC audio track in real time |

### VAD configuration (sent via data channel)

```json
{
  "type": "session.update",
  "session": {
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.5,
      "prefix_padding_ms": 300,
      "silence_duration_ms": 500
    }
  }
}
```

The `threshold`, `prefix_padding_ms`, and `silence_duration_ms` values should be surfaced as user-configurable settings in the AURA Settings panel, matching the existing VAD-lite tuning controls.

---

## 6. Barge-In Integration

The Realtime API provides native barge-in: when the server VAD detects user speech while TTS is playing, it emits an `input_audio_buffer.speech_started` event. The frontend must:

1. Stop the audio element playback immediately.
2. Send a `response.cancel` message over the data channel to halt server TTS generation.
3. Transition state machine from `SPEAKING` → `USER_SPEAKING`.

```typescript
function handleRealtimeEvent(event: MessageEvent): void {
  const msg = JSON.parse(event.data);

  if (msg.type === "input_audio_buffer.speech_started") {
    // Barge-in detected
    audioEl.pause();
    audioEl.srcObject = null; // flush buffered audio
    dc.send(JSON.stringify({ type: "response.cancel" }));
    setState("USER_SPEAKING");
  }

  if (msg.type === "response.audio.delta") {
    // Resume/start playback — handled automatically by the audio element
    setState("SPEAKING");
  }

  if (msg.type === "response.done") {
    setState("LISTENING");
  }
}
```

This replaces the Phase 3D barge-in implementation (client-side energy threshold → stop recording → discard partial response) with server-confirmed voice detection, which is more accurate at low SNR.

---

## 7. What Blocks Implementation Today

### 7.1 Tauri WebRTC support

Tauri's WebView (WebView2 on Windows, WKWebView on macOS) hosts a browser context that supports the WebRTC APIs, but:

- **`navigator.mediaDevices.getUserMedia`** requires that the WebView be served from a secure origin (`https://` or `localhost`). Tauri's default `tauri://localhost` protocol satisfies this on macOS; on Windows it may require the `--allow-insecure-localhost` CSP flag or a custom protocol handler.
- **ICE candidate gathering** may be blocked by Windows Defender Firewall on first run. The installer or first-run setup should prompt for the network exception.
- The Tauri allowlist must explicitly permit outbound `fetch` to `https://api.openai.com/v1/realtime` from the frontend (distinct from the Rust-side HTTP scope).

### 7.2 Testing environment

- WebRTC loopback testing requires a real microphone or a virtual audio device (e.g., VB-Cable on Windows).
- CI pipelines (GitHub Actions) have no audio device; Realtime API tests must be tagged `#[ignore]` or gated behind a `OPENAI_REALTIME_INTEGRATION` env flag.
- The OpenAI Realtime API is not available in free-tier accounts; a paid key with `gpt-4o-realtime-preview` access is required.

### 7.3 Dependency on Phase 3G

Full WebRTC rollout (Phase 3H) assumes the sentence-first streaming TTS pipeline from Phase 3G is already deployed and validated. If 3G ships first, the latency improvement is immediately measurable and 3H becomes a drop-in replacement of the transport layer only.

---

## 8. Phase Split: 3G vs 3H

### Phase 3G — Streaming LLM + Sentence-First TTS (HTTP, no WebRTC)

Achievable with the current Tauri architecture and no WebRTC changes.

**Changes:**
- Stream Claude response tokens over SSE.
- Detect first sentence boundary (`.`, `?`, `!` followed by whitespace or end-of-stream).
- Fire TTS HTTP request for the first sentence immediately; queue remaining sentences.
- Play audio chunks as they arrive (Web Audio API or `<audio>` with `MediaSource`).

**Estimated latency:**

| Leg | Target |
|-----|--------|
| STT | 200–350 ms |
| LLM first sentence | 200–400 ms |
| TTS first chunk (sentence) | 100–200 ms |
| **Total first audio** | **500–950 ms** |

**Risk:** Low. Pure frontend + existing Rust HTTP commands. No new native permissions needed.

---

### Phase 3H — Full WebRTC Realtime API

Replaces the three-HTTP-call pipeline with a single persistent WebRTC session.

**Changes:**
- New Rust command: `create_openai_realtime_session` (see §3).
- New React hook: `useRealtimeSession` managing the `RTCPeerConnection` lifecycle.
- Replace `useVoiceRecorder` + `useSpeechToText` + `useTTS` with a single `useRealtimeAudio` hook.
- Settings panel: expose `turn_detection.threshold`, `silence_duration_ms`.
- Fallback: if `RTCPeerConnection` is unavailable or the session token request fails, fall back to Phase 3G pipeline automatically.

**Estimated latency:**

| Leg | Target |
|-----|--------|
| Token request (Rust → OpenAI) | 50–100 ms (one-time per session) |
| WebRTC handshake | 100–200 ms (one-time per session) |
| STT (streaming, overlapped) | ~0 ms additional |
| LLM first token | 150–250 ms |
| TTS first chunk | begins at ~100 ms after first token |
| **Total first audio (after session open)** | **< 300 ms** |

**Risk:** Medium. Depends on Tauri WebView WebRTC compatibility (§7.1). Recommend a feature flag `VITE_ENABLE_REALTIME_WEBRTC=true` to allow production rollout without affecting existing users until validated.

---

## 9. Latency Summary by Phase

| Phase | Mechanism | First Audio | Notes |
|-------|-----------|-------------|-------|
| 3F (current) | HTTP STT + HTTP LLM + HTTP TTS | 700–1 500 ms | Merged to main (17f45ed) |
| 3G (next) | HTTP STT + streaming LLM + sentence-first HTTP TTS | 500–950 ms | No WebRTC required |
| 3H (target) | OpenAI Realtime API WebRTC | < 300 ms | Requires ephemeral token + WebView WebRTC |

---

## Appendix: Key References

- OpenAI Realtime API overview: https://platform.openai.com/docs/guides/realtime
- Realtime WebRTC guide: https://platform.openai.com/docs/guides/realtime-webrtc
- Session creation endpoint: `POST https://api.openai.com/v1/realtime/sessions`
- Model: `gpt-4o-realtime-preview-2024-12-17`
- Tauri HTTP allowlist docs: https://tauri.app/v1/api/config/#allowlistconfig.http
- Phase 3F design doc: [phase-3f-fast-voice-agent-cli-runner.md](phase-3f-fast-voice-agent-cli-runner.md)
- Phase 3D VAD/barge-in design: [phase-3d-realtime-voice-upgrade.md](phase-3d-realtime-voice-upgrade.md)

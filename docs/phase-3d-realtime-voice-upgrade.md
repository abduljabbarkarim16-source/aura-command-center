# Phase 3D — Realtime Voice Conversation Upgrade

**Branch:** `phase-3d-realtime-voice-conversation-upgrade`
**Base:** Phase 3C (v0.3.3) — push-to-talk MVP working

---

## Current Push-to-Talk Flow (Step by Step)

1. User clicks **Speak** button → `handleSpeakStart()` called
2. `setConvPhase('connecting')` — button goes disabled with "Starting…"
3. `recorder.startRecording()` — requests mic permission via `getUserMedia`, creates `MediaRecorder`
4. Recording starts; `recordStartTimeRef` captures start time; `setConvPhase('recording')`
5. User speaks; MediaRecorder collects audio in 100ms chunks
6. User clicks **Done** → `handleSpeakStop()` called
7. Guards: must be in 'recording' phase; minimum 400ms elapsed; `runningRef` lock set
8. `setConvPhase('transcribing')`; `recorder.stopRecording()` awaited → `Blob`
9. Blob validated (non-empty check)
10. `openai_transcribe_audio` Tauri invoke → Whisper STT → transcript text (network call ~1-3s)
11. `setConvPhase('thinking')`; live transcript updated with user text
12. `openai_chat_response` Tauri invoke → GPT-4o-mini → response text (network call ~1-2s)
13. Turn stored in history; live transcript updated with AURA text
14. `openai_synthesize_speech` Tauri invoke → TTS MP3 bytes (network call ~1-2s)
15. Bytes converted to Blob URL; `setConvPhase('speaking')`; `Audio` object plays
16. On audio end: `setConvPhase('idle')`; URL revoked; `runningRef` released

**Total latency:** 3-7 seconds for a typical short exchange (network-bound, sequential).

---

## Why It Feels Slow

The pipeline is entirely **sequential**:

```
record → stop → STT (network) → chat (network) → TTS (network) → play
```

Each step must complete before the next starts. No streaming, no parallelism, no overlap.

- STT: ~1-3s (Whisper on OpenAI servers)
- Chat: ~1-2s (GPT-4o-mini, short prompt)
- TTS: ~0.5-2s (OpenAI TTS-1)
- **Total cold-path:** 2.5-7 seconds

The user also must manually click Done — there is no automatic detection of when they stop speaking, adding cognitive overhead and sometimes confusion about whether AURA heard them.

---

## Long Speech Failure Risks

| Risk | Description | Current Cap | Phase 3D Cap |
|------|-------------|-------------|-------------|
| Backend audio cap | `MAX_AUDIO_BYTES = 10MB` in `voice_commands.rs` | ~10min of compressed audio | Raised to 25MB |
| Whisper file limit | OpenAI Whisper API hard limit is 25MB per file | Not enforced client-side | Enforced at 24MB |
| WebView MediaRecorder | No known hard cap in Tauri WebView2; chunks accumulate | Duration cap 15s (soft) | Raised to 30s via VAD |
| Empty blob | Very short recordings (< ~200 bytes) produce empty transcript | 400ms guard | Unchanged |
| Blob too small for speech | Audio exists but contains only silence/noise | Not detected | Added: < 200 bytes + > 500ms → warning |

---

## Wake Phrase Current State

**Not implemented.** There is no continuous background listening, no `SpeechRecognition` usage, and no "Hey AURA" detection.

**WebView2 (Tauri on Windows) compatibility note:** `window.SpeechRecognition` is present in Chromium-based WebView2 but its behavior depends on the Windows version and WebView2 runtime version. It requires microphone access, and `continuous: true` mode may be unreliable. Testing on the target machine is required before relying on it.

---

## Desired Realtime Path (Future)

```
mic stream → VAD → partial transcript → chat stream → TTS stream → audio play
     ↑                                                                    |
     └──────────────── barge-in interrupt ───────────────────────────────┘
```

This requires OpenAI Realtime API (WebRTC) with Tauri bridge for ephemeral token minting, plus full-duplex audio routing — a significant engineering lift documented as Phase 3E+.

---

## Planned Implementation Stages (Phase 3D)

### Stage 1 — Auto-stop on Silence (VAD-lite)
**Hook:** `useVoiceActivityRecorder.ts`
- Web Audio API `AnalyserNode` measures RMS amplitude every 100ms
- If RMS < threshold for 1200ms AND >= 400ms of speech detected → auto-stop
- `vadPhase` state: `idle | connecting | recording | speech_detected | silence_detected | auto_stopping`
- Falls back to manual stop if VAD never triggers
- Max duration: 30s (raised from 15s)

### Stage 2 — Better Long-Speech Handling
**File:** `AuraVoiceCore.tsx` → `handleSpeakStop`
- Allow blobs up to 24MB (Whisper actual limit)
- Blob size too large (> 24MB) → user-facing error message
- Blob < 200 bytes with duration > 500ms → mic level warning
- Blob > 500KB → "Long thought captured, processing…" status
- Raise backend `MAX_AUDIO_BYTES` to 25MB in `voice_commands.rs`

### Stage 3 — Interruptible AURA Speech (Barge-in)
**File:** `AuraVoiceCore.tsx`
- If user clicks Speak while AURA is speaking: pause audio, revoke URL, reset phase to idle, start recording
- `handleSpeakStart` updated to detect and handle barge-in case
- Brief "Interrupted" status in transcript panel
- Existing Skip/Stop button remains

### Stage 4 — Conversation Flow & UI Improvements
**File:** `AuraVoiceCore.tsx`
- Button labels: "Starting…" / "Finish" / "Processing…" / "Thinking…" / "Interrupt" / "Speak"
- VAD phase labels in You row: speech_detected / silence_detected / auto_stopping
- Status strip indicators for auto-stop and wake phrase status
- Use `useVoiceActivityRecorder` when `autoStopEnabled` is true

### Stage 5 — Wake Phrase Prototype
**Hook:** `useWakePhrase.ts`
- Uses `window.SpeechRecognition` if available (WebView2-dependent)
- Detects "hey aura", "aura", "aurora", "hey ora", "hey laura" (common mishearings)
- Status: `disabled | unavailable | listening | activated`
- If unavailable: disabled UI with explanation
- Amber badge in Zone 1 when active

### Stage 6 — Response Quality Tuning
**File:** `voice_commands.rs`
- Improved system prompt (no filler phrases, voice-first rules)
- Response style support: `brief` (1 sentence) / `normal` (2-3) / `detailed` (up to 5)
- `MAX_RESPONSE_TOKENS` raised from 150 to 300
- `openai_chat_response` accepts `response_style: Option<String>`

### Stage 7 — Settings Panel Updates
**File:** `VoiceReadinessCard.tsx`
- Auto-stop toggle, silence threshold selector, max duration selector
- Interrupt toggle, wake phrase toggle (with amber warning), response style selector

### Stage 8 — Optional Make.com Test Event (developer-only)
**File:** `AuraVoiceCore.tsx`
- `sendPhase3DTestEvent()` function in Details drawer only
- No transcript, no audio, no API keys in payload
- Silent skip if Make.com not configured

---

## Stage 9 — True Realtime WebRTC (Future / Phase 3E+)

Not implemented in Phase 3D. Requires:
1. Tauri backend: Ephemeral token minting via `/v1/realtime/sessions`
2. WebRTC peer connection setup in frontend
3. Audio track routing through WebRTC instead of MediaRecorder
4. Event-driven transcript via WebSocket data channel
5. Significant new Tauri command surface (ICE, DTLS, SRTP)

**Estimated effort:** 3-5 days, gated on OpenAI Realtime API production stability.

---

## Files Modified in Phase 3D

| File | Change |
|------|--------|
| `src/types/voice-session.ts` | Add new settings fields to `VoiceConversationSettings` |
| `src/hooks/useVoiceActivityRecorder.ts` | New — VAD-lite hook |
| `src/hooks/useWakePhrase.ts` | New — wake phrase prototype |
| `src/components/operator/AuraVoiceCore.tsx` | VAD integration, barge-in, UI updates |
| `src/components/operator/VoiceReadinessCard.tsx` | New settings controls |
| `src/services/voice/OpenAIVoiceSessionService.ts` | `createChatResponse` accepts `responseStyle` |
| `src-tauri/src/voice_commands.rs` | Better prompt, response style, raised limits |

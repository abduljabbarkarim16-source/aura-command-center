# AURA Phase 3C — Voice Conversation MVP

**Date:** 2026-05-29  
**Branch:** phase-3c-voice-conversation-mvp  
**Agent:** Claude Sonnet 4.6 (Anthropic)

---

## Architecture

```
User clicks Speak
  → Browser MediaRecorder (useVoiceRecorder hook)
  → User clicks Stop (or 15 s max-duration fires)
  → Audio Blob → Tauri invoke('openai_transcribe_audio')
    → Rust: POST /v1/audio/transcriptions (Whisper)
    → Returns transcript text
  → Tauri invoke('openai_chat_response', { transcript, history })
    → Rust: POST /v1/chat/completions (gpt-4o-mini, max 150 tokens)
    → Returns AURA text response
  → Tauri invoke('openai_synthesize_speech', { text, voice })
    → Rust: POST /v1/audio/speech (tts-1)
    → Returns audio bytes (MP3)
  → Frontend: Blob URL → HTMLAudioElement.play()
  → Visualizer reacts to each phase
  → Turn stored in conversation panel
```

---

## Microphone Permission Behaviour

- Permission is **never requested on app launch**
- `getUserMedia()` is called only when the user clicks **Speak** with Voice Conversation enabled
- If denied: a clear error message appears below the orb; Speak button is disabled
- If unsupported: same messaging

---

## STT / TTS / Chat Provider

| Operation | Provider | Model | Path |
|---|---|---|---|
| Speech-to-Text | OpenAI Whisper | `whisper-1` | Tauri backend |
| Chat response | OpenAI GPT | `gpt-4o-mini` | Tauri backend |
| Text-to-Speech | OpenAI TTS | `tts-1` | Tauri backend |

All three OpenAI calls are made from Rust (`voice_commands.rs`).  
The API key is read from the process environment in Rust — never returned to the frontend.

---

## Security Boundaries

- **API key never crosses to frontend**: key is loaded in `voice_commands.rs` via `std::env::var("VITE_OPENAI_API_KEY")`, resolved by `dotenvy::dotenv()` in `lib.rs`
- **Audio bytes not stored**: passed to Tauri once, result (text/bytes) returned, source discarded
- **Transcripts not persisted by default**: `persistTranscripts` setting defaults to `false`
- **No source code in prompts**: system prompt is fixed and contains only the AURA persona
- **No secrets in prompts**: prompts contain only user speech transcripts (sanitised)
- **Object URLs revoked**: TTS blob URLs are revoked after audio ends or on unmount
- **No auto-listen loop**: no background recording, no wake word, no continuous monitoring
- **One call per turn**: no retry loops; errors surface to UI

---

## Cost Controls

| Control | Value |
|---|---|
| Max recording duration | 15 seconds |
| Chat max_tokens | 150 |
| TTS text cap | 4096 chars |
| STT audio cap | 10 MB |
| Calls per turn | 3 (STT + Chat + TTS), not parallelised |
| Conversation history sent | Last 5 turns (10 messages) |
| Auto-listen | Disabled |
| Wake word | Not implemented |

---

## How to Test

1. Ensure `VITE_OPENAI_API_KEY` is set in `.env`
2. Run `npm run tauri:dev`
3. Open Voice Core
4. Click **Voice Off** toggle → it becomes **Voice On**
5. Click **Speak** — browser will ask for microphone permission
6. Speak a short phrase (under 15 seconds)
7. Click **Stop**
8. Wait for: Transcribing… → Thinking… → Speaking…
9. AURA's audio response plays through speakers
10. Conversation panel appears below — click it to expand and see the transcript

---

## Visualizer States

| Phase | Visualizer state | Source |
|---|---|---|
| Recording | `listening` | admin |
| Transcribing | `thinking` | system |
| Thinking (chat) | `thinking` | system |
| Speaking (TTS) | `speaking` | aura |
| Idle | `idle` | aura |
| Error | `error` | aura |

---

## Known Limitations

1. **Tauri dev env loading**: `dotenvy::dotenv()` loads `.env` only if the file is in the working directory when Tauri starts. If it fails to load, the Rust backend will return "OpenAI API key not configured". Set `OPENAI_API_KEY` in your system environment as a fallback.

2. **Audio format**: Uses `audio/webm;codecs=opus` (Chrome/Edge) or `audio/webm` (Firefox). Safari WebRTC audio format may need additional handling.

3. **Conversation history**: In-memory only. Cleared on page refresh or by the Clear button.

4. **TTS latency**: 1–4 seconds depending on response length. Shown in the thinking/speaking transition.

5. **No ElevenLabs yet**: Premium TTS via ElevenLabs requires adding `VITE_ELEVENLABS_API_KEY` and wiring a fourth Tauri command.

6. **No voice activity detection**: Recording is purely push-to-talk, not VAD-triggered.

---

## What Remains Before Realtime Voice (WebRTC)

1. Implement `openai_create_realtime_session` Tauri command that mints an ephemeral token server-side
2. Wire `RTCPeerConnection` and `RTCDataChannel` in the frontend
3. Stream audio frames in real-time (no stop-and-wait round trip)
4. Handle Realtime API events (`response.audio.delta`, `input_audio_buffer.speech_started`, etc.)
5. Update `VoiceSessionService.resolveMode()` to return `'realtime'` when session service is live

---

## What Remains Before Wake Word

1. Implement continuous background recording (requires explicit user permission)
2. Run Porcupine or browser-based keyword detection on audio frames
3. Wire detected wake word → `startRecording()` in `useVoiceRecorder`
4. Add safety controls: auto-timeout, push-to-cancel, notification when listening

---

## Optional Make.com Event (M9)

Event type: `phase3c_voice_conversation_test_completed`

To send manually after a successful test:
```typescript
await makeConnectorService.triggerScenarioIfConfigured(
  'phase3c_voice_conversation_test_completed', 'safe', {
    success: true,
    sttProvider: 'openai',
    ttsProvider: 'openai',
    responseProvider: 'openai',
    // no transcript text, no audio, no secrets
  }
);
```

---

## Files Changed

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Added reqwest + dotenvy |
| `src-tauri/src/voice_commands.rs` | New — 3 OpenAI backend commands |
| `src-tauri/src/lib.rs` | Register voice commands, load .env |
| `src/types/voice-session.ts` | Full Phase 3C type vocabulary |
| `src/hooks/useVoiceRecorder.ts` | New — MediaRecorder hook |
| `src/services/voice/OpenAIVoiceSessionService.ts` | Tauri invoke() path, full conversation turn |
| `src/components/operator/AuraVoiceCore.tsx` | Real conversation mode + UI |
| `src/components/operator/VoiceReadinessCard.tsx` | Enable toggle, TTS voice selector |
| `src/types/make-connector.ts` | phase3c event type |
| `docs/phase-3c-voice-conversation-mvp.md` | This file |

# AURA Voice Provider Foundation

**Milestone:** H  
**Branch:** `voice-provider-foundation`

## Purpose

Prepare real STT/TTS integration without calling APIs or requesting microphone access. Establishes types, service stubs, dry-run validation, and the audio → visualizer bridge architecture for Phase 3.

## Providers Supported

### STT (Speech-to-Text)
| Provider | Key Var | Phase |
|---|---|---|
| openai-whisper | VITE_OPENAI_API_KEY | Phase 3 |
| openai-realtime | VITE_OPENAI_REALTIME_KEY | Phase 3 |
| browser-speech-api | None | Phase 3 (planned) |

### TTS (Text-to-Speech)
| Provider | Key Var | Phase |
|---|---|---|
| openai-tts | VITE_OPENAI_API_KEY | Phase 3 |
| elevenlabs | VITE_ELEVENLABS_API_KEY | Phase 3 |
| browser-speech-synth | None | Phase 3 (planned) |

## Audio → Visualizer Bridge

```
Phase 3 implementation path:

getUserMedia({ audio: true })        ← requires user approval
→ MediaStreamSourceNode
→ AnalyserNode (fftSize=64)
→ getByteFrequencyData() per frame at 60fps
→ normalize [0–255] → [0–1]
→ AuraVoiceVisualizer.frequencyBands

Current (Phase 2): useMockAudioReactivity drives visualizer.
No AudioContext created, no mic permission requested.
```

## Dry-Run

```typescript
console.log(voiceProviderService.dryRunVoicePipeline());
// Voice Pipeline Dry-Run (...)
// STT: none — disabled
// TTS: none — disabled
// Realtime: key missing
// Microphone: NOT requested (Phase 3)
// → Add VITE_OPENAI_API_KEY to .env to enable STT
```

## Safety Boundaries

- `micPermissionRequested` is always `false` until Phase 3
- `VoiceAudioBridge.connectMediaStream()` is a no-op stub
- `VoiceAudioBridge.connectAnalyser()` is a no-op stub
- No `AudioContext` is created anywhere in the codebase
- No `navigator.mediaDevices.getUserMedia()` calls exist

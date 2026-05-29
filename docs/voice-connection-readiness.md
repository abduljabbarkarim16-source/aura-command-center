# Voice Connection Readiness

> This document defines the Phase 2G capability of AURA to safely monitor and test voice pipeline connectivity without requesting microphone permissions or executing live API calls.

## Overview

AURA's voice pipeline involves Speech-to-Text (STT) and Text-to-Speech (TTS). In the Foundation Phase, AURA must validate the configuration of these pipelines without activating real audio context.

### Security Rules (Immutable)

1. **No Microphone Permissions**: AURA will never prompt the user for microphone access in Phase 2.
2. **No Live Execution**: STT and TTS dry runs describe what would happen but do not send audio over the network or play audio through the speakers.
3. **Secret Masking**: `VoiceProviderService` never reads the string value of the API key, checking only presence via the `SecureKeyService` and fallback environment variables.

## Voice Pipeline States

A STT/TTS provider transitions through these states:
- `missing_secret`: Provider is known, but no API key is configured.
- `secret_configured`: Secret presence confirmed.
- `dry_run_ready`: Validated that the provider can theoretically accept a request.
- `no_secret_needed`: Used for browser-native speech APIs.
- `planned`: AURA knows the capability but the underlying infrastructure is pending Phase 3.
- `disabled`: User explicitly turned off the voice provider.

## Realtime vs REST Pipelines

AURA supports two distinct voice connection topologies:
1. **REST Pipeline**: Web SpeechRecognition or Whisper STT -> LLM Text response -> ElevenLabs or OpenAI TTS.
2. **Realtime WebRTC Pipeline**: Direct WebSocket/WebRTC connection to OpenAI Realtime for full-duplex audio. 

Currently, `VoiceProviderService` dry-runs the logic to select the best available topology based on configured secrets.

## Audio Bridge to Visualizer

The visualizer currently uses mock audio reactivity. In Phase 3, it will be driven by real `AnalyserNode` frequency bands obtained from the media stream (for STT) and the `AudioBufferSourceNode` (for TTS). This design is documented in the code but strictly disabled until connection validation is fully approved.

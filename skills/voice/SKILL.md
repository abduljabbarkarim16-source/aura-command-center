# Skill: voice

**purpose:** OpenAI Whisper STT + GPT-4o-mini chat + OpenAI TTS voice conversation loop
**status:** active
**version:** Phase 3E
**permission_class:** network (via Tauri backend — key never in frontend)

## required_secrets
- `VITE_OPENAI_API_KEY` or `OPENAI_API_KEY` (loaded in Rust, never returned to frontend)

## allowed_actions
- Record microphone audio (requires explicit user gesture)
- Send audio to Whisper API via Tauri backend
- Receive transcript text
- Send transcript to GPT-4o-mini chat via Tauri backend
- Receive response text
- Send response text to TTS API via Tauri backend
- Play audio response
- Store transcript turn in localStorage (when persistTranscripts=true)
- Log voice errors to notification service

## blocked_actions
- Store raw audio files
- Return API key to frontend
- Enable always-on recording without user action
- Log user voice content to external services

## approval_policy
none — voice is user-initiated via button or hotkey only

## test_plan
1. Click Speak — mic permission prompt appears
2. Speak "Hello AURA" — transcript panel shows "You: Hello AURA"
3. AURA responds with text + audio
4. Speak 20+ seconds — should not falsely return "No speech detected"
5. Natural 2s pause mid-sentence — should not trigger early auto-stop
6. Press Ctrl+Shift+Space — should start/stop voice without clicking

## memory_logging
yes — errors logged to NotificationService, successful turns logged to VoiceTranscriptLogService

## owner
Claude (Anthropic · claude-sonnet-4-6) — Phase 3E

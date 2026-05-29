# AURA Phase 3B — Controlled Self-Build Dry Run and Voice Foundation

**Date:** 2026-05-29  
**Branch:** phase-3b-controlled-self-build-and-voice-foundation  
**Agent:** Claude Sonnet 4.6 (Anthropic) — orchestration + implementation agent

---

## Provider Gate Changes (Milestone 1)

`SelfBuildOrchestratorService.evaluateConnectionReadiness()` updated:

- Added `dryRunReady` flag — passes when LLM + Make.com are configured (workspace not required)
- Workspace check marked `optional: true` — warning badge, not blocker for dry run
- Voice provider check added as `optional: true` — informs but does not block
- Gemini messaging: "Gemini optional fallback — billing/quota not blocking"
- Wording update: "OpenAI voice can use existing OpenAI key through backend-safe session flow"

### Gemini Billing / Quota Status (Milestone 7)

| Attempt | Error | Resolution |
|---|---|---|
| Phase 3A | Free-tier quota exceeded | Billing enabled |
| Phase 3B recheck | Prepayment credits depleted | Add credit at ai.studio/projects |

**Gemini is optional/fallback.** Phase 3B is not blocked. Anthropic + OpenAI are sufficient.

---

## Self-Build Dry Run (Milestone 2)

**Service:** `src/services/self-build/SelfBuildDryRunService.ts`

Goal: `"Review AURA connection readiness UI and propose one low-risk improvement that does not require source edits."`

### Dry Run Steps
1. Readiness check (relaxed — workspace not required)
2. Create self-build plan via `SelfBuildOrchestratorService`
3. Request planning suggestion from provider (M3)
4. Classify + propose safe validation commands (M8)
5. Validate Make.com dry-run payload (local, no network)
6. Send one approved Make.com live event on completion (M4)
7. Log all steps to `RuntimeTimelineService`
8. Return structured `DryRunReport`

### Boundaries
- No source edits, no git push, no destructive commands
- No secrets in any payload
- No repeated live provider calls
- One Make.com live event maximum

---

## Provider-Assisted Planning (Milestone 3)

**Service:** `src/services/providers/ProviderPlanningService.ts`

- Preferred: Anthropic (`claude-haiku-4-5-20251001`)
- Fallback: OpenAI (`gpt-4o-mini`)
- `max_tokens: 64`
- Prompt contains only sanitised AURA status — no source code, no secrets, no paths
- Parses response as JSON `{ title, reason, risk, validationCommand }`
- One call only, no retry

**Sanitised status used:**
```
Make.com connected — webhook live
Anthropic connected — smoke test passed
OpenAI connected — smoke test passed
Gemini optional — billing/quota uncertain
Native bridge safe commands enabled (git status, npm lint)
Voice foundation pending — microphone not requested
Self-build dry run in progress
```

---

## Make.com Phase 3B Event (Milestone 4)

Event type added: `phase3b_self_build_dry_run_completed`

Payload fields:
- `source`, `dryRun: true`, `testMode: false`
- `providerUsed`, `commandProposalCount`, `validationStatus`
- `message: "AURA Phase 3B controlled self-build dry run completed."`
- No secrets, no API keys, no webhook URL, no source code

Sent once after successful dry run completion (approval-gated via `sendLiveMakeEvent` option).

---

## Voice Transcription and Response Foundation (Milestone 5)

### New Types
**`src/types/voice-session.ts`**
- `VoiceSessionMode` — mock | request_based | realtime | locked
- `VoiceSessionStatus`, `VoiceSTTProvider`, `VoiceTTSProvider`
- `VoiceSession`, `VoiceTranscriptEvent`, `VoiceReadinessSnapshot`
- `OpenAIRealtimeSessionRequest/Response` (ephemeral token shape)
- Transcript event types: `admin_speech_started`, `admin_transcript_partial`, `admin_transcript_final`, `aura_response_started`, `aura_response_audio_started`, `aura_response_audio_completed`, `voice_error`

### New Services
**`src/services/voice/VoiceSessionService.ts`**
- Manages session lifecycle
- `getReadinessSnapshot()` — determines mode from key presence
- Mode: `locked` (default when OpenAI key present) or `mock` (no key)
- Live voice always locked until explicit approval gate

**`src/services/voice/OpenAIVoiceSessionService.ts`**
- STT: POST to `/v1/audio/transcriptions` (Whisper) — dry-run capable
- TTS: POST to `/v1/audio/speech` — dry-run capable
- Realtime: mock stub — production requires Tauri backend bridge for ephemeral token
- Key never logged or stored

**`src/services/voice/VoiceTranscriptService.ts`**
- Emits typed `VoiceTranscriptEvent` objects
- Convenience emitters: `speechStarted`, `partialTranscript`, `finalTranscript`, `responseStarted`, `audioStarted`, `audioCompleted`, `voiceError`
- Max 200 events in memory

---

## Voice UI Readiness (Milestone 6)

**`src/components/operator/VoiceReadinessCard.tsx`** added to Settings page.

Rows displayed:
| Row | Phase 3B Status |
|---|---|
| OpenAI API Key | Present — enables STT (Whisper) + TTS |
| STT Provider | openai-whisper — ready |
| TTS Provider | openai-tts — ready |
| ElevenLabs (optional) | Missing — not required |
| Realtime Voice | Planned — Tauri backend bridge needed |
| Microphone Permission | Not requested yet |
| Live Voice | Locked until approval gate |

---

## Command Proposals Generated (Milestone 8)

Two proposals submitted via `CommandProposalService.proposeCommand()`:

| Command | Risk | Auto-run | Status |
|---|---|---|---|
| `git status --short` | safe | depends on policy | proposed |
| `npm run lint` | safe | depends on policy | proposed |

Both classified as `safe` by `CommandPolicyService`. Neither executed yet — proposals require admin approval or `canAutoRun` policy green-light.

---

## OpenAI Key / Realtime / Session Plan

- **STT/TTS:** Uses `VITE_OPENAI_API_KEY` directly (request-based, Whisper + tts-1)
- **Realtime WebRTC:** Requires a Tauri backend command that holds the key server-side and mints an ephemeral client secret — never exposes the key to the frontend
- **Architecture:** `OpenAIVoiceSessionService.createRealtimeSession()` is stubbed and returns a mock token in Phase 3B; production path delegates to a Tauri command

---

## ElevenLabs Optional Key Plan

- If `VITE_ELEVENLABS_API_KEY` is added to `.env`, `VoiceSessionService` will detect it and set `ttsProvider = 'elevenlabs'`
- `VoiceReadinessCard` will show "Key present — premium TTS available"
- No code changes needed — detection is already wired

---

## What Remains Before Full Autonomy

1. **Gemini billing** — Add prepayment credit at ai.studio/projects (or remove Gemini from required provider list)
2. **Agent workspace** — Configure an active workspace in `WorkspaceControllerService`
3. **Secure key vault** — Migrate from `import.meta.env` fallback to Tauri Stronghold
4. **Dry run approval** — Run and approve one full dry run from the UI
5. **Workspace-scoped command execution** — Run approved proposals (git status, lint) with results recorded
6. **Self-build loop activation** — User explicitly enables full autonomous run after dry run passes

---

## What Remains Before Real Voice

1. **Microphone permission** — Request via Tauri capabilities when user unlocks live voice
2. **Tauri backend bridge** — Implement Rust command to mint OpenAI Realtime ephemeral tokens
3. **MediaRecorder integration** — Wire browser audio capture to `OpenAIVoiceSessionService.transcribeAudio()`
4. **TTS playback** — Wire `synthesizeSpeech()` result blob URL to an `<audio>` element
5. **ElevenLabs key** — Optional; add to `.env` when premium TTS is needed
6. **Approval gate** — Live voice requires explicit admin unlock in Settings

---

## Safety Boundaries

- No source edits during dry run
- No git push from self-build loop
- No destructive commands at any point
- No secrets in any Make.com payload
- No API keys sent to Make.com
- No webhook URLs echoed in logs
- No repeated provider calls
- No microphone access (not requested)
- No audio data stored
- Ephemeral tokens used once and discarded
- All commands classified by `CommandPolicyService` before proposal
- Live Make.com events: one per dry run, approval-gated

---

## Validation Pipeline

| Check | Result |
|---|---|
| TypeScript lint | Passed |
| Vite web build | Passed |
| Tauri desktop build | Passed |
| cargo test | Passed |
| `.env` gitignored | Confirmed |
| No secrets in source | Confirmed |

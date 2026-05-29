# AURA Provider Configuration Audit

**Phase:** 2G  
**Date:** 2026-05-29  
**Security note:** This document lists variable *names* only. No values are printed. No values were copied.

---

## Local Environment File Scan

### AURA repo — `.env.example`
Path: `C:\Users\karim\Documents\AURA\agent-command-center\.env.example`

Variable names present (Phase 2F):
```
VITE_ANTHROPIC_API_KEY
VITE_OPENAI_API_KEY
VITE_GOOGLE_API_KEY
VITE_ANTIGRAVITY_API_KEY
```

Phase 2G adds (see updated .env.example):
```
VITE_ELEVENLABS_API_KEY
VITE_OPENAI_REALTIME_KEY
VITE_CUSTOM_PROVIDER_API_KEY   (uncommented)
VITE_CUSTOM_PROVIDER_BASE_URL  (uncommented)
```

### Related local projects

| Project path | .env found | Variable names |
|---|---|---|
| `Documents\webchat2.0\WEB-CHAT-\functions\.env` | Yes | ZOHO_CLIENT_ID, ZOHO_ORGANIZATION_ID, ZOHO_ACCOUNTS_BASE_URL, ZOHO_API_BASE_URL |
| `Documents\Admin Dashboard\card-crafters-dashboard\functions\.env` | Yes | ZOHO_CLIENT_ID, ZOHO_ORGANIZATION_ID, ZOHO_ACCOUNTS_BASE_URL, ZOHO_API_BASE_URL |
| `Documents\webchat2.0 - Copy\WEB-CHAT-\functions\.env` | Yes | Same Zoho vars as above |

**Assessment:** The webchat and card-crafters env files are for Zoho Books/CRM integrations — unrelated to AURA AI provider configuration. No cross-project env copying needed or appropriate.

---

## Provider Readiness Matrix

| Provider | Env variable name | Key needed | Status | Tier |
|---|---|---|---|---|
| Anthropic / Claude | `VITE_ANTHROPIC_API_KEY` | Yes | Not configured (key absent) | Active |
| OpenAI / Codex | `VITE_OPENAI_API_KEY` | Yes | Not configured | Active |
| Google / Gemini | `VITE_GOOGLE_API_KEY` | Yes | Not configured | Active |
| Antigravity | `VITE_ANTIGRAVITY_API_KEY` | Yes | Not configured | Active |
| ChatGPT Relay | — | No | Ready (clipboard-based) | Active |
| ElevenLabs TTS | `VITE_ELEVENLABS_API_KEY` | Yes | Not configured | Planned |
| OpenAI Realtime | `VITE_OPENAI_REALTIME_KEY` | Yes | Not configured | Planned |
| Custom provider | `VITE_CUSTOM_PROVIDER_API_KEY` | Optional | Not configured | Custom |
| Oracle / OpenClaude | — | TBD | Concept — not available | Concept |
| Browser speech | — | No | Available (no permission requested) | Fallback |
| Local (Ollama) | — | No | Not connected | Planned |

**Note:** "Not configured" means the VITE_ variable is absent from the runtime environment (`import.meta.env.VITE_*` is falsy). This is expected — keys must be set by the developer in a local `.env` file that is never committed.

---

## Provider Adapter Plan

### Suggested adapter naming (`src/services/providers/adapters/`)

| Provider | Adapter name | Capabilities |
|---|---|---|
| Anthropic | `AnthropicAdapter` | chat, reasoning, code, tools |
| OpenAI | `OpenAIAdapter` | chat, code, image, tools, tts, stt |
| Google Gemini | `GeminiAdapter` | chat, reasoning, image, tools |
| ElevenLabs | `ElevenLabsAdapter` | tts |
| OpenAI Realtime | `OpenAIRealtimeAdapter` | stt, tts, realtime_voice |
| Browser Speech | `BrowserSpeechAdapter` | stt (SpeechRecognition), tts (speechSynthesis) |
| ChatGPT Relay | `ChatGPTRelayAdapter` | relay (clipboard handoff) |
| Antigravity | `AntigravityAdapter` | chat, relay, tools |
| Custom | `CustomProviderAdapter` | configurable |

**Phase constraint:** Adapters are not implemented yet. Phase 2G creates the type definitions and `ProviderRegistryService` only. Real adapter execution lands in Phase 3.

---

## ProviderRegistryService Design

The registry (`src/services/providers/ProviderRegistryService.ts`) is a read-only singleton that:

1. Checks `import.meta.env.VITE_*` for truthy key presence (never reads values)
2. Returns a `ProviderHealth[]` array with `status`, `capabilities`, `hasKey`, `displayName`
3. Is called by `ProviderCapabilityCard` and any dashboard summary widget
4. Never makes API calls — pure config inspection

Status values:
- `configured` — key is present (truthy) in env
- `missing_key` — key variable is defined in .env.example but not set
- `disabled` — explicitly disabled in settings
- `planned` — functionality planned but key infra not built
- `unavailable` — provider not reachable (no key, no endpoint)

---

## Missing `.env.example` Entries (Phase 2G additions)

The following were absent and have been added in Phase 2G:
```
VITE_ELEVENLABS_API_KEY=
VITE_OPENAI_REALTIME_KEY=
VITE_CUSTOM_PROVIDER_API_KEY=
VITE_CUSTOM_PROVIDER_BASE_URL=
```

These are blank by default and must be filled by the developer. They are added to document the expected variable names for future integration.

---

## Security Rules (immutable)

1. NEVER print API key values in logs, UI, or documents
2. NEVER store API key values in localStorage, source code, or memory stores
3. NEVER copy key values between projects or `.env` files
4. NEVER commit `.env` files — only `.env.example` (with blank values)
5. Future real key storage: use Tauri Keyring / OS credential manager (Phase 2H)
6. VITE_ prefix makes values available at build time — do not use for server-side secrets

---

*Provider config audit — Phase 2G*

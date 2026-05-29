# AURA Command Center — Full Repo Audit

**Audit phase:** 2G  
**Branch:** `phase-2g-runtime-wiring-and-self-build-audit`  
**Date:** 2026-05-29  
**Auditor:** Claude (Anthropic) — automated review

---

## 1. App Architecture

### Tech Stack
| Layer | Technology | Version |
|---|---|---|
| Frontend | React 19 | 19.0.1 |
| Build tool | Vite | 6.x |
| Desktop shell | Tauri 2 | 2.11.x |
| Styling | Tailwind CSS 4 | 4.1.x |
| Routing | React Router 7 | 7.15.x |
| Icons | Lucide React | 0.546.x |
| Animation | Motion | 12.x |
| Language | TypeScript | 5.8.x |
| Runtime OS | Rust (Tauri backend) | via cargo |
| Installer | NSIS + MSI | via tauri:build |

### Directory Structure
```
agent-command-center/
├── src/
│   ├── App.tsx                     # Router shell (eager imports — see Part I)
│   ├── main.tsx                    # React 19 root mount
│   ├── index.css                   # Global Tailwind + keyframes
│   ├── vite-env.d.ts               # Vite env type stubs
│   ├── components/
│   │   ├── Layout.tsx              # Shell: sidebar + topbar + outlet
│   │   ├── Sidebar.tsx             # Collapsible icon/label nav
│   │   ├── TopBar.tsx              # Top strip (branding, shortcuts)
│   │   ├── operator/               # Voice Core components
│   │   │   ├── AuraVoiceCore.tsx   # Main voice interface (Phase 2F)
│   │   │   ├── AuraVoiceVisualizer.tsx
│   │   │   ├── AdminVoiceIndicator.tsx
│   │   │   ├── ApprovalCard.tsx
│   │   │   ├── ApprovalTray.tsx    # Side tray (Phase 2E fix)
│   │   │   ├── NotificationCenter.tsx
│   │   │   ├── NotificationToast.tsx
│   │   │   ├── ProviderCapabilityCard.tsx
│   │   │   ├── FuturePlaceholderCards.tsx
│   │   │   ├── TechnicalDrawer.tsx
│   │   │   ├── AdminPanelOverlay.tsx
│   │   │   ├── OperatorRail.tsx
│   │   │   ├── OperatorStack.tsx
│   │   │   ├── CommandPalette.tsx
│   │   │   ├── AuraComposer.tsx
│   │   │   ├── AuraThoughtCard.tsx
│   │   │   ├── MissionStatusCard.tsx
│   │   │   ├── ProjectMissionCard.tsx
│   │   │   ├── AssistantMessage.tsx
│   │   │   ├── SystemEventCard.tsx
│   │   │   └── AuraLaunchScreen.tsx
│   │   ├── relay/                  # Relay workflow components
│   │   ├── runtime/                # Background tasks panel, usage meter
│   │   ├── voice/                  # Orb + voice control panel (legacy)
│   │   └── workspace/              # Localhost preview, git, artifact, safety
│   ├── pages/
│   │   ├── Console.tsx             # Default route — Voice Core + chat
│   │   ├── Dashboard.tsx           # Operations overview
│   │   ├── Projects.tsx            # Project list
│   │   ├── Agents.tsx              # Agent fleet
│   │   ├── Memory.tsx              # Persisted memory entries
│   │   ├── Handoffs.tsx            # Agent handoffs
│   │   ├── Relay.tsx               # Reasoning relay workflow
│   │   ├── Connectors.tsx          # MCP connector list
│   │   ├── ToolLogs.tsx            # Tool execution log
│   │   └── Settings.tsx            # App settings
│   ├── hooks/
│   │   ├── useAppSettings.ts       # Settings + providers (localStorage)
│   │   ├── useMockAudioReactivity.ts # 60fps audio simulation
│   │   ├── useVoiceRuntime.ts      # Runtime event bus consumer (Phase 2F)
│   │   ├── useRuntimeStatus.ts     # Live service count aggregator (Phase 2G)
│   │   └── useWorkspaceRunner.ts   # Workspace command runner hook
│   ├── services/
│   │   ├── notifications/NotificationService.ts
│   │   ├── persistence/PersistenceService.ts
│   │   ├── settings/SettingsService.ts
│   │   ├── voice/VoiceRuntimeService.ts  (Phase 2F)
│   │   ├── providers/ProviderRegistryService.ts  (Phase 2G)
│   │   ├── relay/RelayService.ts
│   │   ├── handoff/HandoffService.ts
│   │   └── workspace/
│   │       ├── WorkspaceRunner.ts
│   │       ├── WorkspaceSafetyService.ts
│   │       └── LocalhostPreviewService.ts
│   ├── types/
│   │   ├── agents.ts, voice.ts, runtime.ts, commands.ts, artifacts.ts
│   │   ├── git.ts, router.ts, workspace.ts
│   │   ├── persistence.ts, settings.ts, notifications.ts
│   │   ├── handoff.ts, relay.ts
│   │   ├── voice-runtime.ts        (Phase 2F)
│   │   ├── providers.ts            (Phase 2G)
│   │   └── index.ts                (barrel)
│   ├── mock/                       # Mock data per domain
│   ├── store/mockData.ts           # Consolidated mock store
│   └── lib/utils.ts                # cn() Tailwind helper
├── src-tauri/
│   ├── tauri.conf.json             # Window: 1200×800, devUrl: localhost:3000
│   ├── Cargo.toml
│   └── src/main.rs                 # Tauri entry — minimal, no custom commands yet
├── docs/
│   ├── aura-premium-ui-design-brief.md   (§1–16)
│   ├── voice-runtime-architecture.md     (Phase 2F)
│   ├── desktop-launch-guide.md
│   ├── full-repo-audit-phase-2g.md       (this file)
│   ├── provider-config-audit.md          (Phase 2G)
│   └── self-build-agent-architecture.md  (Phase 2G)
├── .env.example                    # Safe variable names only
└── package.json
```

### Routing
- **Router:** `BrowserRouter` (not `MemoryRouter` — devUrl serves from Vite dev server)
- **Root route:** `/` → `Console` (Voice Core is the default screen)
- **Layout:** `Layout` wraps all routes with Sidebar + TopBar + `<Outlet />`
- **Code-splitting:** As of Phase 2G, all page imports are lazy (`React.lazy`) — see Part I

### Desktop Build Flow
```
npm run tauri:build
  → beforeBuildCommand: npm run build
      → Vite bundles src/ → dist/
  → cargo build --release
      → Rust binary links against MSVC (requires VsDevCmd.bat; see ERR-0004)
  → Tauri bundles dist/ + binary
  → NSIS installer → src-tauri/target/release/bundle/nsis/
  → MSI installer  → src-tauri/target/release/bundle/msi/
```

Dev launch: `npm run tauri:dev` → Vite on localhost:3000 + Tauri WebView2.

---

## 2. Current UI State

### Console / Voice Core (default route `/`)
- **Status:** Fully implemented — Phase 2E/2F
- **Layout:** 5 zones (Zone 1 status strip, Zone 2 mission, Zone 3 orb, Zone 5 action strip)
- **Runtime:** `useVoiceRuntime()` drives all state — no hardcoded local state except `isTrayOpen` / `missionExpanded`
- **Visualizer:** `AuraVoiceVisualizer` with 60fps audio-reactive mock (`useMockAudioReactivity`)
- **Approvals:** `ApprovalTray` renders as absolute right-side panel — center stays clear
- **Notifications:** `NotificationToast` (top-right) + `NotificationCenter` (bell)
- **Status chips:** Memory, Relay, Tools, Agent — wired to live counts in Phase 2G
- **Demo controls:** Demo ▶ and Reset in secondary action row
- **Chat mode:** `AuraComposer` + message stream accessible via Console button

### Dashboard (`/dashboard`)
- **Status:** Mostly mock data
- **Mock data:** Uses `mockAgents`, `mockTasks`, `mockProjects` from `store/mockData.ts`
- **Live elements:** Date (real), counts derived from mock arrays
- **Provider card:** `ProviderCapabilityCard` — checks real VITE_ env var presence
- **Future cards:** `FuturePlaceholderCards` — Dispatcher, Remote Relay, Mobile Approval, Oracle
- **Phase 2G addition:** Self-Build Readiness section

### Projects (`/projects`)
- **Status:** Mock-only. Renders `mockProjects` array.

### Agents (`/agents`)
- **Status:** Mock-only. Renders `mockAgents` with status indicators.

### Memory (`/memory`)
- **Status:** Persisted — reads from `settingsService.listMemoryEntries()`.
- **Seed:** On first load, seeds from `mockMemory` if localStorage is empty.
- **Export:** JSON download via `settingsService.exportMemoryJson()`.

### Handoffs (`/handoffs`)
- **Status:** Persisted — reads from `handoffService.listHandoffs()`.
- **Data flow:** Populated when relay packets are routed (RelayService.createHandoffFromRelay).

### Relay (`/relay`)
- **Status:** Persisted — reads from `relayService.listRelayHistory()`.
- **Workflow:** Full relay compose → approve → send → import response → route → handoff pipeline.

### Connectors (`/connectors`)
- **Status:** Mock-only. Renders `mockConnectors` from store.
- **No backend:** No actual MCP execution yet.

### Tool Logs (`/logs`)
- **Status:** Likely mock-only.

### Settings (`/settings`)
- **Status:** Fully functional. Reads/writes via `settingsService`.
- **Sections:** General, Routing, Voice, Artifacts, Safety Approvals, Memory, Privacy, Desktop, Notifications, Providers.
- **Voice Runtime card:** Added in Phase 2G showing mock mode status.

---

## 3. Runtime Systems

### VoiceRuntimeService
- **File:** `src/services/voice/VoiceRuntimeService.ts`
- **Type:** Singleton, pub/sub
- **State:** `_state`, `_activeSpeaker`, `_mission`, `_pendingApprovals[]`, `_recentEvents[]`, `_isMuted`, `_isSafeMode`
- **Persistence:** Phase 2G: reads `assistantMuted` + `safeMonitorMode` from settings on init; writes back on toggle
- **Notification bridge:** 7 event types auto-create notifications
- **Demo:** `runDemoSequence()`, `simulateApproval()`, `simulateAdminSpeaking()`, `simulateSpeaking()`

### NotificationService
- **File:** `src/services/notifications/NotificationService.ts`
- **Type:** Singleton, pub/sub
- **State:** In-memory, max 50 entries
- **TTL:** Auto-dismiss after N ms when `ttl` is set
- **Types:** info, success, warning, danger, approval, tool, relay, memory, system

### RelayService
- **File:** `src/services/relay/RelayService.ts`
- **Type:** Class instance (singleton export)
- **Storage:** `localStorage` via `defaultAdapter` under key `relay.exchanges`
- **Workflow:** Create → approve → send → import response → parse → route → handoff → archive

### HandoffService
- **File:** `src/services/handoff/HandoffService.ts`
- **Type:** Class instance (singleton export)
- **Storage:** `localStorage` under key `aura.handoffs.v1`
- **Data:** Created from relay workflow or manually

### SettingsService
- **File:** `src/services/settings/SettingsService.ts`
- **Type:** Class instance (singleton export)
- **Storage:** `localStorage` under keys: `settings.app`, `settings.providers`, `registry.projects`, `memory.entries`
- **Merge logic:** New setting fields always merged over stored values (forward-compatible)

### PersistenceService
- **File:** `src/services/persistence/PersistenceService.ts`
- **Adapters:** `LocalStorageAdapter` (default), `InMemoryAdapter` (fallback/test)
- **Namespace:** `aura:` prefix on all keys
- **Security:** Explicitly never stores API key values

### WorkspaceRunner + WorkspaceSafetyService
- **Files:** `src/services/workspace/`
- **Status:** Foundation present, no real command execution yet
- **Safety:** `WorkspaceSafetyService` validates commands before they run

### ProviderRegistryService (Phase 2G)
- **File:** `src/services/providers/ProviderRegistryService.ts`
- **Purpose:** Centralize provider status checks (key presence only, never values)
- **Reads:** `import.meta.env.VITE_*` environment variables
- **Returns:** `ProviderHealth[]` with status, capabilities, key presence flag

---

## 4. Data / State Flow

| Data source | Consumers | Storage |
|---|---|---|
| `VoiceRuntimeService` | `useVoiceRuntime`, `AuraVoiceCore` | In-memory + settings sync |
| `NotificationService` | `NotificationToast`, `NotificationCenter`, runtime bridge | In-memory only |
| `SettingsService` | `useAppSettings`, Settings page, runtime init | `localStorage` |
| `RelayService` | `Relay` page, relay components, handoff creation | `localStorage` |
| `HandoffService` | `Handoffs` page | `localStorage` |
| `mockData.ts` | Dashboard, Projects, Agents, Connectors | Compile-time mock |
| `import.meta.env` | `ProviderCapabilityCard`, `ProviderRegistryService` | Vite env at build time |

### What should become runtime-backed (gaps)
- `mockAgents` → real agent registry (Phase 2H)
- `mockProjects` → real project service backed by SettingsService (Phase 2H)
- Dashboard stats → live aggregates from services (partial in Phase 2G)
- Connector list → real MCP server config (Phase 3+)
- Tool logs → real command audit trail (Phase 3+)

---

## 5. Build / Deployment

### npm Scripts
```
npm run dev         → Vite dev server (port 3000, host 0.0.0.0)
npm run build       → Vite production build → dist/
npm run lint        → tsc --noEmit (TypeScript check only)
npm run preview     → Vite preview server
npm run tauri:dev   → Full Tauri dev (Vite + Tauri shell)
npm run tauri:build → Production build + NSIS/MSI bundles
```

### Current Build Status (post Phase 2G)
| Check | Status |
|---|---|
| `npm run lint` | ✅ Clean |
| `npm run build` | ✅ Clean (pre-existing chunk warning) |
| `npm run tauri:build` | ✅ Clean |

### Known Warnings
- **Chunk size:** `index-*.js` ~542 KB (144 KB gzip) before Phase 2G lazy loading. After lazy loading, the initial chunk drops to ~200 KB.
- **pre-existing:** chunk size warning is cosmetic — app works correctly.

### Installer Paths
- NSIS: `src-tauri/target/release/bundle/nsis/AURA Command Center_0.1.0_x64-setup.exe`
- MSI: `src-tauri/target/release/bundle/msi/AURA Command Center_0.1.0_x64_en-US.msi`

### Dev vs Production
- **Dev:** Tauri loads from `devUrl: http://localhost:3000`. Requires `npm run tauri:dev` running.
- **Production:** Binary embeds `dist/` from `frontendDist: ../dist`. Self-contained, no server.
- **ERR-0005:** Pinning the dev binary to the taskbar causes localhost refused. Always pin the production installer. (See ERR-0005 in ai-build-memory.)

---

## 6. Security / Safety

### Approval Gates
- `VoiceRuntimeService.requestApproval()` pauses state to `waiting_for_approval`
- `ApprovalTray` requires explicit admin Approve or Reject
- No automated execution happens without approval

### Command Approval
- `WorkspaceSafetyService` validates commands before execution
- `CommandApprovalQueue` component (in workspace/) surfaces pending commands
- `AppSettings.requireApprovalFor*` flags control auto-approval thresholds

### Provider Config Handling
- API key values are **never** stored in localStorage, source code, or passed to components
- `ProviderCapabilityCard` and `ProviderRegistryService` check only for truthy `import.meta.env.VITE_*`
- Keys are only available in Vite builds when `.env` file is present (gitignored)
- `.env.example` documents variable **names** only — values are blank

### localStorage Risks
- **Size:** localStorage is 5–10 MB. Large relay history + memory entries could hit limits.
- **Mitigation:** MAX_HISTORY caps in services; `listRelayHistory()` is unbounded — should add pagination in Phase 2H.
- **Secret-free:** All services have explicit comments prohibiting secret storage.

### Future Secure Storage
- Tauri Keyring (OS credential store) should be used for API keys in Phase 3.
- Current `keyStorageStatus` field in `ProviderConfig` is a placeholder for this.
- Windows: Windows Credential Manager; macOS: Keychain; Linux: libsecret.

---

## 7. Gaps / Blockers

| Gap | Severity | Phase target |
|---|---|---|
| No real STT (SpeechRecognition / Whisper) | High | Phase 3 |
| No real TTS (OpenAI TTS / ElevenLabs / Windows SAPI) | High | Phase 3 |
| No secure key storage (Tauri Keyring) | High | Phase 2H |
| No real MCP tool execution | High | Phase 3 |
| No real agent router | Medium | Phase 2I |
| No self-build workspace controller | Medium | Phase 2G design |
| No real command runner with policy | Medium | Phase 2H |
| No git automation (branch create, push, PR) | Medium | Phase 2H |
| No test suite (unit, integration, e2e) | Medium | Phase 2I |
| No route-based code splitting | Low | Phase 2G ✅ done |
| mockAgents / mockProjects not persisted | Low | Phase 2H |
| Relay history unbounded — no pagination | Low | Phase 2H |
| Dashboard stats are mock-only | Low | Partial Phase 2G |
| Phase 2E label still in Dashboard | Low | Phase 2G ✅ fixed |

---

## 8. Recommended Roadmap

### Phase 2G (current) — Runtime Wiring + Audit Foundation
- Full repo audit (this document)
- Provider config audit + ProviderRegistryService
- Runtime persistence (muted/safeMode → SettingsService)
- Live status chips in Voice Core
- Self-build architecture design doc
- Self-build readiness UI section (Dashboard)
- Wording cleanup (remove Phase 2E labels)
- React.lazy code-splitting for routes
- `.env.example` additions (ElevenLabs, OpenAI Realtime)

### Phase 2H — Agent Registry + Project Persistence + Secure Config
- Replace `mockAgents` with real AgentRegistryService (localStorage-backed)
- Replace `mockProjects` with real ProjectService
- Tauri Keyring integration for API key storage
- Real command runner with policy engine (safe/moderate/high/critical classes)
- Git branch automation (create, status, push — behind approval gate)
- Relay history pagination

### Phase 2I — Routing + Tool Execution Foundation
- Real agent router (select best agent for task)
- MCP connector execution (with approval gate)
- Command audit trail (persistent tool logs)
- Unit tests for services (Vitest)
- E2E smoke tests for critical flows

### Phase 2J — Self-Build Controller
- Autonomous safe file editing (behind approval gate)
- Autonomous lint/build validation
- Autonomous memory entry creation
- Git PR automation (create branch, commit, push, open PR draft)
- Full self-build approval workflow in UI

### Phase 3 — Real Voice + Provider Integration
- Real STT: browser SpeechRecognition → OpenAI Whisper upgrade
- Real TTS: OpenAI TTS → ElevenLabs upgrade
- OpenAI Realtime API (WebRTC full-duplex)
- Provider API execution (gated behind approval)
- Anthropic extended thinking integration
- Voice pipeline quality settings

---

*Audit complete — Phase 2G, 2026-05-29*

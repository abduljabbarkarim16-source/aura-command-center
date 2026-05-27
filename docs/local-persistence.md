# AURA Command Center — Local Persistence Architecture

> **Phase:** 2B (current)
> **Status:** localStorage / in-memory mock implementation
> **Last updated:** 2026-05-27

---

## Overview

Phase 2B adds a local persistence layer to AURA Command Center. The architecture is
deliberately backend-agnostic: all reads and writes flow through a `PersistenceAdapter`
interface, so the storage backend can be swapped without touching application code.

```
React component
  └── useAppSettings / useProjects / …
        └── SettingsService
              └── PersistenceAdapter  ←── swappable
                    ├── LocalStorageAdapter  (Phase 2B, current)
                    ├── TauriStoreAdapter    (Phase 3, planned)
                    ├── SqliteAdapter        (Phase 4, planned)
                    └── InMemoryAdapter      (tests / fallback)
```

---

## Phase 2B Storage Backend: `localStorage`

In Phase 2B, all non-secret data is persisted via the browser `localStorage` API,
which is available inside the Tauri WebView (`wry`) without any additional Rust plugin.

### Namespace

Every key is prefixed with `aura:` to avoid collisions:

```
aura:settings.app
aura:settings.providers
aura:registry.projects
aura:memory.entries
```

### What IS stored in localStorage

| Key | Content |
|---|---|
| `aura:settings.app` | `AppSettings` — theme, routing mode, voice flags, approval flags, etc. |
| `aura:settings.providers` | `ProviderConfig[]` — provider metadata, enabled/disabled state, key-presence flag |
| `aura:registry.projects` | `PersistedProject[]` — project names, paths (placeholder), repo URLs |
| `aura:memory.entries` | `PersistedMemoryEntry[]` — Phase 2B mock memory entries |

### What MUST NOT be stored in localStorage

| Data | Reason | Future home |
|---|---|---|
| API key values (sk-…, AIza…) | Readable by any JavaScript; trivially exfiltrated via XSS | OS keychain via Tauri Keyring plugin |
| OAuth tokens / refresh tokens | Same as above | Tauri Keyring / OS credential store |
| Private keys / certificates | Same as above | OS keychain |

`ProviderConfig.hasApiKey` is a **boolean flag** only. The actual key string is never
read from or written to this layer. The UI shows key presence status without exposing
the value.

---

## Phase 3 Plan: Tauri Store (Encrypted JSON)

`tauri-plugin-store` writes an encrypted JSON file on disk under the Tauri app data
directory (`%APPDATA%\aura-command-center\` on Windows). Unlike `localStorage`, it:

- Survives a full browser cache clear
- Can be co-located with other Tauri app data
- Supports atomic writes and change watchers

**Migration path:** Implement `TauriStoreAdapter` (same `PersistenceAdapter` interface)
and swap it in during `createDefaultAdapter()` when running inside Tauri.

```typescript
// Future detection pattern
import { invoke } from '@tauri-apps/api/core';

async function createDefaultAdapter(): Promise<PersistenceAdapter> {
  try {
    await invoke('plugin:app|version'); // throws if not Tauri
    return new TauriStoreAdapter();
  } catch {
    return new LocalStorageAdapter();
  }
}
```

---

## Phase 4 Plan: SQLite Memory Index

Full agent memory requires efficient full-text search and vector similarity queries.
The plan:

1. Add `tauri-plugin-sql` (wraps SQLite via Rust).
2. Implement `SqliteAdapter` for structured memory tables.
3. Add optional vector embeddings table for semantic retrieval.
4. Project workspace paths will need explicit `fs:scope` grants in `tauri.conf.json`
   so Rust can read/write the user's project directory.

---

## Project Workspace Paths

`PersistedProject.localPath` is currently a **plain string placeholder**.

Real filesystem access in Tauri requires:

1. Declaring the allowed scope in `tauri.conf.json`:

```json
{
  "plugins": {
    "fs": {
      "scope": ["$HOME/dev/**", "$DOCUMENT/**"]
    }
  }
}
```

2. Using the Tauri `fs` plugin APIs instead of Node `fs` or `window.localStorage`.

Until Phase 3/4, local paths are stored as strings but not validated or accessed.

---

## MCP Config Path

`AppSettings.mcpConfigPath` stores the path to a user-managed MCP server config file
(similar to Claude Desktop's `claude_desktop_config.json`). In Phase 2B this is a
plain text input — no file is read or written. In a future phase, AURA will:

1. Read the MCP config file via Tauri FS APIs.
2. Launch MCP servers as child processes via Tauri `shell` plugin.
3. Register server capabilities in the agent router.

---

## Security Checklist for Future Phases

- [ ] API keys → Tauri Keyring / OS credential store only
- [ ] OAuth tokens → same as above
- [ ] Sensitive agent output → encrypt at rest with user-derived key
- [ ] MCP server processes → sandbox with restricted IPC capabilities
- [ ] Filesystem scope → explicit user-granted paths only, no wildcard `/**`
- [ ] Telemetry → off by default, opt-in only, no PII

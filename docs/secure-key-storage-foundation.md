# Secure Key Storage Foundation

> AURA must never store API keys in localStorage, commit them to git, or log them to the console.

## Current Status

**Phase: Foundation (Placeholder)**

The `SecureKeyService` provides a complete API surface with all storage operations returning "not implemented." This enables the rest of the system to develop against the API contract before the actual backend is wired up.

## Architecture Decision

### Why Not localStorage?

- localStorage is **plaintext** — any XSS or extension can read it
- localStorage is **not encrypted** — data is visible in browser DevTools
- localStorage is **per-origin** — shared across all tabs
- localStorage has **no access control** — any script can read any key
- localStorage **persists indefinitely** — no automatic expiry

### Why Not .env Files?

- `.env` files are easily committed to git by accident
- `.env` files are plaintext on disk
- `.env` files require manual distribution to every developer
- `.env` file paths must be added to `.gitignore` — easy to forget

### Recommended: OS Keychain/Keyring

| OS      | Backend                     | API                          |
|---------|-----------------------------|------------------------------|
| Windows | Credential Manager          | `wincred` / Windows DPAPI    |
| macOS   | Keychain Services           | `security` CLI / Security.framework |
| Linux   | Secret Service (GNOME Keyring / KWallet) | `libsecret` / D-Bus |

**Advantages:**
- Encrypted at rest by the OS
- Access-controlled per application
- User-authenticated (biometrics, password)
- System-managed lifecycle

### Tauri Plugin Options (v2)

#### Option A: `tauri-plugin-stronghold` (Recommended for AURA)

- **What:** IOTA Stronghold — encrypted file-based vault
- **Encryption:** XChaCha20-Poly1305
- **Tauri v2 compatible:** Yes
- **Tradeoffs:** Custom vault file, not OS-native, but fully cross-platform

#### Option B: OS Keychain via `keyring` crate

- **What:** Direct OS keychain access from Rust
- **Tauri v2 compatible:** Yes (as custom Tauri command)
- **Tradeoffs:** OS-native, but requires system keychain to be unlocked

#### Option C: `tauri-plugin-store` (NOT recommended for secrets)

- **What:** JSON file-based key-value store
- **Why not:** Not encrypted, plaintext JSON on disk
- **Acceptable for:** Non-sensitive settings only

## Migration Path

### Phase 1 (Current): Foundation
- `SecureKeyService` with placeholder operations
- API contract defined in `src/types/security.ts`
- No real secrets stored

### Phase 2: Tauri Stronghold Integration
1. Add `tauri-plugin-stronghold` to `Cargo.toml`
2. Register plugin in `lib.rs`
3. Create Rust commands: `store_secret`, `retrieve_secret`, `delete_secret`
4. Wire `SecureKeyService` to invoke Stronghold via Tauri IPC
5. Prompt user for vault password on first use

### Phase 3: Provider Key Migration
1. Detect any existing `.env` keys
2. Prompt admin to migrate each key to Stronghold
3. Delete `.env` entries after successful migration
4. Update `VoiceProviderService` to read keys from `SecureKeyService`

### Phase 4: Key Rotation & Audit
1. Track key creation/access timestamps
2. Alert on keys older than 90 days
3. Audit log of key access events
4. Support key rotation workflow

## Security Rules

1. **NEVER** store API keys in `localStorage`
2. **NEVER** commit `.env` files to git
3. **NEVER** log secret values to console or files
4. **NEVER** include secret values in error messages
5. **NEVER** expose keys in Tauri IPC payloads beyond the minimum needed
6. **ALWAYS** use the `SecureKeyService` API for key operations
7. **ALWAYS** validate key names before storage operations
8. **ALWAYS** clear sensitive data from memory after use

## Files

| File | Purpose |
|------|---------|
| `src/types/security.ts` | Type definitions for backends, keys, and operations |
| `src/services/security/SecureKeyService.ts` | Service with placeholder storage operations |
| `docs/secure-key-storage-foundation.md` | This document |

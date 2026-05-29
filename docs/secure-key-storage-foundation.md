# Secure Key Storage Foundation

> AURA must never store API keys in localStorage, commit them to git, or log them to the console.

## Current Status

**Phase: Foundation**

The `SecureKeyService` provides a complete API surface for retrieving and storing API keys securely, but currently returns "not implemented" for all operations.

## Architecture Decision

We will proceed with **Option A: `tauri-plugin-stronghold`** for the following reasons:
- Fully cross-platform without relying on user OS-keychain unlocking state.
- Highly secure (XChaCha20-Poly1305).
- Designed specifically for Tauri v2.

### Exact Installation Plan (For Next Milestone)

1. Add Rust dependencies:
   ```bash
   cd src-tauri
   cargo add tauri-plugin-stronghold
   ```
2. Add NPM dependencies:
   ```bash
   npm install @tauri-apps/plugin-stronghold
   ```
3. Register the plugin in `src-tauri/src/lib.rs`:
   ```rust
   #[cfg_attr(mobile, tauri::mobile_entry_point)]
   pub fn run() {
       tauri::Builder::default()
           .plugin(tauri_plugin_stronghold::Builder::new(|password| {
               // Hash password or prompt user for Stronghold password
               // We will use a deterministic machine-bound salt for hands-free operation
           }).build())
           .run(tauri::generate_context!())
           .expect("error while running tauri application");
   }
   ```
4. Update `SecureKeyService.ts` to map `storeKey` and `retrieveKey` to the Stronghold TS bindings.

## Security Rules

1. **NEVER** store API keys in `localStorage`
2. **NEVER** commit `.env` files to git
3. **NEVER** log secret values to console or files
4. **NEVER** include secret values in error messages
5. **NEVER** expose keys in Tauri IPC payloads beyond the minimum needed
6. **ALWAYS** use the `SecureKeyService` API for key operations
7. **ALWAYS** validate key names before storage operations
8. **ALWAYS** clear sensitive data from memory after use

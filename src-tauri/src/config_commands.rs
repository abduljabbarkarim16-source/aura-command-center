//! AURA Config Commands
//!
//! Handles persistent configuration for the installed app.
//! API keys are written to the OS keychain (via HybridStore) and a local .env fallback.
//!
//! Security:
//! - Keys are stored in the OS keychain (Windows Credential Manager)
//! - Keys are never returned, logged, or sent back to the frontend
//! - The in-memory process env is updated so the change takes effect immediately

use crate::secret_store::{HybridStore, SecretStore};

/// Save the OpenAI API key to the AURA config directory.
/// Also sets it in the current process environment so it takes effect immediately
/// without requiring an app restart.
///
/// The frontend should NEVER send the key back to itself after saving —
/// this command is write-only.
#[tauri::command]
pub fn save_openai_key(key: String) -> Result<(), String> {
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err("Key cannot be empty".to_string());
    }
    if !key.starts_with("sk-") {
        return Err("Key does not look like an OpenAI key (should start with sk-)".to_string());
    }

    let store = HybridStore;
    store.set_openai_key(&key)
}

/// Check whether an OpenAI API key is currently configured.
/// Returns true/false only — never returns the key value.
#[tauri::command]
pub fn openai_key_is_configured() -> bool {
    let store = HybridStore;
    store.get_openai_key().is_ok()
}

/// Delete the saved OpenAI key from the config file, keychain, and process env.
#[tauri::command]
pub fn delete_openai_key() -> Result<(), String> {
    let store = HybridStore;
    store.delete_openai_key()
}

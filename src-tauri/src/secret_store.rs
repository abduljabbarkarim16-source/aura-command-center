//! Secret storage abstraction for AURA Command Center
//!
//! Provides a secure OS-level keychain fallback for API keys.

use std::path::PathBuf;

/// Returns the AURA config directory: %APPDATA%\com.aura.commandcenter\
fn config_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    Ok(PathBuf::from(appdata).join("com.aura.commandcenter"))
}

pub trait SecretStore {
    fn set_openai_key(&self, key: &str) -> Result<(), String>;
    fn get_openai_key(&self) -> Result<String, String>;
    fn delete_openai_key(&self) -> Result<(), String>;
}

pub struct KeychainStore;

impl KeychainStore {
    fn get_entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new("aura-command-center", "openai-api-key")
            .map_err(|e| format!("Failed to access OS keychain: {e}"))
    }
}

impl SecretStore for KeychainStore {
    fn set_openai_key(&self, key: &str) -> Result<(), String> {
        let entry = Self::get_entry()?;
        entry.set_password(key).map_err(|e| format!("Failed to save key to OS keychain: {e}"))
    }

    fn get_openai_key(&self) -> Result<String, String> {
        let entry = Self::get_entry()?;
        entry.get_password().map_err(|e| format!("Failed to retrieve key from OS keychain: {e}"))
    }

    fn delete_openai_key(&self) -> Result<(), String> {
        let entry = Self::get_entry()?;
        entry.delete_credential().map_err(|e| format!("Failed to delete key from OS keychain: {e}"))
    }
}

pub struct EnvStore;

impl SecretStore for EnvStore {
    fn set_openai_key(&self, key: &str) -> Result<(), String> {
        let dir = config_dir()?;
        std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create config directory: {e}"))?;
        let env_path = dir.join(".env");
        let content = format!("# AURA — saved by in-app settings\nVITE_OPENAI_API_KEY={key}\nOPENAI_API_KEY={key}\n");
        std::fs::write(&env_path, &content).map_err(|e| format!("Could not write config file: {e}"))
    }

    fn get_openai_key(&self) -> Result<String, String> {
        if let Ok(key) = std::env::var("OPENAI_API_KEY") {
            if !key.trim().is_empty() {
                return Ok(key);
            }
        }
        if let Ok(key) = std::env::var("VITE_OPENAI_API_KEY") {
            if !key.trim().is_empty() {
                return Ok(key);
            }
        }
        Err("Key not found in env".to_string())
    }

    fn delete_openai_key(&self) -> Result<(), String> {
        if let Ok(dir) = config_dir() {
            let env_path = dir.join(".env");
            if env_path.exists() {
                std::fs::write(&env_path, "# AURA config — key removed\n").ok();
            }
        }
        Ok(())
    }
}

pub struct HybridStore;

impl SecretStore for HybridStore {
    fn set_openai_key(&self, key: &str) -> Result<(), String> {
        let _ = KeychainStore.set_openai_key(key);
        let _ = EnvStore.set_openai_key(key);
        // Also set in process environment so legacy code works immediately
        unsafe {
            std::env::set_var("VITE_OPENAI_API_KEY", key);
            std::env::set_var("OPENAI_API_KEY", key);
        }
        Ok(())
    }

    fn get_openai_key(&self) -> Result<String, String> {
        // First try keychain
        if let Ok(key) = KeychainStore.get_openai_key() {
            if !key.trim().is_empty() {
                return Ok(key);
            }
        }
        // Fallback to EnvStore
        if let Ok(key) = EnvStore.get_openai_key() {
            if !key.trim().is_empty() {
                // Migrate to keychain silently
                let _ = KeychainStore.set_openai_key(&key);
                return Ok(key);
            }
        }
        Err("No OpenAI API key found in Keychain or Env".to_string())
    }

    fn delete_openai_key(&self) -> Result<(), String> {
        let _ = KeychainStore.delete_openai_key();
        let _ = EnvStore.delete_openai_key();
        unsafe {
            std::env::remove_var("VITE_OPENAI_API_KEY");
            std::env::remove_var("OPENAI_API_KEY");
        }
        Ok(())
    }
}

/// AURA Config Commands
///
/// Handles persistent configuration for the installed app.
/// API keys are written to %APPDATA%\com.aura.commandcenter\.env
/// and hot-loaded into the running process so no restart is needed.
///
/// Security:
/// - Keys are written to a user-only AppData directory (not system-wide)
/// - Keys are never returned, logged, or sent to the frontend
/// - The in-memory process env is updated so the change takes effect immediately

use std::path::PathBuf;

/// Returns the AURA config directory: %APPDATA%\com.aura.commandcenter\
fn config_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    Ok(PathBuf::from(appdata).join("com.aura.commandcenter"))
}

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

    let dir = config_dir()?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Could not create config directory: {e}"))?;

    let env_path = dir.join(".env");
    let content = format!(
        "# AURA — saved by in-app settings\nVITE_OPENAI_API_KEY={key}\nOPENAI_API_KEY={key}\n"
    );
    std::fs::write(&env_path, &content)
        .map_err(|e| format!("Could not write config file: {e}"))?;

    // Hot-reload: update the current process environment so the key is
    // available to subsequent Tauri command calls without restarting.
    unsafe {
        std::env::set_var("VITE_OPENAI_API_KEY", &key);
        std::env::set_var("OPENAI_API_KEY", &key);
    }

    Ok(())
}

/// Check whether an OpenAI API key is currently configured.
/// Returns true/false only — never returns the key value.
#[tauri::command]
pub fn openai_key_is_configured() -> bool {
    std::env::var("VITE_OPENAI_API_KEY")
        .or_else(|_| std::env::var("OPENAI_API_KEY"))
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false)
}

/// Delete the saved OpenAI key from the config file and from the process env.
#[tauri::command]
pub fn delete_openai_key() -> Result<(), String> {
    // Remove from process env
    unsafe {
        std::env::remove_var("VITE_OPENAI_API_KEY");
        std::env::remove_var("OPENAI_API_KEY");
    }

    // Remove or overwrite the config file
    if let Ok(dir) = config_dir() {
        let env_path = dir.join(".env");
        if env_path.exists() {
            std::fs::write(&env_path, "# AURA config — key removed\n")
                .map_err(|e| format!("Could not clear config file: {e}"))?;
        }
    }

    Ok(())
}

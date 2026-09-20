mod cli_commands;
mod commands;
mod config_commands;
mod event_log;
mod persist_commands;
mod voice_commands;

/// Environment variable names that can supply the OpenAI key, in priority order.
const OPENAI_KEY_VARS: [&str; 2] = ["VITE_OPENAI_API_KEY", "OPENAI_API_KEY"];

/// True only when a *usable* OpenAI key is present in the process environment.
///
/// An empty or whitespace-only value counts as absent. A blank `.env` template
/// must never be treated as "the key is configured".
fn openai_key_present() -> bool {
    OPENAI_KEY_VARS
        .iter()
        .any(|k| std::env::var(k).map(|v| !v.trim().is_empty()).unwrap_or(false))
}

/// Remove blank key variables so a later source can still supply a real value.
///
/// `dotenvy::from_path` does not override variables that are already set. Without
/// this, a `.env` containing `VITE_OPENAI_API_KEY=` (no value) would set the var to
/// an empty string and permanently shadow the real key in `%APPDATA%`.
fn clear_blank_openai_keys() {
    for k in OPENAI_KEY_VARS {
        if let Ok(v) = std::env::var(k) {
            if v.trim().is_empty() {
                std::env::remove_var(k);
            }
        }
    }
}

/// Load `path` as a dotenv file and report whether it yielded a usable key.
fn load_env_file(path: &std::path::Path) -> bool {
    if dotenvy::from_path(path).is_err() {
        return false;
    }
    clear_blank_openai_keys();
    openai_key_present()
}

// Walk up the directory tree from `start`, loading any `.env` found.
//
// DEFECT-1: this previously returned as soon as a `.env` file *parsed*, regardless
// of whether it contained anything. A blank `.env` in the project root therefore
// satisfied source 1 and stopped the search before `%APPDATA%` was ever consulted,
// producing a total provider outage while Settings still showed the key as saved.
// The criterion is now "did we actually obtain a key", not "did a file exist".
fn try_dotenv_from(start: std::path::PathBuf) -> bool {
    let mut dir = start;
    for _ in 0..8 {
        if load_env_file(&dir.join(".env")) {
            return true;
        }
        match dir.parent() {
            Some(p) => dir = p.to_path_buf(),
            None => break,
        }
    }
    false
}

fn load_dotenv() {
    // 1. Try CWD and parent dirs (works in `tauri dev` where CWD = project root)
    if let Ok(cwd) = std::env::current_dir() {
        if try_dotenv_from(cwd) {
            return;
        }
    }
    // 2. Try from the executable location and parent dirs
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            if try_dotenv_from(exe_dir.to_path_buf()) {
                return;
            }
        }
    }
    // 3. Try %APPDATA%\com.aura.commandcenter\.env
    //    This is where the in-app Settings key-save writes the file.
    //    Works for the installed app on Windows.
    if let Ok(appdata) = std::env::var("APPDATA") {
        let candidate = std::path::PathBuf::from(&appdata)
            .join("com.aura.commandcenter")
            .join(".env");
        if load_env_file(&candidate) {
            return;
        }
    }
    // 4. Try common dev-environment project paths under %USERPROFILE%\Documents
    if let Ok(home) = std::env::var("USERPROFILE") {
        let roots = [
            "Documents\\AURA\\agent-command-center-phase-3j",
            "Documents\\AURA\\agent-command-center",
            "Documents\\aura\\agent-command-center-phase-3j",
            "Documents\\aura\\agent-command-center",
            "aura-command-center",
        ];
        for rel in &roots {
            let candidate = std::path::PathBuf::from(&home).join(rel).join(".env");
            if load_env_file(&candidate) {
                return;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// Serialises the tests in this module: they mutate process-global env vars.
    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    fn reset_keys() {
        for k in OPENAI_KEY_VARS {
            std::env::remove_var(k);
        }
    }

    fn write_env(dir: &std::path::Path, body: &str) -> std::path::PathBuf {
        std::fs::create_dir_all(dir).unwrap();
        let p = dir.join(".env");
        let mut f = std::fs::File::create(&p).unwrap();
        f.write_all(body.as_bytes()).unwrap();
        p
    }

    #[test]
    fn blank_value_is_not_a_present_key() {
        let _g = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_keys();
        assert!(!openai_key_present(), "no vars set must mean absent");
        std::env::set_var("VITE_OPENAI_API_KEY", "");
        assert!(!openai_key_present(), "empty value must count as absent");
        std::env::set_var("VITE_OPENAI_API_KEY", "   ");
        assert!(!openai_key_present(), "whitespace-only must count as absent");
        std::env::set_var("VITE_OPENAI_API_KEY", "sk-test-value");
        assert!(openai_key_present(), "real value must count as present");
        reset_keys();
    }

    #[test]
    fn fallback_var_is_honoured() {
        let _g = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_keys();
        std::env::set_var("OPENAI_API_KEY", "sk-fallback");
        assert!(openai_key_present(), "OPENAI_API_KEY alone must satisfy");
        reset_keys();
    }

    #[test]
    fn clear_blank_removes_only_empty_values() {
        let _g = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_keys();
        std::env::set_var("VITE_OPENAI_API_KEY", "");
        std::env::set_var("OPENAI_API_KEY", "sk-real");
        clear_blank_openai_keys();
        assert!(std::env::var("VITE_OPENAI_API_KEY").is_err(), "blank var must be removed");
        assert_eq!(std::env::var("OPENAI_API_KEY").unwrap(), "sk-real", "real var must survive");
        reset_keys();
    }

    /// DEFECT-1 regression: a blank project `.env` must not shadow a real key
    /// in a later source. Before the fix, loading the blank file returned true
    /// and the second source was never consulted.
    #[test]
    fn blank_env_file_does_not_shadow_a_real_key() {
        let _g = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_keys();

        let base = std::env::temp_dir().join(format!("aura-defect1-{}", std::process::id()));
        let blank_dir = base.join("project");
        let real_dir = base.join("appdata");
        let blank = write_env(&blank_dir, "# template\nVITE_OPENAI_API_KEY=\nOPENAI_API_KEY=\n");
        let real = write_env(&real_dir, "VITE_OPENAI_API_KEY=sk-the-real-key\n");

        // Source 1: the blank file parses, but yields no usable key.
        assert!(!load_env_file(&blank), "blank .env must NOT report success");
        assert!(!openai_key_present(), "blank .env must leave the key absent");

        // Source 2: the real file must still be able to supply the key.
        assert!(load_env_file(&real), "real .env must report success");
        assert!(openai_key_present(), "real key must be loaded after a blank file");
        assert_eq!(std::env::var("VITE_OPENAI_API_KEY").unwrap(), "sk-the-real-key");

        reset_keys();
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn missing_file_is_not_success() {
        let _g = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_keys();
        let nowhere = std::env::temp_dir().join("aura-does-not-exist-xyz").join(".env");
        assert!(!load_env_file(&nowhere), "absent file must not report success");
        reset_keys();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env for development — silently ignore if file is absent.
    // Production builds should use OS keychain / Tauri Stronghold instead.
    load_dotenv();

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::run_allowed_command,
            commands::get_workspace_info,
            commands::check_command_available,
            commands::list_allowed_commands,
            commands::check_cli_available,
            commands::get_workspace_path,
            commands::set_workspace_path,
            commands::append_memory_repo_event,
            config_commands::save_openai_key,
            config_commands::openai_key_is_configured,
            config_commands::delete_openai_key,
            voice_commands::openai_transcribe_audio,
            voice_commands::openai_chat_response,
            voice_commands::openai_fast_chat_response,
            voice_commands::openai_chat_with_tools,
            voice_commands::openai_chat_tool_result,
            voice_commands::openai_extract_memory,
            voice_commands::openai_synthesize_speech,
            voice_commands::local_transcribe_audio,
            cli_commands::spawn_agent_session,
            cli_commands::get_cli_help,
            persist_commands::persist_read,
            persist_commands::persist_write,
            persist_commands::persist_delete,
            persist_commands::persist_list,
            event_log::append_event_log,
            event_log::append_event_log_batch,
            event_log::read_event_log,
            event_log::event_log_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

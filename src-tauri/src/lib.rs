mod commands;
mod voice_commands;

// Walk up the directory tree from `start`, trying to load a `.env` file.
// Returns true if a `.env` was successfully loaded.
fn try_dotenv_from(start: std::path::PathBuf) -> bool {
    let mut dir = start;
    for _ in 0..8 {
        let candidate = dir.join(".env");
        if dotenvy::from_path(&candidate).is_ok() {
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
    // 2. Try from the executable location and parent dirs (works for installed app)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            if try_dotenv_from(exe_dir.to_path_buf()) {
                return;
            }
        }
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
      voice_commands::openai_transcribe_audio,
      voice_commands::openai_chat_response,
      voice_commands::openai_synthesize_speech,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

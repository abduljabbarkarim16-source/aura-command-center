mod commands;
mod voice_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Load .env for development — silently ignore if file is absent.
  // Production builds should use OS keychain / Tauri Stronghold instead.
  let _ = dotenvy::dotenv();

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

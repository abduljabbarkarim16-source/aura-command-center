mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

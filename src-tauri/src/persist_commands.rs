//! Persistent key-value store — survives app reinstalls.
//!
//! Writes JSON blobs to %APPDATA%\com.aura.commandcenter\persist\{key}.json
//! This path is stable across NSIS reinstalls (unlike WebView2 localStorage
//! which can be wiped when the WebView2 data partition is reset).
//!
//! Privacy: caller is responsible for not writing secrets here.
//! Keys are sanitized to [a-zA-Z0-9._-] to prevent path traversal.

use std::fs;
use std::path::PathBuf;

fn persist_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "APPDATA env var not set".to_string())?;
    let dir = PathBuf::from(appdata)
        .join("com.aura.commandcenter")
        .join("persist");
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create persist dir: {e}"))?;
    Ok(dir)
}

fn sanitize_key(key: &str) -> Result<String, String> {
    let safe: String = key.chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .collect();
    if safe.is_empty() || safe.len() > 128 {
        return Err(format!("Invalid persist key: {key:?}"));
    }
    Ok(safe)
}

/// Read a persisted value. Returns None if key has never been written.
#[tauri::command]
pub fn persist_read(key: String) -> Result<Option<String>, String> {
    let key = sanitize_key(&key)?;
    let path = persist_dir()?.join(format!("{key}.json"));
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("persist_read({key}): {e}"))?;
    Ok(Some(raw))
}

/// Write (overwrite) a persisted value. Value is an arbitrary JSON string.
#[tauri::command]
pub fn persist_write(key: String, value: String) -> Result<(), String> {
    let key = sanitize_key(&key)?;
    let path = persist_dir()?.join(format!("{key}.json"));
    fs::write(&path, value.as_bytes())
        .map_err(|e| format!("persist_write({key}): {e}"))
}

/// Delete a persisted key. No-op if the key does not exist.
#[tauri::command]
pub fn persist_delete(key: String) -> Result<(), String> {
    let key = sanitize_key(&key)?;
    let path = persist_dir()?.join(format!("{key}.json"));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("persist_delete({key}): {e}"))?;
    }
    Ok(())
}

/// List all persisted keys.
#[tauri::command]
pub fn persist_list() -> Result<Vec<String>, String> {
    let dir = persist_dir()?;
    let mut keys = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let s = name.to_string_lossy();
            if s.ends_with(".json") {
                keys.push(s[..s.len() - 5].to_string());
            }
        }
    }
    keys.sort();
    Ok(keys)
}

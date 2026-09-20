//! AURA Event Log — durable, append-only record of everything the app does.
//!
//! Why this exists: until now, diagnosing a fault meant reconstructing it from screen
//! recordings frame by frame. Runtime state lived in localStorage (capped, per-profile,
//! invisible from outside the app) and the Tauri log plugin was configured but never
//! written to. There was no single place showing *why* something happened — which filter
//! fired, what the raw transcript was before filtering, what state a turn was in.
//!
//! Format: JSON Lines at %APPDATA%\com.aura.commandcenter\logs\aura-events.jsonl.
//! One self-describing JSON object per line, so it can be tailed, grepped, or parsed
//! without loading the whole file.
//!
//! Security invariants:
//!   - Secrets are redacted here as a backstop, independent of the caller. Any value
//!     resembling an API key is replaced before it reaches disk.
//!   - The log lives in user AppData, never in the repository.
//!   - Rotation is bounded so the file cannot grow without limit.

use std::io::Write;
use std::path::PathBuf;

/// Rotate once the active log passes this size. Two generations are kept.
const MAX_LOG_BYTES: u64 = 8 * 1024 * 1024;

/// Hard cap on a single event payload, so one pathological entry cannot bloat the file.
const MAX_LINE_BYTES: usize = 32 * 1024;

fn logs_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "APPDATA environment variable not found".to_string())?;
    Ok(PathBuf::from(appdata)
        .join("com.aura.commandcenter")
        .join("logs"))
}

fn log_path() -> Result<PathBuf, String> {
    Ok(logs_dir()?.join("aura-events.jsonl"))
}

/// Replace anything that looks like a credential with a placeholder.
///
/// A backstop, not the primary defence — callers should not pass secrets in the first
/// place. But a log that silently captures an API key is far worse than a missing log,
/// so the check lives at the boundary where it cannot be forgotten.
fn redact(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for token in s.split_inclusive(|c: char| c.is_whitespace() || c == '"' || c == ',') {
        let trimmed = token.trim_matches(|c: char| c.is_whitespace() || c == '"' || c == ',');
        let looks_secret = (trimmed.starts_with("sk-") && trimmed.len() >= 20)
            || (trimmed.starts_with("AIza") && trimmed.len() >= 30)
            || (trimmed.starts_with("ghp_") && trimmed.len() >= 30)
            || (trimmed.starts_with("AQ.") && trimmed.len() >= 30);
        if looks_secret {
            out.push_str("[REDACTED]");
            // Preserve whatever delimiter the token carried.
            if let Some(last) = token.chars().last() {
                if last.is_whitespace() || last == '"' || last == ',' {
                    out.push(last);
                }
            }
        } else {
            out.push_str(token);
        }
    }
    out
}

fn rotate_if_needed(path: &PathBuf) {
    let too_big = std::fs::metadata(path).map(|m| m.len() > MAX_LOG_BYTES).unwrap_or(false);
    if too_big {
        let rotated = path.with_extension("jsonl.1");
        let _ = std::fs::remove_file(&rotated);
        let _ = std::fs::rename(path, &rotated);
    }
}

/// Append one pre-serialised JSON event line.
///
/// The frontend owns the event schema; this command only guarantees durability,
/// redaction and rotation. Failures are returned rather than swallowed so a broken log
/// is visible instead of quietly absent — the exact failure mode this replaces.
#[tauri::command]
pub fn append_event_log(line: String) -> Result<(), String> {
    let dir = logs_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create logs dir: {e}"))?;
    let path = log_path()?;
    rotate_if_needed(&path);

    let mut safe = redact(line.trim());
    if safe.len() > MAX_LINE_BYTES {
        safe.truncate(MAX_LINE_BYTES);
        safe.push_str("…[truncated]");
    }

    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Could not open event log: {e}"))?;
    writeln!(f, "{safe}").map_err(|e| format!("Could not write event log: {e}"))?;
    Ok(())
}

/// Append several event lines in one call, for batched flushes from the frontend.
#[tauri::command]
pub fn append_event_log_batch(lines: Vec<String>) -> Result<usize, String> {
    let dir = logs_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create logs dir: {e}"))?;
    let path = log_path()?;
    rotate_if_needed(&path);

    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Could not open event log: {e}"))?;

    let mut written = 0usize;
    for line in lines {
        let mut safe = redact(line.trim());
        if safe.is_empty() {
            continue;
        }
        if safe.len() > MAX_LINE_BYTES {
            safe.truncate(MAX_LINE_BYTES);
            safe.push_str("…[truncated]");
        }
        writeln!(f, "{safe}").map_err(|e| format!("Could not write event log: {e}"))?;
        written += 1;
    }
    Ok(written)
}

/// Return the most recent `limit` lines, newest last. Used by the in-app log viewer.
#[tauri::command]
pub fn read_event_log(limit: usize) -> Result<Vec<String>, String> {
    let path = log_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Could not read event log: {e}"))?;
    let all: Vec<&str> = content.lines().filter(|l| !l.trim().is_empty()).collect();
    let start = all.len().saturating_sub(limit.clamp(1, 20_000));
    Ok(all[start..].iter().map(|s| s.to_string()).collect())
}

/// Absolute path and current size, so the UI can tell the user where the log lives.
#[tauri::command]
pub fn event_log_info() -> Result<serde_json::Value, String> {
    let path = log_path()?;
    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    Ok(serde_json::json!({
        "path": path.to_string_lossy(),
        "bytes": size,
        "exists": path.exists(),
    }))
}

#[cfg(test)]
mod tests {
    use super::redact;

    /// A log that captures an API key is worse than no log at all, so redaction is
    /// enforced at the write boundary rather than trusted to every caller.
    #[test]
    fn credentials_are_redacted() {
        let line = r#"{"event":"x","key":"sk-proj-abcdefghijklmnopqrstuvwxyz0123456789"}"#;
        let out = redact(line);
        assert!(!out.contains("sk-proj-abcdefghijk"), "OpenAI key survived: {out}");
        assert!(out.contains("[REDACTED]"));

        let g = redact("token AIzaSyA1234567890abcdefghijklmnopqrstuv here");
        assert!(!g.contains("AIzaSyA1234567890"), "Google key survived: {g}");

        let e = redact("AQ.Ab8RN6JqK1234567890abcdefghijklmnopqrstuvwxyz");
        assert!(e.contains("[REDACTED]"), "ephemeral token survived: {e}");
    }

    /// Redaction must not mangle ordinary diagnostic text.
    #[test]
    fn ordinary_text_is_untouched() {
        let line = r#"{"event":"stt.result","text":"open settings for me","ms":412}"#;
        assert_eq!(redact(line), line);
        assert_eq!(redact("peak 0.1641 LIVE"), "peak 0.1641 LIVE");
    }
}

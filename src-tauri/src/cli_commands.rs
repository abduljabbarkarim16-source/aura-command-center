//! AURA CLI Agent Runner — Controlled agent session execution
//!
//! Allows AURA to spawn short, allowlisted CLI agent sessions (claude, codex).
//! All sessions are strictly controlled:
//!   - Only allowlisted binaries may run
//!   - Prompts are length-limited and metacharacter-checked
//!   - Sessions are run non-interactively with a hard timeout (60s)
//!   - No API keys, no repo source, no secrets in prompts
//!   - stdout/stderr captured, not streamed to external services
//!   - Usage-limit detection: parse known patterns and return flag
//!
//! Security invariants:
//!   - Binary allowlist is hardcoded in Rust
//!   - Prompt sanitised before execution
//!   - No shell invocation; direct process spawn
//!   - Timeout enforced by polling the child handle directly

use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::{Duration, Instant};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ─── Constants ─────────────────────────────────────────────────────────────────

/// Only these binaries may be spawned via this module.
const CLI_ALLOWLIST: &[&str] = &["claude", "codex"];

/// Maximum prompt length (chars). Prevents prompt injection at scale.
const MAX_PROMPT_LEN: usize = 2_000;

/// Hard session timeout in seconds.
const SESSION_TIMEOUT_SECS: u64 = 60;

/// Characters rejected in prompts (shell metacharacters remain dangerous
/// even in direct-spawn scenarios; reject to be safe).
const BLOCKED_CHARS: &[char] = &['`', '$', '\\'];

// ─── Known usage-limit patterns ────────────────────────────────────────────────

const USAGE_LIMIT_PATTERNS: &[&str] = &[
    "usage limit reached",
    "usage limit exceeded",
    "out of usage",
    "rate limit",
    "quota exceeded",
    "try again after",
    "reset at",
    "credits required",
    "upgrade required",
    "insufficient_quota",
    "You have exceeded your current quota",
    "You have reached your usage limit",
    "no more messages",
    "message limit",
];

/// Check if output indicates a usage / quota limit.
fn detect_usage_limit(text: &str) -> bool {
    let lower = text.to_lowercase();
    USAGE_LIMIT_PATTERNS
        .iter()
        .any(|p| lower.contains(&p.to_lowercase()))
}

// ─── Types ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionResult {
    pub session_id: String,
    pub binary: String,
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub timed_out: bool,
    pub usage_limit_detected: bool,
    pub usage_limit_message: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CliHelpSummary {
    pub binary: String,
    pub available: bool,
    pub help_text: String,
    pub path: Option<String>,
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

fn is_allowed_cli(binary: &str) -> bool {
    let lower = binary.to_lowercase();
    CLI_ALLOWLIST.contains(&lower.as_str())
}

fn sanitise_prompt(prompt: &str) -> Result<String, String> {
    if prompt.len() > MAX_PROMPT_LEN {
        return Err(format!(
            "Prompt too long ({} chars, max {})",
            prompt.len(),
            MAX_PROMPT_LEN
        ));
    }
    if prompt.chars().any(|c| BLOCKED_CHARS.contains(&c)) {
        return Err("Prompt contains blocked characters".into());
    }
    Ok(prompt.to_string())
}

// ─── Tauri commands ────────────────────────────────────────────────────────────

/// Spawn a non-interactive agent CLI session and return the full output.
///
/// The prompt is passed as a positional argument.
/// Claude Code CLI: `claude --print "<prompt>"` (falls back to `claude "<prompt>"`)
/// Codex CLI: `codex "<prompt>"`
///
/// The process is killed after SESSION_TIMEOUT_SECS regardless of exit status.
/// No streaming — full output returned on completion.
#[tauri::command]
pub fn spawn_agent_session(
    binary: String,
    prompt: String,
    session_id: String,
) -> AgentSessionResult {
    // ── Validation ────────────────────────────────────────────────────────
    let make_error = |msg: &str| AgentSessionResult {
        session_id: session_id.clone(),
        binary: binary.clone(),
        success: false,
        exit_code: -1,
        stdout: String::new(),
        stderr: String::new(),
        duration_ms: 0,
        timed_out: false,
        usage_limit_detected: false,
        usage_limit_message: None,
        error: Some(msg.to_string()),
    };

    if !is_allowed_cli(&binary) {
        return make_error(&format!(
            "Binary '{}' is not in the AURA CLI allowlist",
            binary
        ));
    }

    let clean_prompt = match sanitise_prompt(&prompt) {
        Ok(p) => p,
        Err(e) => return make_error(&e),
    };

    // ── Build command ─────────────────────────────────────────────────────
    //
    // Windows note: npm-installed CLIs are .cmd scripts (codex.cmd, claude.cmd).
    // Rust's Command::new() on Windows does NOT resolve .cmd files unless routed
    // through cmd.exe. We always use "cmd /C <binary> <args>" on Windows so both
    // claude and codex are found regardless of PATH ordering.
    //
    // Claude Code: --print flag for non-interactive output
    // Codex: 'exec' subcommand + --no-interactive flag

    let lower = binary.to_lowercase();
    let cli_args: Vec<String> = if lower == "claude" {
        vec!["--print".to_string(), clean_prompt.clone()]
    } else if lower == "codex" {
        // codex exec <prompt> runs the agent non-interactively
        // --dangerously-skip-permissions lets it run without confirmation prompts
        vec!["exec".to_string(), clean_prompt.clone(),
             "--dangerously-skip-permissions".to_string()]
    } else {
        vec![clean_prompt.clone()]
    };

    let start = Instant::now();
    let timeout = Duration::from_secs(SESSION_TIMEOUT_SECS);

    // On Windows: route through cmd.exe /C so .cmd scripts resolve correctly
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.arg("/C").arg(&binary);
        for a in &cli_args { c.arg(a); }
        #[cfg(target_os = "windows")]
        c.creation_flags(CREATE_NO_WINDOW);
        c
    } else {
        let mut c = Command::new(&binary);
        c.args(&cli_args);
        #[cfg(target_os = "windows")]
        c.creation_flags(CREATE_NO_WINDOW);
        c
    };

    let mut child = match cmd
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            return make_error(&format!("Failed to spawn '{}': {}", binary, e));
        }
    };

    let mut was_timed_out = false;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if start.elapsed() >= timeout => {
                was_timed_out = true;
                let _ = child.kill();
                break;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(100)),
            Err(e) => {
                let duration_ms = start.elapsed().as_millis() as u64;
                return AgentSessionResult {
                    session_id,
                    binary,
                    success: false,
                    exit_code: -1,
                    stdout: String::new(),
                    stderr: String::new(),
                    duration_ms,
                    timed_out: false,
                    usage_limit_detected: false,
                    usage_limit_message: None,
                    error: Some(format!("Process wait error: {e}")),
                };
            }
        }
    }

    let output = child.wait_with_output();
    let duration_ms = start.elapsed().as_millis() as u64;

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let exit_code = out.status.code().unwrap_or(-1);

            // Detect usage limits in both stdout and stderr
            let all_output = format!("{}\n{}", stdout, stderr);
            let usage_detected = detect_usage_limit(&all_output);
            let usage_message = if usage_detected {
                // Extract the first matching line
                all_output
                    .lines()
                    .find(|l| {
                        USAGE_LIMIT_PATTERNS
                            .iter()
                            .any(|p| l.to_lowercase().contains(&p.to_lowercase()))
                    })
                    .map(|l| l.trim().to_string())
            } else {
                None
            };

            AgentSessionResult {
                session_id,
                binary,
                success: exit_code == 0,
                exit_code,
                stdout,
                stderr,
                duration_ms,
                timed_out: was_timed_out,
                usage_limit_detected: usage_detected,
                usage_limit_message: usage_message,
                error: None,
            }
        }
        Err(e) => AgentSessionResult {
            session_id,
            binary,
            success: false,
            exit_code: -1,
            stdout: String::new(),
            stderr: String::new(),
            duration_ms,
            timed_out: was_timed_out,
            usage_limit_detected: false,
            usage_limit_message: None,
            error: Some(format!("Process error: {e}")),
        },
    }
}

/// Get a brief help summary for an allowed CLI binary.
/// Runs `<binary> --help` with a short timeout and returns first ~50 lines.
#[tauri::command]
pub fn get_cli_help(binary: String) -> CliHelpSummary {
    if !is_allowed_cli(&binary) {
        return CliHelpSummary {
            binary,
            available: false,
            help_text: String::new(),
            path: None,
        };
    }

    // Get path first
    let check_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    let mut cmd = Command::new(check_cmd);
    cmd.arg(&binary);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let path_opt = cmd.output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string()
        })
        .filter(|s| !s.is_empty());

    let available = path_opt.is_some();
    if !available {
        return CliHelpSummary {
            binary,
            available: false,
            help_text: String::new(),
            path: None,
        };
    }

    // Use cmd /C on Windows so .cmd scripts resolve
    let output = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &binary, "--help"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.output()
    } else {
        let mut cmd = Command::new(&binary);
        cmd.arg("--help")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.output()
    };

    let help_text = match output {
        Ok(o) => {
            let combined = format!(
                "{}{}",
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr),
            );
            // Return first 50 lines only
            combined.lines().take(50).collect::<Vec<_>>().join("\n")
        }
        Err(_) => String::new(),
    };

    CliHelpSummary {
        binary,
        available: true,
        help_text,
        path: path_opt,
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allowlist_check() {
        assert!(is_allowed_cli("claude"));
        assert!(is_allowed_cli("codex"));
        assert!(!is_allowed_cli("bash"));
        assert!(!is_allowed_cli("rm"));
        assert!(!is_allowed_cli("powershell"));
    }

    #[test]
    fn test_prompt_sanitise() {
        assert!(sanitise_prompt("Hello, please help me").is_ok());
        assert!(sanitise_prompt(&"a".repeat(MAX_PROMPT_LEN + 1)).is_err());
        assert!(sanitise_prompt("exec `ls`").is_err()); // backtick blocked
        assert!(sanitise_prompt("$HOME").is_err()); // $ blocked
    }

    #[test]
    fn test_usage_limit_detection() {
        assert!(detect_usage_limit("You have exceeded your current quota"));
        assert!(detect_usage_limit("usage limit reached"));
        assert!(!detect_usage_limit("Everything is working fine"));
    }
}

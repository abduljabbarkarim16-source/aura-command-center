//! AURA Native Command Bridge — Controlled execution layer
//!
//! This module provides a strict allowlist-based command execution bridge.
//! Only pre-approved commands can run. All others are rejected.
//!
//! Security invariants:
//! - Allowlist is hardcoded in Rust — frontend cannot modify it
//! - Shell metacharacters are rejected
//! - Blocked executables are rejected even if somehow matched
//! - No environment variable printing
//! - No command chaining
//! - stdout/stderr are captured and returned as structured data

use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Instant;

// ─── Allowlist ─────────────────────────────────────────────────────────────────

/// Each allowed command is a (program, exact_args) tuple.
/// The frontend must match these exactly — no extra args allowed.
struct AllowedCommand {
    program: &'static str,
    args: &'static [&'static str],
    display_name: &'static str,
}

const ALLOWED_COMMANDS: &[AllowedCommand] = &[
    AllowedCommand {
        program: "npm",
        args: &["run", "lint"],
        display_name: "TypeScript lint check",
    },
    AllowedCommand {
        program: "npm",
        args: &["run", "build"],
        display_name: "Vite production build",
    },
    AllowedCommand {
        program: "npm",
        args: &["run", "tauri:build"],
        display_name: "Tauri production build",
    },
    AllowedCommand {
        program: "git",
        args: &["status", "--short"],
        display_name: "Git status (short)",
    },
    AllowedCommand {
        program: "git",
        args: &["branch", "--show-current"],
        display_name: "Show current branch",
    },
    AllowedCommand {
        program: "git",
        args: &["log", "--oneline", "-20"],
        display_name: "Git log (last 20)",
    },
    AllowedCommand {
        program: "cargo",
        args: &["test"],
        display_name: "Rust unit tests",
    },
];

/// Executables that are always rejected, even if an allowlist entry
/// were somehow misconfigured to include them.
const BLOCKED_EXECUTABLES: &[&str] = &[
    "rm",
    "del",
    "rmdir",
    "Remove-Item",
    "curl",
    "wget",
    "Invoke-WebRequest",
    "Invoke-RestMethod",
    "powershell",
    "pwsh",
    "cmd",
    "sh",
    "bash",
    "zsh",
    "npx",
    "node",
    "python",
    "python3",
    "pip",
    "pip3",
    "format",
    "diskpart",
    "reg",
    "regedit",
    "net",
    "netsh",
    "taskkill",
];

/// Characters that indicate shell metacharacter injection.
const SHELL_METACHARACTERS: &[char] = &['|', '&', ';', '$', '`', '>', '<', '(', ')', '{', '}'];

// ─── Result types ──────────────────────────────────────────────────────────────

/// camelCase serialization so TypeScript receives exitCode, durationMs etc.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub program: String,
    pub args: Vec<String>,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub allowed: bool,
    pub cwd: String,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WorkspaceInfo {
    pub cwd: String,
    pub os: String,
    pub arch: String,
    pub tauri_version: String,
    pub app_version: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CommandAvailability {
    pub program: String,
    pub available: bool,
    pub path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AllowedCommandEntry {
    pub program: String,
    pub args: Vec<String>,
    pub display_name: String,
}

// ─── Validation helpers ────────────────────────────────────────────────────────

fn is_blocked_executable(program: &str) -> bool {
    let lower = program.to_lowercase();
    BLOCKED_EXECUTABLES
        .iter()
        .any(|b| b.to_lowercase() == lower)
}

fn contains_metacharacters(s: &str) -> bool {
    s.chars().any(|c| SHELL_METACHARACTERS.contains(&c))
}

fn is_allowed_command(program: &str, args: &[String]) -> Option<&'static AllowedCommand> {
    ALLOWED_COMMANDS.iter().find(|cmd| {
        cmd.program.eq_ignore_ascii_case(program)
            && cmd.args.len() == args.len()
            && cmd
                .args
                .iter()
                .zip(args.iter())
                .all(|(a, b)| *a == b.as_str())
    })
}

// ─── Tauri commands ────────────────────────────────────────────────────────────

/// Run a command from the strict allowlist.
/// Rejects anything not in the list, any blocked executable, and any metacharacters.
#[tauri::command]
pub fn run_allowed_command(program: String, args: Vec<String>) -> CommandResult {
    let resolved_cwd = get_project_root();

    // 1. Check for blocked executable
    if is_blocked_executable(&program) {
        return CommandResult {
            program,
            args,
            exit_code: -1,
            stdout: String::new(),
            stderr: String::new(),
            duration_ms: 0,
            allowed: false,
            cwd: resolved_cwd,
            error: Some("Blocked: this executable is not allowed".into()),
        };
    }

    // 2. Check for shell metacharacters in program and all args
    if contains_metacharacters(&program) || args.iter().any(|a| contains_metacharacters(a)) {
        return CommandResult {
            program,
            args,
            exit_code: -1,
            stdout: String::new(),
            stderr: String::new(),
            duration_ms: 0,
            allowed: false,
            cwd: resolved_cwd,
            error: Some("Blocked: shell metacharacters detected".into()),
        };
    }

    // 3. Check allowlist
    let allowed = is_allowed_command(&program, &args);
    if allowed.is_none() {
        return CommandResult {
            program,
            args,
            exit_code: -1,
            stdout: String::new(),
            stderr: String::new(),
            duration_ms: 0,
            allowed: false,
            cwd: resolved_cwd,
            error: Some("Rejected: command is not in the allowlist".into()),
        };
    }

    // 4. Execute the command
    let start = Instant::now();

    // On Windows, we need to run npm via cmd /c for proper .cmd resolution.
    // But we do NOT allow arbitrary cmd usage — only for npm/git from the allowlist.
    let output = if cfg!(target_os = "windows") && program.eq_ignore_ascii_case("npm") {
        Command::new("cmd")
            .args(["/C", &program])
            .args(&args)
            .current_dir(get_project_root())
            .output()
    } else {
        Command::new(&program)
            .args(&args)
            .current_dir(get_project_root())
            .output()
    };

    let duration_ms = start.elapsed().as_millis() as u64;
    let cwd_used = get_project_root();

    match output {
        Ok(output) => CommandResult {
            program,
            args,
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            duration_ms,
            allowed: true,
            cwd: cwd_used,
            error: None,
        },
        Err(e) => CommandResult {
            program,
            args,
            exit_code: -1,
            stdout: String::new(),
            stderr: String::new(),
            duration_ms,
            allowed: true,
            cwd: cwd_used,
            error: Some(format!("Process error: {e}")),
        },
    }
}

/// Get workspace information for the frontend.
#[tauri::command]
pub fn get_workspace_info() -> WorkspaceInfo {
    let cwd = get_project_root();
    WorkspaceInfo {
        cwd,
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        tauri_version: "2.11.2".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

/// Check if a program is available on the system PATH.
/// Only checks programs that appear in the allowlist.
#[tauri::command]
pub fn check_command_available(program: String) -> CommandAvailability {
    // Only allow checking programs from the allowlist
    let in_allowlist = ALLOWED_COMMANDS
        .iter()
        .any(|cmd| cmd.program.eq_ignore_ascii_case(&program));

    if !in_allowlist {
        return CommandAvailability {
            program,
            available: false,
            path: None,
        };
    }

    // Use `where` on Windows, `which` on Unix
    let check_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    let output = Command::new(check_cmd).arg(&program).output();

    match output {
        Ok(output) if output.status.success() => {
            let path = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            CommandAvailability {
                program,
                available: true,
                path: if path.is_empty() { None } else { Some(path) },
            }
        }
        _ => CommandAvailability {
            program,
            available: false,
            path: None,
        },
    }
}

/// List all allowed commands (for frontend display).
#[tauri::command]
pub fn list_allowed_commands() -> Vec<AllowedCommandEntry> {
    ALLOWED_COMMANDS
        .iter()
        .map(|cmd| AllowedCommandEntry {
            program: cmd.program.to_string(),
            args: cmd.args.iter().map(|a| a.to_string()).collect(),
            display_name: cmd.display_name.to_string(),
        })
        .collect()
}

/// Agent CLI allowlist — only these binaries may be checked for availability.
/// No arbitrary shell. No system commands. No user-supplied binaries.
const AGENT_CLI_ALLOWLIST: &[&str] = &["claude", "codex"];

#[derive(Serialize)]
pub struct CliAvailabilityResult {
    pub available: bool,
    pub path: Option<String>,
}

/// Check if an agent CLI binary (claude, codex) is available on PATH.
/// Only allowed binaries from AGENT_CLI_ALLOWLIST are accepted.
/// Does not launch or execute the binary.
#[tauri::command]
pub fn check_cli_available(binary: String) -> CliAvailabilityResult {
    let lower = binary.to_lowercase();

    // Strict allowlist check — reject anything not explicitly permitted
    if !AGENT_CLI_ALLOWLIST.contains(&lower.as_str()) {
        return CliAvailabilityResult {
            available: false,
            path: None,
        };
    }

    // Reject metacharacters (defensive — allowlist already covers this)
    if contains_metacharacters(&binary) {
        return CliAvailabilityResult {
            available: false,
            path: None,
        };
    }

    let check_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    let output = Command::new(check_cmd).arg(&binary).output();

    match output {
        Ok(out) if out.status.success() => {
            let path = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            CliAvailabilityResult {
                available: true,
                path: if path.is_empty() { None } else { Some(path) },
            }
        }
        _ => CliAvailabilityResult {
            available: false,
            path: None,
        },
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/// Config file for persisted workspace path.
/// Lives in %APPDATA%\com.aura.commandcenter\workspace.txt
fn get_persisted_workspace_path() -> Option<std::path::PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    let path = std::path::PathBuf::from(appdata)
        .join("com.aura.commandcenter")
        .join("workspace.txt");
    if path.exists() {
        let content = std::fs::read_to_string(&path).ok()?;
        let trimmed = content.trim().to_string();
        if !trimmed.is_empty() {
            let candidate = std::path::PathBuf::from(&trimmed);
            if candidate.join("package.json").exists() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Returns the AURA project root directory.
///
/// Resolution order (installed app aware):
///   1. Persisted workspace path from AppData config (user-set)
///   2. Well-known AURA repo location: %USERPROFILE%\Documents\AURA\agent-command-center
///   3. Current directory walk-up (finds package.json)
///   4. Executable directory walk-up (dev mode)
///   5. Current directory as last resort
fn get_project_root() -> String {
    // 1. User-persisted workspace path
    if let Some(p) = get_persisted_workspace_path() {
        return p.to_string_lossy().to_string();
    }

    // 2. Well-known default AURA repo location on this machine
    let known_paths = [
        "Documents\\AURA\\agent-command-center",
        "Documents\\aura\\agent-command-center",
        "AURA\\agent-command-center",
        "aura\\agent-command-center",
    ];
    if let Ok(home) = std::env::var("USERPROFILE") {
        for rel in &known_paths {
            let candidate = std::path::PathBuf::from(&home).join(rel);
            if candidate.join("package.json").exists() {
                return candidate.to_string_lossy().to_string();
            }
        }
    }

    // 3. Current directory walk-up
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("package.json").exists() {
            return cwd.to_string_lossy().to_string();
        }
        let mut dir = cwd.as_path().to_path_buf();
        for _ in 0..6 {
            if let Some(parent) = dir.parent() {
                dir = parent.to_path_buf();
                if dir.join("package.json").exists() {
                    return dir.to_string_lossy().to_string();
                }
            }
        }
    }

    // 4. Executable directory walk-up (dev mode)
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent().unwrap_or(exe.as_path()).to_path_buf();
        for _ in 0..8 {
            if dir.join("package.json").exists() {
                return dir.to_string_lossy().to_string();
            }
            if let Some(parent) = dir.parent() {
                dir = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    // 5. Last resort
    std::env::current_dir()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_else(|_| ".".to_string())
}

/// Returns the resolved workspace path and basic repo status.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatus {
    pub workspace_path: String,
    pub has_package_json: bool,
    pub has_git: bool,
    pub is_configured: bool,
}

/// Get the current resolved workspace path with status info.
#[tauri::command]
pub fn get_workspace_path() -> WorkspaceStatus {
    let path = get_project_root();
    let p = std::path::Path::new(&path);
    WorkspaceStatus {
        has_package_json: p.join("package.json").exists(),
        has_git: p.join(".git").exists(),
        is_configured: p.join("package.json").exists() && p.join(".git").exists(),
        workspace_path: path,
    }
}

/// Persist a custom workspace path to AppData config.
/// Safety: only accepts paths that contain package.json (must be a valid project root).
#[tauri::command]
pub fn set_workspace_path(path: String) -> Result<String, String> {
    // Reject shell metacharacters
    if contains_metacharacters(&path) {
        return Err("Invalid path: contains shell metacharacters".into());
    }

    let candidate = std::path::Path::new(&path);
    if !candidate.exists() {
        return Err(format!("Path does not exist: {path}"));
    }
    if !candidate.join("package.json").exists() {
        return Err(format!(
            "Not a valid project root (no package.json): {path}"
        ));
    }

    // Write to AppData config
    if let Ok(appdata) = std::env::var("APPDATA") {
        let config_dir = std::path::PathBuf::from(appdata).join("com.aura.commandcenter");
        std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        let config_file = config_dir.join("workspace.txt");
        std::fs::write(&config_file, &path).map_err(|e| e.to_string())?;
        return Ok(path);
    }

    Err("Could not access AppData directory".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allowed_command_success() {
        let result = run_allowed_command(
            "git".to_string(),
            vec!["status".to_string(), "--short".to_string()],
        );
        assert!(result.allowed, "git status --short should be allowed");
        assert_eq!(result.exit_code, 0, "git status --short should succeed");
        assert!(result.duration_ms > 0, "Duration should be recorded");
    }

    #[test]
    fn test_unknown_command_rejected() {
        let result = run_allowed_command("echo".to_string(), vec!["hello".to_string()]);
        assert!(!result.allowed, "Unknown command should be rejected");
        assert_eq!(
            result.error.unwrap(),
            "Rejected: command is not in the allowlist"
        );
    }

    #[test]
    fn test_blocked_executables() {
        let blocked = vec!["del", "rm", "Remove-Item", "curl"];
        for cmd in blocked {
            let result = run_allowed_command(cmd.to_string(), vec!["something".to_string()]);
            assert!(!result.allowed, "{} should be blocked", cmd);
            assert!(result
                .error
                .unwrap()
                .contains("this executable is not allowed"));
        }
    }

    #[test]
    fn test_git_reset_hard_rejected() {
        // 'git' is allowed but only for specific args.
        let result = run_allowed_command(
            "git".to_string(),
            vec!["reset".to_string(), "--hard".to_string()],
        );
        assert!(!result.allowed, "git reset --hard should be rejected");
        assert_eq!(
            result.error.unwrap(),
            "Rejected: command is not in the allowlist"
        );
    }

    #[test]
    fn test_metacharacters_rejected() {
        // Try to inject via an allowed command (though args wouldn't match anyway, metachar check comes first)
        let result = run_allowed_command(
            "git".to_string(),
            vec!["status".to_string(), ";".to_string(), "rm".to_string()],
        );
        assert!(!result.allowed, "Metacharacters should be rejected");
        assert!(result
            .error
            .unwrap()
            .contains("shell metacharacters detected"));
    }
}

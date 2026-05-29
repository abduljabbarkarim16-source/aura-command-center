/// AURA Native Command Bridge — Controlled execution layer
///
/// This module provides a strict allowlist-based command execution bridge.
/// Only pre-approved commands can run. All others are rejected.
///
/// Security invariants:
/// - Allowlist is hardcoded in Rust — frontend cannot modify it
/// - Shell metacharacters are rejected
/// - Blocked executables are rejected even if somehow matched
/// - No environment variable printing
/// - No command chaining
/// - stdout/stderr are captured and returned as structured data

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
];

/// Executables that are always rejected, even if an allowlist entry
/// were somehow misconfigured to include them.
const BLOCKED_EXECUTABLES: &[&str] = &[
    "rm", "del", "rmdir", "Remove-Item",
    "curl", "wget", "Invoke-WebRequest", "Invoke-RestMethod",
    "powershell", "pwsh", "cmd", "sh", "bash", "zsh",
    "npx", "node", "python", "python3", "pip", "pip3",
    "format", "diskpart", "reg", "regedit",
    "net", "netsh", "taskkill",
];

/// Characters that indicate shell metacharacter injection.
const SHELL_METACHARACTERS: &[char] = &['|', '&', ';', '$', '`', '>', '<', '(', ')', '{', '}'];

// ─── Result types ──────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct CommandResult {
    pub program: String,
    pub args: Vec<String>,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub allowed: bool,
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
    BLOCKED_EXECUTABLES.iter().any(|b| b.to_lowercase() == lower)
}

fn contains_metacharacters(s: &str) -> bool {
    s.chars().any(|c| SHELL_METACHARACTERS.contains(&c))
}

fn is_allowed_command(program: &str, args: &[String]) -> Option<&'static AllowedCommand> {
    ALLOWED_COMMANDS.iter().find(|cmd| {
        cmd.program.eq_ignore_ascii_case(program)
            && cmd.args.len() == args.len()
            && cmd.args.iter().zip(args.iter()).all(|(a, b)| *a == b.as_str())
    })
}

// ─── Tauri commands ────────────────────────────────────────────────────────────

/// Run a command from the strict allowlist.
/// Rejects anything not in the list, any blocked executable, and any metacharacters.
#[tauri::command]
pub fn run_allowed_command(program: String, args: Vec<String>) -> CommandResult {
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

    match output {
        Ok(output) => CommandResult {
            program,
            args,
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            duration_ms,
            allowed: true,
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
            error: Some(format!("Process error: {}", e)),
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
    let in_allowlist = ALLOWED_COMMANDS.iter().any(|cmd| {
        cmd.program.eq_ignore_ascii_case(&program)
    });

    if !in_allowlist {
        return CommandAvailability {
            program,
            available: false,
            path: None,
        };
    }

    // Use `where` on Windows, `which` on Unix
    let check_cmd = if cfg!(target_os = "windows") { "where" } else { "which" };

    let output = Command::new(check_cmd)
        .arg(&program)
        .output();

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

/// Returns the project root directory.
/// In Tauri, the executable lives in src-tauri/target/..., so we navigate up
/// to find the project root by looking for package.json.
fn get_project_root() -> String {
    // Try current directory first
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("package.json").exists() {
            return cwd.to_string_lossy().to_string();
        }
        // Walk up from current dir
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

    // Fallback: try the executable's directory and walk up
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

    // Last resort
    std::env::current_dir()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_else(|_| ".".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allowed_command_success() {
        let result = run_allowed_command("git".to_string(), vec!["status".to_string(), "--short".to_string()]);
        assert!(result.allowed, "git status --short should be allowed");
        assert_eq!(result.exit_code, 0, "git status --short should succeed");
        assert!(result.duration_ms > 0, "Duration should be recorded");
    }

    #[test]
    fn test_unknown_command_rejected() {
        let result = run_allowed_command("echo".to_string(), vec!["hello".to_string()]);
        assert!(!result.allowed, "Unknown command should be rejected");
        assert_eq!(result.error.unwrap(), "Rejected: command is not in the allowlist");
    }

    #[test]
    fn test_blocked_executables() {
        let blocked = vec!["del", "rm", "Remove-Item", "curl"];
        for cmd in blocked {
            let result = run_allowed_command(cmd.to_string(), vec!["something".to_string()]);
            assert!(!result.allowed, "{} should be blocked", cmd);
            assert!(result.error.unwrap().contains("this executable is not allowed"));
        }
    }

    #[test]
    fn test_git_reset_hard_rejected() {
        // 'git' is allowed but only for specific args.
        let result = run_allowed_command("git".to_string(), vec!["reset".to_string(), "--hard".to_string()]);
        assert!(!result.allowed, "git reset --hard should be rejected");
        assert_eq!(result.error.unwrap(), "Rejected: command is not in the allowlist");
    }

    #[test]
    fn test_metacharacters_rejected() {
        // Try to inject via an allowed command (though args wouldn't match anyway, metachar check comes first)
        let result = run_allowed_command("git".to_string(), vec!["status".to_string(), ";".to_string(), "rm".to_string()]);
        assert!(!result.allowed, "Metacharacters should be rejected");
        assert!(result.error.unwrap().contains("shell metacharacters detected"));
    }
}

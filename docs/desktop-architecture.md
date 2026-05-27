# Tauri Desktop Architecture (Phase 2 & Beyond)

AURA Command Center is migrating to a Tauri desktop shell to provide powerful native capabilities that a browser simply cannot handle securely or efficiently.

## Future Desktop Responsibilities

> [!NOTE]
> The following capabilities are planned for future phases. In Phase 2A, these are currently unimplemented or mocked.

### Native File Picker & Workspace Folder Permissions
The Tauri shell will use its Rust backend to open native dialogs, allowing users to securely grant access to specific local directories. The backend will enforce a capability boundary so agents cannot traverse outside granted scopes.

### Secure Credential Storage
API keys (OpenAI, Anthropic, Gemini, etc.) will no longer be stored in plaintext browser local storage. The Tauri backend will leverage the native OS credential manager (Keychain, Credential Guard, etc.) for secure token storage.

### Local MCP Process Manager
AURA will run Model Context Protocol (MCP) servers locally as child processes managed by the Rust backend, ensuring they are spawned, communicated with via stdin/stdout, and cleanly terminated.

### Command Runner Approval Bridge
While the React frontend displays the `CommandApprovalQueue`, the execution of the actual shell commands (e.g., `npm install`, `git status`) will happen entirely on the Rust backend via `std::process::Command`, piping stdout/stderr safely back to the frontend.

### Native Audio Permissions
Instead of using the standard Web Audio API (which suffers from browser restrictions and tab-sleep limitations), the desktop shell will utilize native audio APIs for flawless, background-capable voice interaction and speech-to-text streams.

### Localhost Preview Launcher
The backend will manage local dev servers directly, tracking their process IDs (PIDs) so they can be reliably killed and restarted without leaving zombie node processes running on the machine.

### Git Worktree Manager
Git operations (branching, creating isolated worktrees for agents to work in) will be orchestrated securely by the backend to prevent repository corruption and to strictly contain agent experiments.

### System Tray
The application will integrate into the system tray, allowing long-running agent tasks (like background refactoring or test generation) to continue even when the main window is closed.

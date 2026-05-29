# AURA Workspace Controller Architecture

**Milestone:** B  
**Branch:** `selfbuild-workspace-controller`

## Purpose

The WorkspaceControllerService gives AURA structured self-awareness of the workspaces/projects it manages. This is the first layer of the self-build foundation — before AURA can improve itself, it must understand its own project structure.

## Components

### `src/types/workspace-controller.ts`
Core types: `WorkspaceRecord`, `WorkspaceHealth`, `WorkspaceGitState`, `WorkspaceFileSummary`, `WorkspacePackageInfo`, `WorkspaceValidationCommand`, `WorkspaceScanResult`, `WorkspaceCommandPolicy`.

### `src/services/workspace/WorkspaceControllerService.ts`
Singleton service. Pre-registers the AURA workspace. Methods:
- `registerWorkspace()` — add a workspace record
- `listWorkspaces()` / `getWorkspace()` — enumerate
- `setActiveWorkspace()` / `getActiveWorkspace()` — tracking
- `scanWorkspace()` — returns `WorkspaceScanResult` (health, git state, file summary, package info, validation commands)
- `getGitState()` — git state (mock; real Tauri bridge needed)
- `getPackageInfo()` — npm/cargo package metadata
- `getValidationCommands()` — lint/build/test commands with risk classification
- `getWorkspaceHealth()` — check results for TypeScript, Tauri, git, env
- `exportWorkspaceReport()` — full JSON export

### `src/hooks/useWorkspaceController.ts`
React hook. Subscribes to service changes. Exposes `workspaces`, `activeWorkspace`, `lastScan`, `isScanning`, `scan()`, `setActive()`.

### UI
Workspace card in `AdminPanelOverlay`: active workspace name, git branch, project type, health check grid, scan button.

## Native Bridge Needs (Phase 2H+)

Real filesystem + git access requires Tauri `invoke()` commands:

```rust
// src-tauri/src/main.rs additions needed:
#[tauri::command]
fn read_file(path: String) -> Result<String, String> { ... }

#[tauri::command]
fn run_command(cmd: String, args: Vec<String>) -> Result<String, String> { ... }

#[tauri::command]
fn git_status(workspace: String) -> Result<String, String> { ... }
```

Until these are implemented, the service returns structured mock data reflecting known AURA repo state.

## Data Flow

```
WorkspaceControllerService (singleton)
  ├── Pre-registers AURA workspace on construction
  ├── scanWorkspace() → WorkspaceScanResult (mock data)
  └── listeners → notify React subscribers

useWorkspaceController() hook
  ├── Subscribes to service changes
  └── Exposes scan() action + snapshot fields

AdminPanelOverlay
  └── Renders workspace health card with scan button
```

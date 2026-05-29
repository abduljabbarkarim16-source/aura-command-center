/**
 * AURA Native Command Types — Native Execution Bridge
 *
 * Type definitions for the Tauri ↔ Frontend command execution bridge.
 * These types mirror the Rust-side structs in src-tauri/src/commands.rs.
 *
 * No secrets, no environment variable values, no arbitrary shell access.
 */

// ─── Command result (mirrors Rust CommandResult) ──────────────────────────────

export interface NativeCommandResult {
  /** The program that was executed */
  program: string;
  /** Arguments passed to the program */
  args: string[];
  /** Process exit code (-1 if process failed to start) */
  exit_code: number;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Execution duration in milliseconds */
  duration_ms: number;
  /** Whether the command was in the allowlist */
  allowed: boolean;
  /** Error message if command was rejected or process failed */
  error: string | null;
}

// ─── Workspace info (mirrors Rust WorkspaceInfo) ──────────────────────────────

export interface NativeWorkspaceInfo {
  cwd: string;
  os: string;
  arch: string;
  tauri_version: string;
  app_version: string;
}

// ─── Command availability (mirrors Rust CommandAvailability) ──────────────────

export interface NativeCommandAvailability {
  program: string;
  available: boolean;
  path: string | null;
}

// ─── Allowed command entry (mirrors Rust AllowedCommandEntry) ─────────────────

export interface NativeAllowedCommandEntry {
  program: string;
  args: string[];
  display_name: string;
}

// ─── Bridge status ────────────────────────────────────────────────────────────

export type NativeBridgeStatus = 'available' | 'unavailable' | 'checking';

// ─── Command execution request (frontend-side) ───────────────────────────────

export interface NativeCommandRequest {
  program: string;
  args: string[];
  /** Proposal ID if this execution was triggered from CommandProposalService */
  proposalId?: string;
}

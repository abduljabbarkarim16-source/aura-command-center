/**
 * NativeCommandService — AURA Native Execution Bridge
 *
 * Frontend service that communicates with the Tauri/Rust command bridge
 * via `invoke()`. All commands are validated against a hardcoded Rust-side
 * allowlist before execution.
 *
 * Web fallback: If not running inside Tauri (e.g., `npm run dev`),
 * all methods return safe "native unavailable" results. No crashes.
 *
 * Security:
 * - No arbitrary shell execution
 * - No environment variable printing
 * - No command chaining
 * - No secrets in results
 */

import type {
  NativeCommandResult,
  NativeWorkspaceInfo,
  NativeCommandAvailability,
  NativeAllowedCommandEntry,
  NativeBridgeStatus,
} from '../../types/native-command';

// ─── Tauri detection ──────────────────────────────────────────────────────────

/**
 * Checks if we are running inside a Tauri webview.
 * Tauri v2 injects `window.__TAURI_INTERNALS__` at startup.
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window;
}

/**
 * Dynamically imports the Tauri invoke function.
 * Returns null if not in Tauri environment.
 */
async function getTauriInvoke(): Promise<((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

// ─── Unavailable results ──────────────────────────────────────────────────────

function unavailableResult(program: string, args: string[]): NativeCommandResult {
  return {
    program,
    args,
    exitCode: -1,
    stdout: '',
    stderr: '',
    durationMs: 0,
    allowed: false,
    error: 'Native bridge unavailable — not running in Tauri desktop mode',
  };
}

function unavailableWorkspaceInfo(): NativeWorkspaceInfo {
  return {
    cwd: '(web mode)',
    os: navigator.platform || 'unknown',
    arch: 'unknown',
    tauri_version: 'N/A',
    app_version: 'N/A',
  };
}

// ─── Known allowlist (mirrors Rust side for display purposes) ─────────────────

const KNOWN_ALLOWED_COMMANDS: NativeAllowedCommandEntry[] = [
  { program: 'npm', args: ['run', 'lint'], display_name: 'TypeScript lint check' },
  { program: 'npm', args: ['run', 'build'], display_name: 'Vite production build' },
  { program: 'npm', args: ['run', 'tauri:build'], display_name: 'Tauri production build' },
  { program: 'cargo', args: ['test'], display_name: 'Rust unit tests' },
  { program: 'git', args: ['status', '--short'], display_name: 'Git status (short)' },
  { program: 'git', args: ['branch', '--show-current'], display_name: 'Show current branch' },
  { program: 'git', args: ['log', '--oneline', '-20'], display_name: 'Git log (last 20)' },
];

// ─── Service ──────────────────────────────────────────────────────────────────

type BridgeListener = (status: NativeBridgeStatus) => void;

class NativeCommandService {
  private _status: NativeBridgeStatus = 'checking';
  private _checkedOnce = false;
  private listeners = new Set<BridgeListener>();

  // ── Status ──────────────────────────────────────────────────────────────

  /** Returns cached bridge status. Call validateNativeBridge() to refresh. */
  isNativeAvailable(): boolean {
    return this._status === 'available';
  }

  getBridgeStatus(): NativeBridgeStatus {
    return this._status;
  }

  subscribe(fn: BridgeListener): () => void {
    this.listeners.add(fn);
    fn(this._status);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn(this._status);
  }

  // ── Bridge validation ───────────────────────────────────────────────────

  /**
   * Probes the Tauri bridge by calling get_workspace_info.
   * Updates cached status. Safe to call multiple times.
   */
  async validateNativeBridge(): Promise<NativeBridgeStatus> {
    if (this._checkedOnce) return this._status;

    this._status = 'checking';
    this.notify();

    try {
      const invoke = await getTauriInvoke();
      if (!invoke) {
        this._status = 'unavailable';
        this._checkedOnce = true;
        this.notify();
        return this._status;
      }

      // Probe with a lightweight command
      await invoke('get_workspace_info');
      this._status = 'available';
    } catch {
      this._status = 'unavailable';
    }

    this._checkedOnce = true;
    this.notify();
    return this._status;
  }

  // ── Command execution ───────────────────────────────────────────────────

  /**
   * Run an allowlisted command through the Tauri native bridge.
   * Returns structured result with stdout/stderr/exitCode/duration.
   */
  async runAllowedCommand(program: string, args: string[]): Promise<NativeCommandResult> {
    const invoke = await getTauriInvoke();
    if (!invoke) return unavailableResult(program, args);

    try {
      const result = await invoke('run_allowed_command', { program, args });
      return normalizeCommandResult(result, program, args);
    } catch (e) {
      return {
        program,
        args,
        exitCode: -1,
        stdout: '',
        stderr: '',
        durationMs: 0,
        allowed: false,
        error: `Invoke error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // ── Command availability ────────────────────────────────────────────────

  /**
   * Check if a program is available on the system PATH.
   * Only works for programs in the allowlist.
   */
  async checkCommandAvailable(program: string): Promise<NativeCommandAvailability> {
    const invoke = await getTauriInvoke();
    if (!invoke) {
      return { program, available: false, path: null };
    }

    try {
      const result = await invoke('check_command_available', { program });
      return result as NativeCommandAvailability;
    } catch {
      return { program, available: false, path: null };
    }
  }

  // ── Workspace info ──────────────────────────────────────────────────────

  /**
   * Get workspace information from the Tauri native side.
   */
  async getWorkspaceInfo(): Promise<NativeWorkspaceInfo> {
    const invoke = await getTauriInvoke();
    if (!invoke) return unavailableWorkspaceInfo();

    try {
      const result = await invoke('get_workspace_info');
      return result as NativeWorkspaceInfo;
    } catch {
      return unavailableWorkspaceInfo();
    }
  }

  // ── Allowlist query ─────────────────────────────────────────────────────

  /**
   * Returns the known allowlist. In Tauri mode, fetches from Rust.
   * In web mode, returns the hardcoded mirror.
   */
  async listAllowedCommands(): Promise<NativeAllowedCommandEntry[]> {
    const invoke = await getTauriInvoke();
    if (!invoke) return [...KNOWN_ALLOWED_COMMANDS];

    try {
      const result = await invoke('list_allowed_commands');
      return result as NativeAllowedCommandEntry[];
    } catch {
      return [...KNOWN_ALLOWED_COMMANDS];
    }
  }

  /**
   * Check if a (program, args) pair is in the known allowlist.
   * This is a fast local check — no IPC call.
   */
  isCommandAllowed(program: string, args: string[]): boolean {
    return KNOWN_ALLOWED_COMMANDS.some(
      cmd => cmd.program === program &&
        cmd.args.length === args.length &&
        cmd.args.every((a, i) => a === args[i]),
    );
  }
}

export const nativeCommandService = new NativeCommandService();

function normalizeCommandResult(raw: unknown, fallbackProgram: string, fallbackArgs: string[]): NativeCommandResult {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const exitCode = value.exitCode ?? value.exit_code ?? -1;
  const durationMs = value.durationMs ?? value.duration_ms ?? 0;

  return {
    program: typeof value.program === 'string' ? value.program : fallbackProgram,
    args: Array.isArray(value.args) ? value.args.map(String) : fallbackArgs,
    exitCode: typeof exitCode === 'number' ? exitCode : Number(exitCode) || -1,
    stdout: typeof value.stdout === 'string' ? value.stdout : '',
    stderr: typeof value.stderr === 'string' ? value.stderr : '',
    durationMs: typeof durationMs === 'number' ? durationMs : Number(durationMs) || 0,
    allowed: Boolean(value.allowed),
    cwd: typeof value.cwd === 'string' ? value.cwd : undefined,
    error: typeof value.error === 'string' ? value.error : null,
  };
}

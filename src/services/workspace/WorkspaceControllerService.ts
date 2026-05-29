/**
 * WorkspaceControllerService — AURA Milestone B
 *
 * Gives AURA structured self-awareness of the workspaces/projects it manages.
 * All operations are currently read-only / mock-based.
 *
 * Real Tauri native bridge (tauri::command) needed for:
 * - Actual filesystem reads (fs::read_dir, fs::read_to_string)
 * - Real git command output (git status, git log, git branch)
 * - Process execution (npm run lint output capture)
 *
 * Until that bridge is built, this service returns structured mock data
 * that reflects the known AURA repo layout and state.
 *
 * Persistence: workspaces are stored via SettingsService (localStorage).
 */

import type {
  WorkspaceRecord,
  WorkspaceStatus,
  WorkspaceHealth,
  WorkspaceGitState,
  WorkspaceFileSummary,
  WorkspacePackageInfo,
  WorkspaceValidationCommand,
  WorkspaceScanResult,
  WorkspaceCommandPolicy,
} from '../../types/workspace-controller';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── AURA repo defaults ───────────────────────────────────────────────────────
// Known facts about the AURA Command Center workspace.

const AURA_WORKSPACE_ID = 'ws-aura-command-center';

const AURA_VALIDATION_COMMANDS: WorkspaceValidationCommand[] = [
  {
    id: 'cmd-lint',
    label: 'TypeScript check',
    command: 'npm run lint',
    riskLevel: 'safe',
    requiresApproval: false,
    description: 'Run tsc --noEmit to check for type errors.',
  },
  {
    id: 'cmd-build',
    label: 'Vite build',
    command: 'npm run build',
    riskLevel: 'moderate',
    requiresApproval: true,
    description: 'Bundle frontend assets to dist/ folder.',
  },
  {
    id: 'cmd-tauri-dev',
    label: 'Tauri dev launch',
    command: 'npm run tauri:dev',
    riskLevel: 'moderate',
    requiresApproval: true,
    description: 'Launch Vite dev server + Tauri desktop window.',
  },
  {
    id: 'cmd-tauri-build',
    label: 'Tauri production build',
    command: 'npm run tauri:build',
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Compile Rust + bundle frontend. Produces NSIS/MSI installer.',
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

class WorkspaceControllerService {
  private workspaces: WorkspaceRecord[] = [];
  private scans: Map<string, WorkspaceScanResult> = new Map();
  private activeWorkspaceId: string | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    // Pre-register the known AURA workspace
    this.workspaces = [this.buildAuraWorkspaceRecord()];
    this.activeWorkspaceId = AURA_WORKSPACE_ID;
  }

  // ── Change notification ───────────────────────────────────────────────────

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  // ── Workspace CRUD ────────────────────────────────────────────────────────

  registerWorkspace(data: Omit<WorkspaceRecord, 'id' | 'registeredAt' | 'lastScannedAt'>): WorkspaceRecord {
    const record: WorkspaceRecord = {
      ...data,
      id: uid(),
      registeredAt: now(),
      lastScannedAt: null,
    };
    this.workspaces.push(record);
    this.notify();
    return record;
  }

  listWorkspaces(): WorkspaceRecord[] {
    return [...this.workspaces];
  }

  getWorkspace(id: string): WorkspaceRecord | null {
    return this.workspaces.find(w => w.id === id) ?? null;
  }

  setActiveWorkspace(id: string): void {
    if (!this.workspaces.find(w => w.id === id)) return;
    this.activeWorkspaceId = id;
    this.notify();
  }

  getActiveWorkspace(): WorkspaceRecord | null {
    if (!this.activeWorkspaceId) return null;
    return this.getWorkspace(this.activeWorkspaceId);
  }

  // ── Scan ─────────────────────────────────────────────────────────────────

  /**
   * Scans a workspace and returns a structured summary.
   * Currently returns mock/known data for the AURA workspace.
   * Real implementation needs Tauri FS + git commands.
   */
  async scanWorkspace(id: string): Promise<WorkspaceScanResult> {
    const ws = this.getWorkspace(id);
    if (!ws) throw new Error(`Workspace ${id} not found`);

    // Update scan timestamp
    this.workspaces = this.workspaces.map(w =>
      w.id === id ? { ...w, lastScannedAt: now(), status: 'active' as WorkspaceStatus } : w,
    );

    const result: WorkspaceScanResult = {
      workspaceId: id,
      scannedAt: now(),
      health: this.buildHealth(id),
      gitState: this.getGitState(id),
      fileSummary: this.buildFileSummary(id),
      packageInfo: this.getPackageInfo(id),
      validationCommands: id === AURA_WORKSPACE_ID ? AURA_VALIDATION_COMMANDS : [],
    };

    this.scans.set(id, result);
    this.notify();
    return result;
  }

  getLastScan(id: string): WorkspaceScanResult | null {
    return this.scans.get(id) ?? null;
  }

  // ── Read-only data builders ───────────────────────────────────────────────

  getGitState(workspaceId: string): WorkspaceGitState {
    if (workspaceId === AURA_WORKSPACE_ID) {
      return {
        workspaceId,
        currentBranch: 'main',
        isClean: true,
        hasUnpushedCommits: false,
        remoteName: 'origin',
        remoteUrl: 'https://github.com/abduljabbarkarim16-source/aura-command-center.git',
        lastCommitHash: '799109d',
        lastCommitMessage: 'Merge Phase 2G: runtime wiring audit and provider foundation',
        lastCommitTimestamp: now(),
        source: 'mock',
      };
    }
    return {
      workspaceId,
      currentBranch: 'unknown',
      isClean: true,
      hasUnpushedCommits: false,
      remoteName: 'origin',
      remoteUrl: '',
      lastCommitHash: '',
      lastCommitMessage: '',
      lastCommitTimestamp: '',
      source: 'mock',
    };
  }

  getPackageInfo(workspaceId: string): WorkspacePackageInfo | null {
    if (workspaceId === AURA_WORKSPACE_ID) {
      return {
        workspaceId,
        name: 'aura-command-center',
        version: '0.0.0',
        scripts: {
          dev: 'vite --port=3000 --host=0.0.0.0',
          build: 'vite build',
          lint: 'tsc --noEmit',
          'tauri:dev': 'tauri dev',
          'tauri:build': 'tauri build',
        },
        dependencies: ['react', 'react-dom', 'react-router-dom', 'lucide-react', 'tailwind-merge', 'clsx'],
        devDependencies: ['typescript', 'vite', '@vitejs/plugin-react', 'tailwindcss', '@tauri-apps/cli'],
        hasTypeScript: true,
        hasTauri: true,
        hasReact: true,
        hasVite: true,
      };
    }
    return null;
  }

  detectProjectType(workspaceId: string): string {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) return 'unknown';
    return ws.projectType;
  }

  getValidationCommands(workspaceId: string): WorkspaceValidationCommand[] {
    if (workspaceId === AURA_WORKSPACE_ID) return AURA_VALIDATION_COMMANDS;
    return [];
  }

  getWorkspaceHealth(workspaceId: string): WorkspaceHealth {
    return this.buildHealth(workspaceId);
  }

  getCommandPolicy(workspaceId: string): WorkspaceCommandPolicy {
    return {
      workspaceId,
      allowedCommands: ['npm run lint', 'npm run build', 'git status', 'git log', 'git branch'],
      blockedPatterns: ['rm -rf', 'del /f', 'format', '--force', 'DROP TABLE', 'eval('],
      requireApprovalForBuild: true,
      requireApprovalForInstall: true,
      requireApprovalForGitPush: true,
      requireApprovalForFileWrite: true,
      maxRiskLevel: 'high',
    };
  }

  exportWorkspaceReport(workspaceId: string): Record<string, unknown> {
    const scan = this.getLastScan(workspaceId);
    const ws = this.getWorkspace(workspaceId);
    return {
      workspace: ws,
      lastScan: scan,
      policy: this.getCommandPolicy(workspaceId),
      exportedAt: now(),
    };
  }

  // ── Private builders ──────────────────────────────────────────────────────

  private buildAuraWorkspaceRecord(): WorkspaceRecord {
    return {
      id: AURA_WORKSPACE_ID,
      name: 'AURA Command Center',
      path: 'C:\\Users\\karim\\Documents\\AURA\\agent-command-center',
      projectType: 'tauri-react',
      status: 'active',
      isActive: true,
      packageManager: 'npm',
      registeredAt: now(),
      lastScannedAt: null,
      tags: ['tauri', 'react', 'typescript', 'vite', 'self-build'],
      notes: 'Primary AURA workspace. Tauri 2 desktop app with React 19 frontend.',
    };
  }

  private buildHealth(workspaceId: string): WorkspaceHealth {
    const isAura = workspaceId === AURA_WORKSPACE_ID;
    return {
      workspaceId,
      overall: 'healthy',
      checks: [
        { id: 'ts', label: 'TypeScript config', ok: isAura, note: isAura ? 'tsconfig.json present' : 'Not checked' },
        { id: 'pkg', label: 'package.json', ok: isAura, note: isAura ? 'npm scripts defined' : 'Not checked' },
        { id: 'tauri', label: 'Tauri config', ok: isAura, note: isAura ? 'tauri.conf.json present' : 'N/A' },
        { id: 'git', label: 'Git repo', ok: isAura, note: isAura ? 'main branch, clean' : 'Not checked' },
        { id: 'env', label: '.env.example', ok: isAura, note: isAura ? 'Provider keys documented' : 'Not checked' },
      ],
      scannedAt: now(),
    };
  }

  private buildFileSummary(workspaceId: string): WorkspaceFileSummary {
    const isAura = workspaceId === AURA_WORKSPACE_ID;
    return {
      workspaceId,
      rootPath: isAura ? 'C:\\Users\\karim\\Documents\\AURA\\agent-command-center' : '',
      keyFiles: isAura ? [
        { path: 'src/App.tsx', exists: true, role: 'Router shell' },
        { path: 'src/main.tsx', exists: true, role: 'React entry' },
        { path: 'src-tauri/tauri.conf.json', exists: true, role: 'Tauri config' },
        { path: '.env.example', exists: true, role: 'Provider key names' },
        { path: 'package.json', exists: true, role: 'npm config' },
      ] : [],
      tsFileCount: isAura ? 42 : 0,
      componentCount: isAura ? 28 : 0,
      serviceCount: isAura ? 12 : 0,
      hookCount: isAura ? 7 : 0,
      typeCount: isAura ? 14 : 0,
      testFileCount: 0,
      docFileCount: isAura ? 7 : 0,
      totalEstimatedFiles: isAura ? 65 : 0,
    };
  }
}

export const workspaceController = new WorkspaceControllerService();
export const AURA_WORKSPACE_ID_CONST = 'ws-aura-command-center';

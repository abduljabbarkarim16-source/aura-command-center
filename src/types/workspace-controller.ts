/**
 * AURA Workspace Controller Types — Milestone B
 *
 * Structured understanding of workspaces/projects/repos for
 * the self-build orchestration layer.
 *
 * All operations are read-only or mock at this stage.
 * Real Tauri FS commands are noted but not invoked yet.
 */

// ─── Workspace status ─────────────────────────────────────────────────────────

export type WorkspaceStatus =
  | 'active'       // Currently in use
  | 'idle'         // Registered but not active
  | 'scanning'     // Health scan in progress
  | 'degraded'     // Missing files, failed checks
  | 'archived';    // No longer in use

export type WorkspaceRiskLevel = 'safe' | 'moderate' | 'high' | 'critical';

export type WorkspaceProjectType =
  | 'tauri-react'      // Tauri 2 + React + Vite
  | 'react-vite'       // React + Vite SPA
  | 'nextjs'           // Next.js
  | 'node-server'      // Node.js backend
  | 'rust-cargo'       // Pure Rust
  | 'python'           // Python project
  | 'static-web'       // Static HTML/CSS
  | 'unknown';

// ─── Workspace records ────────────────────────────────────────────────────────

export interface WorkspaceRecord {
  id: string;
  name: string;
  path: string;          // Absolute path on disk
  projectType: WorkspaceProjectType;
  status: WorkspaceStatus;
  isActive: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'cargo' | 'pip' | 'none';
  registeredAt: string;  // ISO timestamp
  lastScannedAt: string | null;
  tags: string[];
  notes: string;
}

// ─── Workspace health ─────────────────────────────────────────────────────────

export interface WorkspaceHealthCheck {
  id: string;
  label: string;
  ok: boolean;
  note?: string;
}

export interface WorkspaceHealth {
  workspaceId: string;
  overall: 'healthy' | 'degraded' | 'critical';
  checks: WorkspaceHealthCheck[];
  scannedAt: string;
}

// ─── Git state ────────────────────────────────────────────────────────────────

export interface WorkspaceGitState {
  workspaceId: string;
  currentBranch: string;
  isClean: boolean;            // No uncommitted changes
  hasUnpushedCommits: boolean;
  remoteName: string;
  remoteUrl: string;
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitTimestamp: string;
  /** Source: read from git via Tauri command or mock */
  source: 'tauri-native' | 'mock';
}

// ─── File summary ─────────────────────────────────────────────────────────────

export interface WorkspaceFileSummary {
  workspaceId: string;
  rootPath: string;
  keyFiles: { path: string; exists: boolean; role: string }[];
  tsFileCount: number;
  componentCount: number;
  serviceCount: number;
  hookCount: number;
  typeCount: number;
  testFileCount: number;
  docFileCount: number;
  totalEstimatedFiles: number;
}

// ─── Package info ─────────────────────────────────────────────────────────────

export interface WorkspacePackageInfo {
  workspaceId: string;
  name: string;
  version: string;
  scripts: Record<string, string>;
  dependencies: string[];   // Names only, no versions — safe to surface
  devDependencies: string[];
  hasTypeScript: boolean;
  hasTauri: boolean;
  hasReact: boolean;
  hasVite: boolean;
}

// ─── Validation commands ──────────────────────────────────────────────────────

export interface WorkspaceValidationCommand {
  id: string;
  label: string;
  command: string;
  riskLevel: WorkspaceRiskLevel;
  requiresApproval: boolean;
  description: string;
}

// ─── Scan result ─────────────────────────────────────────────────────────────

export interface WorkspaceScanResult {
  workspaceId: string;
  scannedAt: string;
  health: WorkspaceHealth;
  gitState: WorkspaceGitState;
  fileSummary: WorkspaceFileSummary;
  packageInfo: WorkspacePackageInfo | null;
  validationCommands: WorkspaceValidationCommand[];
}

// ─── Command policy ──────────────────────────────────────────────────────────

export interface WorkspaceCommandPolicy {
  workspaceId: string;
  allowedCommands: string[];
  blockedPatterns: string[];
  requireApprovalForBuild: boolean;
  requireApprovalForInstall: boolean;
  requireApprovalForGitPush: boolean;
  requireApprovalForFileWrite: boolean;
  maxRiskLevel: WorkspaceRiskLevel;
}

export type RunnerStatus = 'not_configured' | 'ready' | 'starting' | 'running' | 'failed' | 'stopped';

export interface WorkspaceRunner {
  id: string;
  projectId: string;
  workspaceRoot: string;
  activeBranchPlaceholder: string;
  activeDevServer: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'cargo' | 'pip';
  framework: string;
  installCommand: string;
  devCommand: string;
  buildCommand: string;
  testCommand: string;
  previewUrl: string;
  status: RunnerStatus;
  lastRunTime: string | null;
  terminalLogs: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confirmationRequired: boolean;
}

export type DangerousActionType = 
  | 'file_delete'
  | 'file_overwrite'
  | 'terminal_execute'
  | 'package_install'
  | 'git_push'
  | 'git_reset'
  | 'external_network'
  | 'credential_access'
  | 'delete_workspace';

export interface WorkspaceSafetyConfig {
  workspaceId: string;
  allowedFileScope: string[];
  blockedPaths: string[];
  destructiveCommandsLocked: boolean;
  externalNetworkAllowed: boolean;
  packageInstallsRequireApproval: boolean;
  gitPushRequiresApproval: boolean;
  deleteOperationsRequireApproval: boolean;
}

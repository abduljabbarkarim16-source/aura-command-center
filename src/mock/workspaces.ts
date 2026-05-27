import { WorkspaceRunner, WorkspaceSafetyConfig } from '../types/workspace';

export const mockWorkspaceRunner: WorkspaceRunner = {
  id: 'ws-1',
  projectId: 'proj-1',
  workspaceRoot: '/User/dev/agent-command-center',
  activeBranchPlaceholder: 'feature/aura-workspace',
  activeDevServer: 'Vite',
  packageManager: 'npm',
  framework: 'React',
  installCommand: 'npm install',
  devCommand: 'npm run dev',
  buildCommand: 'npm run build',
  testCommand: 'npm test',
  previewUrl: 'http://localhost:5173',
  status: 'running',
  lastRunTime: new Date().toISOString(),
  terminalLogs: [
    '> agent-command-center@0.0.0 dev',
    '> vite',
    '',
    '  VITE v6.2.3  ready in 345 ms',
    '',
    '  ➜  Local:   http://localhost:5173/',
    '  ➜  Network: use --host to expose'
  ],
  riskLevel: 'low',
  confirmationRequired: false
};

export const mockSafetyConfig: WorkspaceSafetyConfig = {
  workspaceId: 'ws-1',
  allowedFileScope: ['/src', '/public', 'package.json', 'vite.config.ts'],
  blockedPaths: ['.env', '.git', 'node_modules'],
  destructiveCommandsLocked: true,
  externalNetworkAllowed: false,
  packageInstallsRequireApproval: true,
  gitPushRequiresApproval: true,
  deleteOperationsRequireApproval: true
};

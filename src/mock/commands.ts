import { QueuedCommand } from '../types/commands';

export const mockCommands: QueuedCommand[] = [
  {
    id: 'cmd-1',
    requestedByAgentId: 'agent-codex',
    projectId: 'proj-1',
    workspaceId: 'ws-1',
    command: 'npm',
    args: ['install', 'lucide-react'],
    workingDirectory: '/User/dev/aura-command-center',
    reason: 'Need to add lucide-react for the new sidebar icons.',
    riskLevel: 'low',
    requiresApproval: true,
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cmd-2',
    requestedByAgentId: 'agent-codex',
    projectId: 'proj-1',
    workspaceId: 'ws-1',
    command: 'rm',
    args: ['-rf', 'dist'],
    workingDirectory: '/User/dev/aura-command-center',
    reason: 'Clearing build cache before next build step.',
    riskLevel: 'high',
    requiresApproval: true,
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'cmd-3',
    requestedByAgentId: 'agent-claude',
    projectId: 'proj-1',
    workspaceId: 'ws-1',
    command: 'git',
    args: ['status'],
    workingDirectory: '/User/dev/aura-command-center',
    reason: 'Checking which files were modified by the recent agent task.',
    riskLevel: 'low',
    requiresApproval: false,
    status: 'executed',
    createdAt: new Date(Date.now() - 60000).toISOString()
  }
];

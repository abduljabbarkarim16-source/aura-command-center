import { GitWorkspace } from '../types/git';

export const mockGitWorkspace: GitWorkspace = {
  id: 'git-1',
  workspaceId: 'ws-1',
  currentRepository: 'owner/agent-command-center',
  currentBranch: 'main',
  suggestedWorkingBranch: 'aura-agent-worktree-1',
  worktreePath: '/User/dev/agent-command-center/.worktrees/aura-agent-worktree-1',
  uncommittedChangesCount: 3,
  changedFiles: ['src/App.tsx', 'src/components/Sidebar.tsx', 'package.json'],
  lastCommit: 'a1b2c3d - Initial project scaffold',
  proposedCommitMessage: 'feat: apply workspace safety and preview panels'
};

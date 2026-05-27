export interface GitWorkspace {
  id: string;
  workspaceId: string;
  currentRepository: string;
  currentBranch: string;
  suggestedWorkingBranch: string;
  worktreePath: string;
  uncommittedChangesCount: number;
  changedFiles: string[];
  lastCommit: string;
  proposedCommitMessage: string;
}

export type CommandStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'logged';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface QueuedCommand {
  id: string;
  requestedByAgentId: string;
  projectId: string;
  workspaceId: string;
  command: string;
  args: string[];
  workingDirectory: string;
  reason: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  status: CommandStatus;
  createdAt: string;
}

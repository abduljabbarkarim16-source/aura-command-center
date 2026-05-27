export * from './agents';
export * from './voice';
export * from './usage';
export * from './runtime';


export interface Project {
  id: string;
  name: string;
  localPath: string;
  githubRepo?: string;
  activeAgentId: string;
  memoryFolder: string;
  summary: string;
  environmentNotes: string;
}

export type MemoryCategory =
  | 'decision'
  | 'error'
  | 'fix'
  | 'task'
  | 'handoff'
  | 'tool_log';

export interface MemoryEntry {
  id: string;
  timestamp: string;
  projectId: string;
  agentName: string;
  category: MemoryCategory;
  title: string;
  summary: string;
  details: string;
  relatedFiles: string[];
  tags: string[];
  status: 'active' | 'resolved' | 'archived';
}

export interface Handoff {
  id: string;
  timestamp: string;
  projectId: string;
  fromAgentId: string;
  toAgentId?: string;
  goal: string;
  completedTasks: string[];
  failedTasks: string[];
  filesChanged: string[];
  filesToReview: string[];
  nextRecommendedAction: string;
  warnings: string[];
}

export interface McpConnector {
  id: string;
  name: string;
  type: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  allowedAgents: string[];
  status: 'connected' | 'disconnected' | 'error';
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  agentId?: string;
  toolCalls?: Array<{
    name: string;
    args: string;
    result?: string;
    status: 'pending' | 'success' | 'error';
  }>;
}

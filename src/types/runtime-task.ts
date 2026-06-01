export type RuntimeTaskType = 
  | 'terminal'
  | 'cli'
  | 'memory'
  | 'capability'
  | 'notification'
  | 'recipe'
  | 'agent'
  | 'validation'
  | 'make'
  | 'voice'
  | 'research'
  | 'visual'
  | 'system';

export type RuntimeTaskSource = 'voice' | 'console' | 'scheduled' | 'agent' | 'system';
export type RuntimeTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';
export type RuntimeTaskRisk = 'low' | 'medium' | 'high' | 'critical';

export interface RuntimeTaskLogLine {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface RuntimeTask {
  id: string;
  title: string;
  type: RuntimeTaskType;
  source: RuntimeTaskSource;
  status: RuntimeTaskStatus;
  risk: RuntimeTaskRisk;
  
  // Optional links to other domains
  toolId?: string;
  toolName?: string;
  intent?: string;
  args?: Record<string, any>;
  agentId?: string;
  
  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  elapsedMs?: number;
  
  // Content
  summary?: string;
  logs: RuntimeTaskLogLine[];
  result?: any; // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: string;
  
  // Relationships
  relatedTaskIds?: string[];
  createdBy?: string;
  
  // Flags
  updatedMemory?: boolean;
}

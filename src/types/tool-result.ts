export type ToolResultStatus = 
  | 'success' 
  | 'failed' 
  | 'blocked' 
  | 'requires_approval' 
  | 'unavailable';

export interface ToolResult {
  toolId: string;
  taskId?: string;
  status: ToolResultStatus;
  
  summary: string;
  
  stdout?: string;
  stderr?: string;
  data?: any;
  error?: string;
  
  exitCode?: number;
  durationMs: number;
  startedAt: string;
  completedAt: string;
  
  capabilityEvidence?: any;
  retryable?: boolean;
  nextSuggestedAction?: string;
}

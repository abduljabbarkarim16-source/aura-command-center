export type ArtifactType = 
  | 'code'
  | 'markdown'
  | 'table'
  | 'json'
  | 'diagram'
  | 'preview'
  | 'log'
  | 'diff'
  | 'document'
  | 'image-prompt'
  | 'task-plan'
  | 'preview_link' 
  | 'screenshot' 
  | 'file_diff' 
  | 'terminal_log' 
  | 'browser_console_log' 
  | 'test_result' 
  | 'build_result' 
  | 'command_request' 
  | 'git_summary';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  projectId: string;
  workspaceId: string;
  agentId?: string;
  sourceAgentId?: string;
  version?: number;
  createdAt: string;
  content: string;
  metadata?: Record<string, any>;
}

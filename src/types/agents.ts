export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'antigravity'
  | 'custom'
  | 'cli'
  | 'local';

export type AgentStatus = 'idle' | 'working' | 'error' | 'offline';

export interface Agent {
  id: string;
  name: string;
  provider: ProviderType;
  model: string;
  role: string;
  strengths: string[];
  weaknesses: string[];
  enabled: boolean;
  status: AgentStatus;
  maxContextTokens: number;
  currentContextUsed?: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsArtifacts: boolean;
  supportsCodeExecution: boolean;
  costInputPerMillion: number;
  costOutputPerMillion: number;
  fallbackPriority: number;
  availableTools: string[];
  permissions: string[];
}

export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextWindowPercentage: number;
  estimatedCost: number;
  activeProvider: string;
  activeModel: string;
  sessionTotalTokens: number;
  taskTotalTokens: number;
  fallbackProvider: string;
}

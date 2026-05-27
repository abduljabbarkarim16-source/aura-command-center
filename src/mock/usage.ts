import { UsageMetrics } from '../types/usage';

export const mockUsage: UsageMetrics = {
  inputTokens: 14500,
  outputTokens: 2300,
  totalTokens: 16800,
  contextWindowPercentage: 12,
  estimatedCost: 0.11,
  activeProvider: 'anthropic',
  activeModel: 'claude-3-5-sonnet',
  sessionTotalTokens: 45000,
  taskTotalTokens: 16800,
  fallbackProvider: 'openai'
};

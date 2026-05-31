export type SafetyLevel = 'safe' | 'needs_approval' | 'dangerous';

export interface RecipeStep {
  id: string;
  order: number;
  toolUsed: string;
  parameters: Record<string, any>;
  expectedOutcome?: string;
  validationCommand?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  triggerPhrase: string;
  steps: RecipeStep[];
  safetyLevel: SafetyLevel;
  approvalNeeded: boolean;
  successCount: number;
  failureCount: number;
  lastUsedAt?: string;
  createdAt: string;
  sourceAgentId?: string;
  sourceTaskIds: string[];
}

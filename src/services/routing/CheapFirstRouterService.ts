import { ollamaProviderService } from '../providers/OllamaProviderService';

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'extreme';

export type RoutingTarget = 
  | { type: 'recipe'; recipeId: string }
  | { type: 'local'; modelId: string }
  | { type: 'cloud_cheap'; provider: string; modelId: string }
  | { type: 'cloud_smart'; provider: string; modelId: string };

class CheapFirstRouterServiceImpl {
  
  async routeTask(intent: string, complexity: TaskComplexity): Promise<RoutingTarget> {
    
    // 1. Check recipes first (simulated logic for now)
    // If a recipe matches the intent exactly, we would route to 'recipe'
    
    // 2. Trivial or Simple tasks -> Route to Local if available
    if (complexity === 'trivial' || complexity === 'simple') {
      const isOllamaAvailable = (await ollamaProviderService.getAvailableModels()).length > 0;
      if (isOllamaAvailable) {
        const recommended = await ollamaProviderService.recommendModel();
        if (recommended) {
          return { type: 'local', modelId: recommended };
        }
      }
    }

    // 3. Simple/Moderate if local unavailable -> Cheap Cloud (e.g., Haiku or GPT-4o-mini)
    if (complexity === 'simple' || complexity === 'moderate') {
      // In a real app, we'd check which keys are configured
      return { type: 'cloud_cheap', provider: 'openai', modelId: 'gpt-4o-mini' };
    }

    // 4. Complex / Extreme -> Smart Cloud (Claude 3.5 Sonnet / GPT-4o)
    return { type: 'cloud_smart', provider: 'openai', modelId: 'gpt-4o' };
  }
}

export const cheapFirstRouterService = new CheapFirstRouterServiceImpl();

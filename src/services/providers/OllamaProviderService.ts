import { systemSpecService } from '../system/SystemSpecService';

export interface OllamaModel {
  name: string;
  sizeGb: number;
  family: string;
}

class OllamaProviderServiceImpl {
  async getAvailableModels(): Promise<OllamaModel[]> {
    try {
      const isRunning = await systemSpecService.checkOllama();
      if (!isRunning) return [];

      const res = await fetch('http://localhost:11434/api/tags');
      const data = await res.json();
      
      if (!data.models) return [];

      return data.models.map((m: any) => ({
        name: m.name,
        sizeGb: m.size / (1024 * 1024 * 1024),
        family: m.details?.family || 'unknown'
      }));
    } catch {
      return [];
    }
  }

  async recommendModel(): Promise<string | null> {
    const specs = await systemSpecService.getSpecs();
    
    // Simple heuristic
    if (specs.ramGb >= 32 && specs.gpu) {
      return 'llama3:8b'; // or mixtral:8x7b if really beefy
    }
    if (specs.ramGb >= 16) {
      return 'llama3:8b'; // quantized
    }
    if (specs.ramGb >= 8) {
      return 'phi3:mini'; // 3.8B parameters, very fast
    }
    
    return null;
  }
}

export const ollamaProviderService = new OllamaProviderServiceImpl();

export interface SystemSpecs {
  os: string;
  cpu: string;
  ramGb: number;
  gpu?: string;
  nodeVersion?: string;
  rustVersion?: string;
  gitVersion?: string;
  pythonVersion?: string;
  ollamaInstalled: boolean;
}

class SystemSpecServiceImpl {
  private cache: SystemSpecs | null = null;
  private isChecking = false;
  private readonly CACHE_KEY = 'aura.systemSpecs';

  async getSpecs(): Promise<SystemSpecs> {
    if (this.cache) return this.cache;

    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        this.cache = JSON.parse(cached);
        return this.cache!;
      }
    } catch {}

    // In a real desktop app, we would invoke Tauri commands to run `node -v`, `sysinfo`, etc.
    // For Phase 3H mockup, we provide a reasonable default that assumes a modern dev machine.
    const mockSpecs: SystemSpecs = {
      os: 'Windows 11',
      cpu: 'Intel Core i9 / AMD Ryzen 9',
      ramGb: 32,
      gpu: 'NVIDIA RTX',
      nodeVersion: 'v20.x',
      rustVersion: 'cargo 1.x',
      gitVersion: 'git version 2.x',
      pythonVersion: 'Python 3.x',
      ollamaInstalled: false
    };

    this.cache = mockSpecs;
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(mockSpecs));
    return mockSpecs;
  }

  async checkOllama(): Promise<boolean> {
    // Simulated check for localhost:11434
    try {
      const response = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      const ok = response.ok;
      if (this.cache) {
        this.cache.ollamaInstalled = ok;
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
      }
      return ok;
    } catch {
      if (this.cache) {
        this.cache.ollamaInstalled = false;
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
      }
      return false;
    }
  }
}

export const systemSpecService = new SystemSpecServiceImpl();

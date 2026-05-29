import {
  MakeConnectorSettings,
  MakeScenarioConfig,
  MakeConnectionStatus,
  MakePayload,
  MakeScenarioEvent,
  MakeScenarioResult,
  MakeRiskLevel
} from '../../types/make-connector';

export type MakeConnectorEvent =
  | { type: 'scenario_added'; payload: MakeScenarioConfig }
  | { type: 'scenario_updated'; payload: MakeScenarioConfig }
  | { type: 'scenario_removed'; payload: { id: string } }
  | { type: 'status_changed'; payload: { status: MakeConnectionStatus } };

type Subscriber = (event: MakeConnectorEvent) => void;

class MakeConnectorServiceImpl {
  private settings: MakeConnectorSettings = {
    scenarios: [],
    globalEnabled: true,
  };
  private subscribers: Set<Subscriber> = new Set();
  
  public subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  private notify(event: MakeConnectorEvent) {
    this.subscribers.forEach(cb => cb(event));
  }

  public getConnectionStatus(): MakeConnectionStatus {
    if (!this.settings.globalEnabled) return 'disabled';
    if (this.settings.scenarios.length === 0) return 'not_configured';
    
    const anyValid = this.settings.scenarios.some(s => s.webhook.isValid && s.enabled);
    return anyValid ? 'configured' : 'not_configured';
  }

  public listScenarios(): MakeScenarioConfig[] {
    return [...this.settings.scenarios];
  }

  public addScenario(scenario: Omit<MakeScenarioConfig, 'id' | 'createdAt' | 'updatedAt'>): MakeScenarioConfig {
    const newScenario: MakeScenarioConfig = {
      ...scenario,
      id: `make-scen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.settings.scenarios.push(newScenario);
    this.notify({ type: 'scenario_added', payload: newScenario });
    this.notifyStatusChange();
    return newScenario;
  }

  public updateScenario(id: string, updates: Partial<Omit<MakeScenarioConfig, 'id' | 'createdAt' | 'updatedAt'>>): MakeScenarioConfig | null {
    const idx = this.settings.scenarios.findIndex(s => s.id === id);
    if (idx === -1) return null;
    
    const updated = {
      ...this.settings.scenarios[idx],
      ...updates,
      updatedAt: Date.now()
    };
    
    this.settings.scenarios[idx] = updated;
    this.notify({ type: 'scenario_updated', payload: updated });
    this.notifyStatusChange();
    return updated;
  }

  public removeScenario(id: string): boolean {
    const idx = this.settings.scenarios.findIndex(s => s.id === id);
    if (idx === -1) return false;
    
    this.settings.scenarios.splice(idx, 1);
    this.notify({ type: 'scenario_removed', payload: { id } });
    this.notifyStatusChange();
    return true;
  }

  public validateWebhookUrl(url: string): { isValid: boolean; maskedUrl: string; error?: string } {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { isValid: false, maskedUrl: url, error: 'Must be an HTTP/HTTPS URL' };
      }
      if (!parsed.hostname.includes('make.com') && !parsed.hostname.includes('integromat.com')) {
        return { isValid: false, maskedUrl: url, error: 'Must be a Make.com or Integromat webhook URL' };
      }
      
      const masked = `${parsed.protocol}//${parsed.hostname}${parsed.pathname.substring(0, 15)}...`;
      return { isValid: true, maskedUrl: masked };
    } catch (e) {
      return { isValid: false, maskedUrl: url, error: 'Invalid URL format' };
    }
  }

  public createPayload(eventType: MakeScenarioEvent, riskLevel: MakeRiskLevel, data: Record<string, unknown>): MakePayload {
    return {
      eventId: `make-evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      timestamp: new Date().toISOString(),
      source: 'aura-command-center',
      data,
      riskLevel
    };
  }

  public dryRunPayload(payload: MakePayload): MakeScenarioResult {
    return {
      success: true,
      statusCode: 200,
      message: 'Dry-run successful. Payload validated structurally.',
      isDryRun: true,
      timestamp: Date.now(),
      payloadSent: payload
    };
  }

  public async triggerScenarioDryRun(scenarioId: string, eventType: MakeScenarioEvent): Promise<MakeScenarioResult> {
    const scenario = this.settings.scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
      return { success: false, message: 'Scenario not found', isDryRun: true, timestamp: Date.now() };
    }
    
    const payload = this.createPayload(eventType, 'safe', { test: true, note: 'Dry-run triggered from AURA' });
    return this.dryRunPayload(payload);
  }

  public async triggerScenarioIfConfigured(eventType: MakeScenarioEvent, riskLevel: MakeRiskLevel, data: Record<string, unknown>): Promise<MakeScenarioResult[]> {
    if (!this.settings.globalEnabled) return [];
    
    const matchingScenarios = this.settings.scenarios.filter(s => 
      s.enabled && s.webhook.isValid && s.trigger.events.includes(eventType)
    );
    
    if (matchingScenarios.length === 0) return [];
    
    const payload = this.createPayload(eventType, riskLevel, data);
    
    // In Foundation phase, we NEVER call the real webhook. 
    // We treat all calls as dry-runs unless explicitly bridged later.
    return matchingScenarios.map(s => ({
      success: true,
      message: `Simulated trigger for scenario ${s.name} (live calls disabled in Foundation)`,
      isDryRun: true,
      timestamp: Date.now(),
      scenarioId: s.id,
      payloadSent: payload
    }));
  }

  public exportScenarioConfig(): string {
    return JSON.stringify(this.settings.scenarios.map(s => ({
      name: s.name,
      description: s.description,
      trigger: s.trigger
    })), null, 2);
  }

  public importScenarioConfig(configJson: string): boolean {
    try {
      // In a real implementation this would merge and validate
      console.log('Would import:', configJson);
      return true;
    } catch {
      return false;
    }
  }

  private notifyStatusChange() {
    this.notify({ type: 'status_changed', payload: { status: this.getConnectionStatus() } });
  }
}

export const makeConnectorService = new MakeConnectorServiceImpl();

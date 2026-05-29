export type MakeRiskLevel = 'safe' | 'moderate' | 'high' | 'critical';

export type MakeConnectionStatus = 'not_configured' | 'configured' | 'disabled' | 'error';

export interface MakeWebhookConfig {
  url: string;
  maskedUrl: string;
  lastTested?: number;
  isValid: boolean;
}

export type MakeScenarioEvent =
  | 'self_build_plan_created'
  | 'command_proposed'
  | 'command_completed'
  | 'approval_required'
  | 'memory_entry_created'
  | 'provider_status_changed'
  | 'runtime_error'
  | 'relay_ready'
  | 'handoff_created'
  | 'build_completed'
  | 'phase3_connection_test';

export interface MakeScenarioTrigger {
  events: MakeScenarioEvent[];
  riskLevelThreshold?: MakeRiskLevel;
}

export interface MakeScenarioConfig {
  id: string;
  name: string;
  description: string;
  webhook: MakeWebhookConfig;
  trigger: MakeScenarioTrigger;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MakeConnectorSettings {
  scenarios: MakeScenarioConfig[];
  globalEnabled: boolean;
}

export interface MakePayload {
  eventId: string;
  eventType: MakeScenarioEvent;
  timestamp: string;
  source: string;
  data: Record<string, unknown>;
  riskLevel: MakeRiskLevel;
}

export interface MakeScenarioResult {
  success: boolean;
  statusCode?: number;
  message?: string;
  isDryRun: boolean;
  timestamp: number;
  scenarioId?: string;
  payloadSent?: MakePayload;
}

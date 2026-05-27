export interface RouteRule {
  taskType: string;
  preferredAgentId: string;
  fallbackAgentId?: string;
  description: string;
}

export interface RouterConfig {
  rules: RouteRule[];
  defaultAgentId: string;
  maxRetries: number;
}

/**
 * ProviderAdapterService — AURA Milestone G
 *
 * Adapter-ready architecture layer for AI providers.
 * Manages adapter definitions, config validation, and dry-run checks.
 *
 * Security rules (immutable):
 * - NEVER reads, prints, logs, or transmits API key values
 * - Only checks import.meta.env.VITE_* for truthy presence
 * - NEVER executes real API calls — dry-run only checks config shape
 * - NEVER stores key values in any property or localStorage
 *
 * Dry-run: validates that an adapter COULD make a request if configured,
 * without actually making one. Checks key presence + endpoint reachability shape.
 */

import { providerRegistry } from './ProviderRegistryService';
import type { ProviderHealth, ProviderType, ProviderCapability } from '../../types/providers';

// ─── Adapter types ─────────────────────────────────────────────────────────────

export interface ProviderSecretRef {
  /** Env variable name — never the value */
  envVar: string;
  /** True when the env var has a truthy value at runtime */
  present: boolean;
  /** Reminder for the user; never auto-populates */
  setInstructions: string;
}

export interface ProviderRuntimeConfig {
  providerType: ProviderType;
  baseUrl?: string;
  model: string;
  secretRef: ProviderSecretRef | null;
  headers: Record<string, string>; // No value placeholders — just shape
  timeout: number;
}

export interface ProviderRequest {
  providerId: string;
  capability: ProviderCapability;
  /** Sanitised prompt — no secrets, no credentials */
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderResponse {
  providerId: string;
  success: boolean;
  /** For dry-run: describes what would happen */
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
  isDryRun: boolean;
  error?: string;
}

export interface ProviderDryRunResult {
  providerId: string;
  providerType: ProviderType;
  displayName: string;
  isConfigured: boolean;
  hasKey: boolean;
  wouldSucceed: boolean;
  blockers: string[];
  recommendations: string[];
  configShape: Partial<ProviderRuntimeConfig>;
}

export interface ProviderConnectionTest {
  providerId: string;
  testedAt: string;
  /** 'not_tested' until dry-run is performed */
  result: 'passed' | 'failed' | 'not_tested' | 'key_missing';
  latencyMs: number | null;
  note: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ProviderAdapterService {
  private connectionTests: Map<string, ProviderConnectionTest> = new Map();

  // ── Adapter listing ───────────────────────────────────────────────────────

  listAdapters(): ProviderHealth[] {
    return providerRegistry.getAll();
  }

  getAdapter(providerType: string): ProviderHealth | undefined {
    return providerRegistry.getHealth(providerType);
  }

  // ── Config validation ─────────────────────────────────────────────────────

  /** Checks only key presence — never reads the value */
  checkConfigured(providerType: string): boolean {
    const health = providerRegistry.getHealth(providerType);
    return health?.status === 'configured';
  }

  validateConfig(providerType: string): { valid: boolean; issues: string[] } {
    const health = providerRegistry.getHealth(providerType);
    const issues: string[] = [];

    if (!health) {
      return { valid: false, issues: [`Unknown provider: ${providerType}`] };
    }

    if (health.keyEnvVar && !health.hasKey) {
      issues.push(`API key not set. Add ${health.keyEnvVar} to your .env file.`);
    }

    if (health.status === 'planned') {
      issues.push(`${health.displayName} is planned but not yet implemented.`);
    }

    return { valid: issues.length === 0, issues };
  }

  // ── Secret status ─────────────────────────────────────────────────────────

  getSecretStatus(providerType: string): ProviderSecretRef | null {
    const health = providerRegistry.getHealth(providerType);
    if (!health?.keyEnvVar) return null;

    return {
      envVar: health.keyEnvVar,
      present: health.hasKey,
      setInstructions: health.hasKey
        ? `${health.keyEnvVar} is configured.`
        : `Set ${health.keyEnvVar} in your .env file. See .env.example for the variable name.`,
    };
  }

  // ── Dry-run ───────────────────────────────────────────────────────────────

  /**
   * Dry-run validation: checks shape, key presence, and model availability.
   * Does NOT make real API calls.
   * Does NOT print or log key values.
   */
  dryRun(providerType: string): ProviderDryRunResult {
    const health = providerRegistry.getHealth(providerType);
    const { valid, issues } = this.validateConfig(providerType);

    if (!health) {
      return {
        providerId: providerType,
        providerType: providerType as ProviderType,
        displayName: 'Unknown',
        isConfigured: false,
        hasKey: false,
        wouldSucceed: false,
        blockers: ['Provider not registered'],
        recommendations: ['Check ProviderRegistryService.ADAPTER_DEFS'],
        configShape: {},
      };
    }

    const configShape: Partial<ProviderRuntimeConfig> = {
      providerType: health.providerType,
      model: health.defaultModel,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
      secretRef: health.keyEnvVar ? {
        envVar: health.keyEnvVar,
        present: health.hasKey,
        setInstructions: `Set ${health.keyEnvVar} in .env`,
      } : null,
    };

    const recommendations: string[] = [];
    if (!valid) {
      recommendations.push(`Configure ${health.displayName} by setting ${health.keyEnvVar ?? 'the required key'}.`);
    }
    if (health.status === 'planned') {
      recommendations.push(`${health.displayName} will be available in Phase 3.`);
    }

    return {
      providerId: `provider-${health.providerType}`,
      providerType: health.providerType,
      displayName: health.displayName,
      isConfigured: valid,
      hasKey: health.hasKey,
      wouldSucceed: valid,
      blockers: issues,
      recommendations,
      configShape,
    };
  }

  /** Run dry-run on all providers */
  dryRunAll(): ProviderDryRunResult[] {
    return this.listAdapters().map(h => this.dryRun(h.providerType));
  }

  // ── Placeholder request ───────────────────────────────────────────────────

  /**
   * Creates a request placeholder that shows what a real request WOULD look like.
   * Does NOT execute anything. Returns the shape only.
   */
  createProviderRequestPlaceholder(
    providerType: string,
    capability: ProviderCapability,
    promptDescription: string,
  ): ProviderRequest {
    const health = providerRegistry.getHealth(providerType);
    return {
      providerId: `provider-${providerType}`,
      capability,
      prompt: `[PLACEHOLDER] ${promptDescription}`,
      model: health?.defaultModel ?? 'unknown',
      maxTokens: 1024,
      temperature: 0.7,
    };
  }

  /** Simulate a dry-run response (no real call) */
  simulateDryRunResponse(request: ProviderRequest): ProviderResponse {
    const configured = this.checkConfigured(request.providerId.replace('provider-', ''));
    return {
      providerId: request.providerId,
      success: configured,
      content: configured
        ? `[DRY RUN] ${request.providerId} would respond to: "${request.prompt.slice(0, 60)}..."`
        : `[DRY RUN] Cannot proceed — ${request.providerId} is not configured.`,
      model: request.model ?? 'unknown',
      isDryRun: true,
      error: configured ? undefined : 'Provider not configured',
    };
  }

  // ── Connection test tracking ──────────────────────────────────────────────

  recordConnectionTest(test: ProviderConnectionTest): void {
    this.connectionTests.set(test.providerId, test);
  }

  getConnectionTest(providerId: string): ProviderConnectionTest | null {
    return this.connectionTests.get(providerId) ?? null;
  }

  listConnectionTests(): ProviderConnectionTest[] {
    return Array.from(this.connectionTests.values());
  }
}

export const providerAdapterService = new ProviderAdapterService();

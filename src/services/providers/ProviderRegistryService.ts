/**
 * ProviderRegistryService — AURA Phase 2G
 *
 * Centralised registry of AI provider definitions and runtime health.
 *
 * Security rules (immutable):
 * - NEVER reads, prints, logs, or exposes the VALUE of any API key
 * - Only checks whether import.meta.env.VITE_* is truthy (key present)
 * - NEVER makes API calls — pure config inspection only
 * - NEVER stores key values in any adapter or service property
 *
 * Usage:
 *   const providers = providerRegistry.getAll();
 *   const summary   = providerRegistry.getSummary();
 *   const health    = providerRegistry.getHealth('anthropic');
 */

import type {
  ProviderAdapterDefinition,
  ProviderHealth,
  ProviderStatus,
  ProviderRegistrySummary,
  ProviderCapability,
  ProviderType,
} from '../../types/providers';
import { secureKeyService } from '../security/SecureKeyService';

// ─── Static adapter definitions ───────────────────────────────────────────────
// These define what each provider CAN do, not what is currently executing.
// Real adapter execution wires in Phase 3.

const ADAPTER_DEFS: ProviderAdapterDefinition[] = [
  {
    providerType: 'anthropic',
    displayName:  'Anthropic / Claude',
    capabilities: ['chat', 'reasoning', 'code', 'tools'],
    keyEnvVar:    'VITE_ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-6',
    isPlanned:    false,
  },
  {
    providerType: 'openai',
    displayName:  'OpenAI / Codex',
    capabilities: ['chat', 'code', 'image', 'tools', 'tts', 'stt', 'embeddings'],
    keyEnvVar:    'VITE_OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    isPlanned:    false,
  },
  {
    providerType: 'gemini',
    displayName:  'Google / Gemini',
    capabilities: ['chat', 'reasoning', 'image', 'tools'],
    keyEnvVar:    'VITE_GOOGLE_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    isPlanned:    false,
  },
  {
    providerType: 'elevenlabs',
    displayName:  'ElevenLabs',
    capabilities: ['tts'],
    keyEnvVar:    'VITE_ELEVENLABS_API_KEY',
    defaultModel: 'eleven_turbo_v2',
    isPlanned:    true,
    notes:        'Voice TTS — integration planned for Phase 3',
  },
  {
    providerType: 'openai-realtime',
    displayName:  'OpenAI Realtime',
    capabilities: ['stt', 'tts', 'realtime_voice'],
    keyEnvVar:    'VITE_OPENAI_REALTIME_KEY',
    defaultModel: 'gpt-4o-realtime-preview',
    isPlanned:    true,
    notes:        'Full-duplex WebRTC voice — planned for Phase 3',
  },
  {
    providerType: 'browser-speech',
    displayName:  'Browser Speech (Fallback)',
    capabilities: ['stt', 'tts'],
    keyEnvVar:    null,          // No key needed
    defaultModel: 'browser-native',
    isPlanned:    true,
    notes:        'SpeechRecognition / speechSynthesis — fallback only, no mic permission granted yet',
  },
  {
    providerType: 'chatgpt-relay',
    displayName:  'ChatGPT Relay',
    capabilities: ['relay'],
    keyEnvVar:    null,          // Clipboard-based — no API key
    defaultModel: 'manual-relay',
    isPlanned:    false,
    notes:        'Clipboard handoff — no key required',
  },
  {
    providerType:    'antigravity',
    displayName:     'Antigravity',
    capabilities:    ['local_workspace', 'relay'],
    keyEnvVar:       null,
    defaultModel:    'ag-local',
    isPlanned:       true,
    integrationMode: 'local-workspace-agent',
    notes:           'No public Antigravity API key configured; use local agent handoff/workspace bridge.',
  },
  {
    providerType: 'local',
    displayName:  'Local / Ollama',
    capabilities: ['chat', 'code'],
    keyEnvVar:    null,
    defaultModel: 'llama3',
    isPlanned:    true,
    notes:        'Requires local Ollama server — not yet connected',
  },
  {
    providerType: 'oracle',
    displayName:  'Oracle / OpenClaude',
    capabilities: ['reasoning', 'relay'],
    keyEnvVar:    null,
    defaultModel: 'oracle-v1',
    isPlanned:    true,
    notes:        'Deep reasoning synthesis agent — concept only',
  },
  {
    providerType: 'custom',
    displayName:  'Custom Provider',
    capabilities: ['chat'],
    keyEnvVar:    'VITE_CUSTOM_PROVIDER_API_KEY',
    defaultModel: 'custom',
    isPlanned:    true,
    notes:        'Configurable endpoint via VITE_CUSTOM_PROVIDER_BASE_URL',
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

class ProviderRegistryService {

  // ── Key presence check ────────────────────────────────────────────────────
  // SECURITY: Queries SecureKeyService to check if a key is stored.
  // NEVER reads, stores, or logs the value.

  private hasKey(providerType: ProviderType, keyEnvVar: string | null): boolean {
    if (!keyEnvVar) return false;
    
    // During foundation phase, we fallback to env vars if the secure store is empty
    // so the app still functions while we transition.
    const secureStatus = secureKeyService.getKeyStatus(providerType);
    if (secureStatus === 'stored') return true;

    // Fallback checking
    const env = import.meta.env as Record<string, string | undefined>;
    return Boolean(env[keyEnvVar]);
  }

  // ── Status resolution ────────────────────────────────────────────────────

  private resolveStatus(def: ProviderAdapterDefinition): ProviderStatus {
    if (def.isPlanned && !this.hasKey(def.providerType, def.keyEnvVar)) {
      return 'planned';
    }
    if (def.keyEnvVar === null) {
      // No key needed — available if not planned
      return def.isPlanned ? 'planned' : 'secret_configured';
    }
    if (this.hasKey(def.providerType, def.keyEnvVar)) {
      return 'secret_configured'; // Dry run readiness tested separately
    }
    return 'missing_secret';
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Returns health snapshot for all registered providers. */
  getAll(): ProviderHealth[] {
    return ADAPTER_DEFS.map(def => ({
      id:              `provider-${def.providerType}`,
      providerType:    def.providerType,
      displayName:     def.displayName,
      status:          this.resolveStatus(def),
      capabilities:    def.capabilities,
      hasKey:          this.hasKey(def.providerType, def.keyEnvVar),
      maskedSecretRef: def.keyEnvVar ? `vault::${def.providerType}` : undefined,
      keyEnvVar:       def.keyEnvVar,
      defaultModel:    def.defaultModel,
      enabled:         true,
      integrationMode: def.integrationMode,
      notes:           def.notes,
    }));
  }

  /** Returns health for a single provider by type. */
  getHealth(providerType: string): ProviderHealth | undefined {
    return this.getAll().find(p => p.providerType === providerType);
  }

  /** Returns providers that are configured (key present and not planned). */
  getConfigured(): ProviderHealth[] {
    return this.getAll().filter(p => p.status === 'secret_configured' || p.status === 'dry_run_ready');
  }

  /** Returns providers available for a specific capability. */
  getByCapability(capability: ProviderCapability): ProviderHealth[] {
    return this.getAll().filter(p =>
      p.capabilities.includes(capability) && (p.status === 'secret_configured' || p.status === 'dry_run_ready'),
    );
  }

  /** High-level summary for dashboard/settings display. */
  getSummary(): ProviderRegistrySummary {
    const all = this.getAll();
    const configured = all.filter(p => p.status === 'secret_configured' || p.status === 'dry_run_ready').length;
    const planned    = all.filter(p => p.status === 'planned').length;
    const unavail    = all.filter(p => p.status === 'missing_secret' || p.status === 'unavailable').length;

    // Which capability buckets are covered by at least one configured provider?
    const allCapabilities: ProviderCapability[] = [
      'chat', 'reasoning', 'code', 'image', 'tts', 'stt',
      'realtime_voice', 'tools', 'relay', 'local_workspace', 'embeddings',
    ];
    const configuredProviders = this.getConfigured();
    const coverage: Partial<Record<ProviderCapability, boolean>> = {};
    for (const cap of allCapabilities) {
      coverage[cap] = configuredProviders.some(p => p.capabilities.includes(cap));
    }

    return {
      total:              all.length,
      configured,
      planned,
      unavailable:        unavail,
      capabilityCoverage: coverage,
    };
  }

  /** Returns a list of env variable names (never values) for documentation. */
  getEnvVarNames(): string[] {
    return ADAPTER_DEFS
      .map(d => d.keyEnvVar)
      .filter((v): v is string => v !== null);
  }
}

// ─── Singleton export ────────────────────────────────────────────────────────

export const providerRegistry = new ProviderRegistryService();

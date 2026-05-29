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
} from '../../types/providers';

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
    providerType: 'antigravity',
    displayName:  'Antigravity',
    capabilities: ['chat', 'relay', 'tools'],
    keyEnvVar:    'VITE_ANTIGRAVITY_API_KEY',
    defaultModel: 'ag-latest',
    isPlanned:    false,
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
  // SECURITY: Only checks truthiness. NEVER reads, stores, or logs the value.

  private hasKey(envVar: string | null): boolean {
    if (!envVar) return false;
    // import.meta.env is a Vite-specific object — values are injected at build time.
    // Checking truthiness only — we never touch the string value.
    const env = import.meta.env as Record<string, string | undefined>;
    return Boolean(env[envVar]);
  }

  // ── Status resolution ────────────────────────────────────────────────────

  private resolveStatus(def: ProviderAdapterDefinition): ProviderStatus {
    if (def.isPlanned && !this.hasKey(def.keyEnvVar)) {
      return 'planned';
    }
    if (def.keyEnvVar === null) {
      // No key needed — available if not planned
      return def.isPlanned ? 'planned' : 'configured';
    }
    if (this.hasKey(def.keyEnvVar)) {
      return 'configured';
    }
    return 'missing_key';
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Returns health snapshot for all registered providers. */
  getAll(): ProviderHealth[] {
    return ADAPTER_DEFS.map(def => ({
      id:           `provider-${def.providerType}`,
      providerType: def.providerType,
      displayName:  def.displayName,
      status:       this.resolveStatus(def),
      capabilities: def.capabilities,
      hasKey:       this.hasKey(def.keyEnvVar),
      keyEnvVar:    def.keyEnvVar,
      defaultModel: def.defaultModel,
      enabled:      true,
      notes:        def.notes,
    }));
  }

  /** Returns health for a single provider by type. */
  getHealth(providerType: string): ProviderHealth | undefined {
    return this.getAll().find(p => p.providerType === providerType);
  }

  /** Returns providers that are configured (key present and not planned). */
  getConfigured(): ProviderHealth[] {
    return this.getAll().filter(p => p.status === 'configured');
  }

  /** Returns providers available for a specific capability. */
  getByCapability(capability: ProviderCapability): ProviderHealth[] {
    return this.getAll().filter(p =>
      p.capabilities.includes(capability) && p.status === 'configured',
    );
  }

  /** High-level summary for dashboard/settings display. */
  getSummary(): ProviderRegistrySummary {
    const all = this.getAll();
    const configured = all.filter(p => p.status === 'configured').length;
    const planned    = all.filter(p => p.status === 'planned').length;
    const unavail    = all.filter(p => p.status === 'missing_key' || p.status === 'unavailable').length;

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

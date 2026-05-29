/**
 * AURA Provider Types — Phase 2G
 *
 * Defines the type vocabulary for AI provider configuration,
 * capability declarations, and runtime health status.
 *
 * Security rules:
 * - ProviderConfigSafe NEVER contains key values
 * - hasKey is a boolean presence flag only
 * - keyEnvVar stores the variable NAME only
 * - All real execution is gated behind approval and Phase 3+
 */

// ─── Core enums ───────────────────────────────────────────────────────────────

/**
 * Every known provider type. The string literal is used as a stable ID
 * so adding new providers doesn't break stored configs.
 */
export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'elevenlabs'
  | 'openai-realtime'
  | 'local'            // Ollama or similar local endpoint
  | 'browser-speech'   // Browser SpeechRecognition / speechSynthesis
  | 'chatgpt-relay'    // Clipboard-based relay — no API key
  | 'antigravity'
  | 'oracle'           // Oracle / OpenClaude — concept only
  | 'custom';

/** Runtime health of a provider as known to the registry. */
export type ProviderStatus =
  | 'configured'    // Key present in env, provider enabled
  | 'missing_key'   // Env variable known but value absent / blank
  | 'disabled'      // Explicitly disabled in settings
  | 'planned'       // Capability planned; infrastructure not yet built
  | 'unavailable';  // No key, no endpoint, not usable

/**
 * Functional capability a provider can fulfil.
 * Multiple capabilities per provider are common.
 */
export type ProviderCapability =
  | 'chat'            // Text generation / completion
  | 'reasoning'       // Extended thinking / chain-of-thought
  | 'code'            // Code generation and analysis
  | 'image'           // Image generation or understanding
  | 'tts'             // Text-to-speech audio output
  | 'stt'             // Speech-to-text audio input
  | 'realtime_voice'  // Full-duplex WebRTC voice channel
  | 'tools'           // Function / tool calling
  | 'relay'           // Reasoning relay handoff
  | 'local_workspace' // Local file/terminal access
  | 'embeddings';     // Vector embedding generation

// ─── Provider config (safe — no secret values) ───────────────────────────────

/**
 * Safe provider configuration object.
 * Stored in localStorage via SettingsService as part of ProviderConfig.
 * Never contains actual key values — only metadata.
 */
export interface ProviderConfigSafe {
  /** Stable unique ID, e.g. "provider-anthropic" */
  id: string;
  providerType: ProviderType;
  displayName: string;
  enabled: boolean;
  defaultModel: string;
  /** Environment variable NAME for the API key. Null if no key needed. */
  keyEnvVar: string | null;
  /** True when import.meta.env[keyEnvVar] is truthy — value is NEVER exposed */
  hasKey: boolean;
  /** Optional base URL for self-hosted or proxied endpoints */
  baseUrl: string;
  notes: string;
}

// ─── Provider health ──────────────────────────────────────────────────────────

/**
 * Snapshot of a provider's runtime health and capabilities.
 * Returned by ProviderRegistryService and safe to display in UI.
 */
export interface ProviderHealth {
  id: string;
  providerType: ProviderType;
  displayName: string;
  status: ProviderStatus;
  /** Capabilities this provider can fulfil (when configured) */
  capabilities: ProviderCapability[];
  /** True when the API key env variable is present and non-empty */
  hasKey: boolean;
  /** The env variable name (for display/docs only — not the value) */
  keyEnvVar: string | null;
  defaultModel: string;
  enabled: boolean;
  notes?: string;
}

// ─── Provider adapter definition ─────────────────────────────────────────────

/**
 * Static adapter registration. Describes what a provider adapter will do
 * when implemented. Used by ProviderRegistryService to build ProviderHealth.
 *
 * Actual adapter classes are not implemented until Phase 3.
 */
export interface ProviderAdapterDefinition {
  providerType: ProviderType;
  displayName: string;
  capabilities: ProviderCapability[];
  /** Env var name that holds the API key, or null if no key needed */
  keyEnvVar: string | null;
  defaultModel: string;
  /** True when the capability exists but full execution is not yet wired */
  isPlanned: boolean;
  notes?: string;
}

// ─── Registry summary ────────────────────────────────────────────────────────

/** Summary returned by ProviderRegistryService.getSummary() */
export interface ProviderRegistrySummary {
  total: number;
  configured: number;
  planned: number;
  unavailable: number;
  capabilityCoverage: Partial<Record<ProviderCapability, boolean>>;
}

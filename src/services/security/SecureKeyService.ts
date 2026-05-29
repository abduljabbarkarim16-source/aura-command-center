/**
 * SecureKeyService — AURA Secure Key Storage Foundation
 *
 * Placeholder service that defines the API surface for future OS keychain
 * integration. Currently returns "not implemented" for all storage operations.
 *
 * Security rules:
 * - NEVER store real secret values in localStorage
 * - NEVER log secret values
 * - NEVER return secret values in error messages
 * - NEVER commit .env files
 * - Future: use OS keychain (Windows Credential Manager, macOS Keychain, etc.)
 */

import type {
  SecretBackend,
  SecretBackendInfo,
  SecretKeyEntry,
  SecretKeyStatus,
  SecureKeyServiceSnapshot,
  KeyNameValidation,
  SecureKeyOperationResult,
} from '../../types/security';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Known provider key names that the system will manage */
const KNOWN_PROVIDERS = [
  { name: 'openai-api-key', provider: 'openai' },
  { name: 'anthropic-api-key', provider: 'anthropic' },
  { name: 'google-ai-api-key', provider: 'google' },
  { name: 'groq-api-key', provider: 'groq' },
  { name: 'deepseek-api-key', provider: 'deepseek' },
  { name: 'mistral-api-key', provider: 'mistral' },
] as const;

/** Valid key name pattern: lowercase alphanumeric + hyphens, 3-64 chars */
const KEY_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

// ─── Service ──────────────────────────────────────────────────────────────────

type SecureKeyListener = (snapshot: SecureKeyServiceSnapshot) => void;

class SecureKeyService {
  private listeners = new Set<SecureKeyListener>();

  // ── Subscription ──────────────────────────────────────────────────────────

  subscribe(fn: SecureKeyListener): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) fn(snap);
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  getSnapshot(): SecureKeyServiceSnapshot {
    return {
      backends: this.listSupportedSecretBackends(),
      entries: this.listManagedKeys(),
    };
  }

  // ── Backend discovery ─────────────────────────────────────────────────────

  /**
   * Returns all known secret storage backends and their availability.
   * Currently none are available — this is a foundation for future integration.
   */
  listSupportedSecretBackends(): SecretBackendInfo[] {
    return [
      {
        backend: 'os-keychain',
        available: false,
        description: 'OS-native credential manager (Windows Credential Manager, macOS Keychain, Linux Secret Service/libsecret)',
        supportedOs: ['windows', 'macos', 'linux'],
      },
      {
        backend: 'tauri-stronghold',
        available: false,
        description: 'Tauri Stronghold — encrypted file-based vault for desktop apps',
        supportedOs: ['windows', 'macos', 'linux'],
      },
      {
        backend: 'not-implemented',
        available: true,
        description: 'Placeholder backend — no actual storage',
        supportedOs: ['all'],
      },
    ];
  }

  // ── Key status ────────────────────────────────────────────────────────────

  /**
   * Returns the status of a specific key for a provider.
   * Currently always returns 'unavailable' since no backend is implemented.
   */
  getKeyStatus(provider: string): SecretKeyStatus {
    // Future: check OS keychain for the key
    void provider; // acknowledge unused for now
    return 'unavailable';
  }

  /**
   * Lists all known managed keys with their current status.
   */
  listManagedKeys(): SecretKeyEntry[] {
    const now = new Date().toISOString();
    return KNOWN_PROVIDERS.map(({ name, provider }) => ({
      name,
      provider,
      status: this.getKeyStatus(provider),
      backend: 'not-implemented' as SecretBackend,
      lastChecked: now,
    }));
  }

  // ── Key name validation ───────────────────────────────────────────────────

  /**
   * Validates a key name format.
   * Key names must be lowercase alphanumeric + hyphens, 3-64 characters.
   */
  validateKeyName(name: string): KeyNameValidation {
    if (!name || name.length < 3) {
      return { valid: false, reason: 'Key name must be at least 3 characters' };
    }
    if (name.length > 64) {
      return { valid: false, reason: 'Key name must be at most 64 characters' };
    }
    if (!KEY_NAME_PATTERN.test(name)) {
      return { valid: false, reason: 'Key name must be lowercase alphanumeric with hyphens (e.g., "openai-api-key")' };
    }
    return { valid: true };
  }

  // ── Placeholder storage operations ────────────────────────────────────────
  // These will be implemented when OS keychain integration is added.
  // Currently they return "not implemented" results.

  /**
   * Store a secret key. NOT IMPLEMENTED — placeholder only.
   * Future: will store in OS keychain via Tauri plugin.
   */
  storeKey(_name: string, _value: string): SecureKeyOperationResult {
    // SECURITY: Do NOT log the value parameter
    return {
      success: false,
      message: 'Secure key storage not implemented yet. OS keychain integration is planned for a future milestone.',
    };
  }

  /**
   * Retrieve a secret key. NOT IMPLEMENTED — placeholder only.
   * Future: will retrieve from OS keychain via Tauri plugin.
   */
  retrieveKey(_name: string): SecureKeyOperationResult {
    return {
      success: false,
      message: 'Secure key retrieval not implemented yet. OS keychain integration is planned for a future milestone.',
    };
  }

  /**
   * Delete a secret key. NOT IMPLEMENTED — placeholder only.
   * Future: will delete from OS keychain via Tauri plugin.
   */
  deleteKey(_name: string): SecureKeyOperationResult {
    return {
      success: false,
      message: 'Secure key deletion not implemented yet. OS keychain integration is planned for a future milestone.',
    };
  }
}

export const secureKeyService = new SecureKeyService();

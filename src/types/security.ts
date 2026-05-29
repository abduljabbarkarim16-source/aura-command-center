/**
 * AURA Security Types — Secure Key Storage Foundation
 *
 * Type definitions for the secure key storage service.
 * No real secret values are stored, logged, or returned.
 *
 * Future: These types will be used when OS keychain/keyring
 * integration is implemented via Tauri plugins.
 */

// ─── Secret backend ──────────────────────────────────────────────────────────

/** Supported secret storage backends */
export type SecretBackend =
  | 'os-keychain'        // Windows Credential Manager / macOS Keychain / Linux Secret Service
  | 'tauri-stronghold'   // Tauri Stronghold encrypted vault
  | 'not-implemented';   // Placeholder — no backend available yet

/** Backend availability status */
export interface SecretBackendInfo {
  backend: SecretBackend;
  available: boolean;
  description: string;
  /** Operating systems this backend supports */
  supportedOs: string[];
}

// ─── Key status ──────────────────────────────────────────────────────────────

/** Status of a specific secret key */
export type SecretKeyStatus =
  | 'stored'         // Key exists in the backend
  | 'missing'        // Key has not been stored
  | 'unavailable';   // Backend not available — cannot check

/** Entry describing a managed key (no secret values!) */
export interface SecretKeyEntry {
  /** Human-readable key name (e.g., "openai-api-key") */
  name: string;
  /** Provider this key is for (e.g., "openai", "anthropic") */
  provider: string;
  /** Current status */
  status: SecretKeyStatus;
  /** Which backend is managing this key */
  backend: SecretBackend;
  /** Last time status was checked */
  lastChecked: string;
}

// ─── Service snapshot ────────────────────────────────────────────────────────

export interface SecureKeyServiceSnapshot {
  backends: SecretBackendInfo[];
  entries: SecretKeyEntry[];
}

// ─── Key validation ──────────────────────────────────────────────────────────

export interface KeyNameValidation {
  valid: boolean;
  reason?: string;
}

// ─── Operation result ────────────────────────────────────────────────────────

export interface SecureKeyOperationResult {
  success: boolean;
  message: string;
}

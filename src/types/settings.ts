/**
 * AURA Command Center — App Settings Types
 *
 * SECURITY NOTE: This module defines settings stored in localStorage.
 * Real API keys MUST NEVER be stored here. Key values belong in
 * OS-level secure storage (Tauri Keyring / Windows Credential Store).
 * Only metadata about key presence is stored (hasApiKey, keyStorageStatus).
 */

export type AppTheme = 'dark' | 'light' | 'system';
export type RoutingMode = 'manual' | 'automatic';
export type KeyStorageStatus = 'missing' | 'configured' | 'unavailable';
export type ProviderType = 'anthropic' | 'openai' | 'google' | 'ollama' | 'custom';

// ---------------------------------------------------------------------------
// Provider config — safe metadata only, NO secret values
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  /** Stable identifier, e.g. "provider-anthropic" */
  id: string;
  providerType: ProviderType;
  displayName: string;
  enabled: boolean;
  defaultModel: string;
  /** Optional base URL override for self-hosted or proxied endpoints */
  baseUrl: string;
  /** True when a key has been stored in secure storage; the value is never read back here */
  hasApiKey: boolean;
  keyStorageStatus: KeyStorageStatus;
  notes: string;
}

// ---------------------------------------------------------------------------
// Core app settings
// ---------------------------------------------------------------------------

export interface AppSettings {
  // General
  appTheme: AppTheme;
  defaultRoute: string;
  defaultProjectId: string | null;

  // Routing
  routingMode: RoutingMode;
  defaultAgentId: string | null;
  fallbackAgentId: string | null;

  // Voice
  voiceEnabled: boolean;
  wakeWordEnabled: boolean;
  textToSpeechEnabled: boolean;
  assistantMuted: boolean;

  // Artifacts
  artifactAutoOpen: boolean;

  // Safety approvals
  requireApprovalForDangerousCommands: boolean;
  requireApprovalForPackageInstall: boolean;
  requireApprovalForGitPush: boolean;
  requireApprovalForExternalNetwork: boolean;

  // Memory
  memoryRetentionDays: number;

  // Privacy / telemetry
  telemetryEnabled: boolean;

  // Desktop
  desktopNotificationsEnabled: boolean;
  /** Placeholder — real path requires Tauri FS permission grant from user */
  localWorkspaceRoot: string;
  /** Placeholder — path to user-managed MCP config file */
  mcpConfigPath: string;

  // Startup / safety mode
  safeMonitorMode: boolean;

  // Notification preferences
  toastNotificationsEnabled: boolean;
  toastPosition: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  notificationHistoryEnabled: boolean;
  notificationSoundEnabled: boolean;
  showApprovalsAsOverlay: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = {
  appTheme: 'dark',
  defaultRoute: '/',
  defaultProjectId: null,

  routingMode: 'manual',
  defaultAgentId: null,
  fallbackAgentId: null,

  voiceEnabled: false,
  wakeWordEnabled: false,
  textToSpeechEnabled: false,
  assistantMuted: false,

  artifactAutoOpen: true,

  requireApprovalForDangerousCommands: true,
  requireApprovalForPackageInstall: true,
  requireApprovalForGitPush: true,
  requireApprovalForExternalNetwork: false,

  memoryRetentionDays: 90,

  telemetryEnabled: false,

  desktopNotificationsEnabled: false,
  localWorkspaceRoot: '',
  mcpConfigPath: '',

  safeMonitorMode: false,

  toastNotificationsEnabled: true,
  toastPosition: 'bottom-right',
  notificationHistoryEnabled: true,
  notificationSoundEnabled: false,
  showApprovalsAsOverlay: true,
};

export const DEFAULT_PROVIDERS: Readonly<ProviderConfig[]> = [
  {
    id: 'provider-anthropic',
    providerType: 'anthropic',
    displayName: 'Anthropic (Claude)',
    enabled: true,
    defaultModel: 'claude-sonnet-4-6',
    baseUrl: '',
    hasApiKey: false,
    keyStorageStatus: 'missing',
    notes: 'API key stored in OS secure storage only — never in localStorage.',
  },
  {
    id: 'provider-openai',
    providerType: 'openai',
    displayName: 'OpenAI',
    enabled: false,
    defaultModel: 'gpt-4o',
    baseUrl: '',
    hasApiKey: false,
    keyStorageStatus: 'missing',
    notes: 'API key stored in OS secure storage only — never in localStorage.',
  },
  {
    id: 'provider-google',
    providerType: 'google',
    displayName: 'Google (Gemini)',
    enabled: false,
    defaultModel: 'gemini-2.0-flash',
    baseUrl: '',
    hasApiKey: false,
    keyStorageStatus: 'missing',
    notes: 'API key stored in OS secure storage only — never in localStorage.',
  },
  {
    id: 'provider-ollama',
    providerType: 'ollama',
    displayName: 'Ollama (Local)',
    enabled: false,
    defaultModel: 'llama3',
    baseUrl: 'http://localhost:11434',
    hasApiKey: false,
    keyStorageStatus: 'unavailable',
    notes: 'No API key required. Requires local Ollama server.',
  },
];

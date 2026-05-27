/**
 * AURA Command Center — useAppSettings hook
 *
 * Provides reactive access to app settings and provider configs persisted
 * via SettingsService. Wraps async service calls in useState + useEffect so
 * components can read and update settings with a simple synchronous API.
 *
 * Usage:
 *   const { settings, updateSettings, resetSettings, isLoading } = useAppSettings();
 */

import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, ProviderConfig } from '../types/settings';
import { DEFAULT_APP_SETTINGS, DEFAULT_PROVIDERS } from '../types/settings';
import { settingsService } from '../services/settings/SettingsService';

export interface UseAppSettingsReturn {
  /** Current app settings. Equals DEFAULT_APP_SETTINGS while loading. */
  settings: AppSettings;
  /** Provider config list. Equals DEFAULT_PROVIDERS while loading. */
  providers: ProviderConfig[];
  /** True during the initial async load from storage. */
  isLoading: boolean;
  /** Merge a partial patch into current settings and persist. */
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  /** Overwrite the full settings object and persist. */
  saveSettings: (next: AppSettings) => Promise<void>;
  /** Reset all settings to factory defaults and persist. */
  resetSettings: () => Promise<void>;
  /** Update a single provider by id and persist. */
  updateProvider: (id: string, patch: Partial<ProviderConfig>) => Promise<void>;
  /** Export full settings as a JSON string (for download). */
  exportSettingsJson: () => Promise<string>;
}

export function useAppSettings(): UseAppSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [providers, setProviders] = useState<ProviderConfig[]>([...DEFAULT_PROVIDERS]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from persistence on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      settingsService.getSettings(),
      settingsService.getProviders(),
    ])
      .then(([s, p]) => {
        if (!cancelled) {
          setSettings(s);
          setProviders(p);
        }
      })
      .catch(err => {
        console.warn('[useAppSettings] Failed to load settings:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const updated = await settingsService.updateSettings(patch);
    setSettings(updated);
  }, []);

  const saveSettings = useCallback(async (next: AppSettings) => {
    await settingsService.saveSettings(next);
    setSettings(next);
  }, []);

  const resetSettings = useCallback(async () => {
    const defaults = await settingsService.resetSettings();
    setSettings(defaults);
  }, []);

  const updateProvider = useCallback(async (id: string, patch: Partial<ProviderConfig>) => {
    const updated = await settingsService.updateProvider(id, patch);
    setProviders(updated);
  }, []);

  const exportSettingsJson = useCallback(async () => {
    return settingsService.exportSettingsJson();
  }, []);

  return {
    settings,
    providers,
    isLoading,
    updateSettings,
    saveSettings,
    resetSettings,
    updateProvider,
    exportSettingsJson,
  };
}

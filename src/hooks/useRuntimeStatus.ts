/**
 * useRuntimeStatus — Phase 2G
 *
 * Aggregates live counts from multiple services for the Voice Core
 * status chip strip and any dashboard summary widgets.
 *
 * Reads are async and non-blocking — initial values are null until
 * the first service response arrives. Components should show a
 * sensible fallback (e.g. the previous static label) until data arrives.
 *
 * Services consumed:
 *   SettingsService  → memory entry count
 *   RelayService     → active (non-archived) relay exchange count
 *   NotificationService → active (non-dismissed) notification count
 *   ProviderRegistryService → configured provider count
 */

import { useEffect, useState } from 'react';
import { settingsService } from '../services/settings/SettingsService';
import { relayService } from '../services/relay/RelayService';
import { notificationService } from '../services/notifications/NotificationService';
import { providerRegistry } from '../services/providers/ProviderRegistryService';

export interface RuntimeStatus {
  /** Number of persisted memory entries, or null while loading. */
  memoryCount: number | null;
  /** Number of active (non-archived/rejected) relay exchanges, or null while loading. */
  relayActiveCount: number | null;
  /** Number of non-dismissed active notifications. */
  notifCount: number;
  /** Number of providers with a key configured. */
  configuredProviderCount: number;
}

export function useRuntimeStatus(): RuntimeStatus {
  const [memoryCount,  setMemoryCount]  = useState<number | null>(null);
  const [relayActiveCount, setRelayActiveCount] = useState<number | null>(null);
  const [notifCount,   setNotifCount]   = useState(
    notificationService.getActive().length,
  );
  const [configuredProviderCount, setConfiguredProviderCount] = useState(
    providerRegistry.getSummary().configured,
  );

  // Async loads — run once on mount
  useEffect(() => {
    let cancelled = false;

    settingsService.listMemoryEntries().then(entries => {
      if (!cancelled) setMemoryCount(entries.length);
    }).catch(() => { if (!cancelled) setMemoryCount(0); });

    relayService.listRelayHistory().then(exchanges => {
      if (!cancelled) {
        const active = exchanges.filter(e =>
          e.packet.status !== 'archived' && e.packet.status !== 'rejected',
        ).length;
        setRelayActiveCount(active);
      }
    }).catch(() => { if (!cancelled) setRelayActiveCount(0); });

    // Provider registry is synchronous (env var check at call time)
    setConfiguredProviderCount(providerRegistry.getSummary().configured);

    return () => { cancelled = true; };
  }, []);

  // Live notification count — subscribe to NotificationService
  useEffect(() => {
    return notificationService.subscribe(notifs => {
      setNotifCount(notifs.filter(n => !n.dismissed).length);
    });
  }, []);

  return {
    memoryCount,
    relayActiveCount,
    notifCount,
    configuredProviderCount,
  };
}

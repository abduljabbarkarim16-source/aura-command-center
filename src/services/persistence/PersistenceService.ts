/**
 * AURA Command Center — Persistence Service
 *
 * Provides two concrete PersistenceAdapter implementations:
 *
 *   LocalStorageAdapter  — Uses window.localStorage. Works in Tauri WebView
 *                          and the browser dev server. Suitable for settings
 *                          and non-sensitive data.
 *
 *   InMemoryAdapter      — Pure in-memory fallback (e.g., SSR, test env, or
 *                          when localStorage is unavailable).
 *
 * All keys are namespaced under AURA_NAMESPACE to avoid collisions.
 *
 * SECURITY: Never store API key values through these adapters.
 *           Use OS-level secure storage (Tauri Keyring) for secrets.
 */

import type { PersistenceAdapter } from '../../types/persistence';

const AURA_NAMESPACE = 'aura:';

// ---------------------------------------------------------------------------
// LocalStorageAdapter
// ---------------------------------------------------------------------------

export class LocalStorageAdapter implements PersistenceAdapter {
  private ns(key: string): string {
    return `${AURA_NAMESPACE}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = window.localStorage.getItem(this.ns(key));
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      window.localStorage.setItem(this.ns(key), JSON.stringify(value));
    } catch (err) {
      console.warn('[PersistenceService] localStorage.setItem failed:', err);
    }
  }

  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(this.ns(key));
  }

  async clear(): Promise<void> {
    const toRemove = Object.keys(window.localStorage).filter(k =>
      k.startsWith(AURA_NAMESPACE)
    );
    toRemove.forEach(k => window.localStorage.removeItem(k));
  }

  async keys(): Promise<string[]> {
    return Object.keys(window.localStorage)
      .filter(k => k.startsWith(AURA_NAMESPACE))
      .map(k => k.slice(AURA_NAMESPACE.length));
  }
}

// ---------------------------------------------------------------------------
// InMemoryAdapter  (fallback / tests)
// ---------------------------------------------------------------------------

export class InMemoryAdapter implements PersistenceAdapter {
  private store = new Map<string, string>();

  async get<T>(key: string): Promise<T | null> {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

// ---------------------------------------------------------------------------
// Factory — picks the best available adapter at runtime
// ---------------------------------------------------------------------------

function createDefaultAdapter(): PersistenceAdapter {
  try {
    // Probe localStorage availability (may throw in some sandboxed envs)
    const probe = '__aura_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return new LocalStorageAdapter();
  } catch {
    console.warn('[PersistenceService] localStorage unavailable, using InMemoryAdapter');
    return new InMemoryAdapter();
  }
}

// Singleton adapter used by all services
export const defaultAdapter: PersistenceAdapter = createDefaultAdapter();

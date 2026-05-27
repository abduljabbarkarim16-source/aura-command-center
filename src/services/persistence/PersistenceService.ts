/**
 * AURA Command Center — Persistence Service (Phase 2C bundle)
 *
 * Backend-agnostic adapter interface + LocalStorage/InMemory implementations.
 * All keys are namespaced under "aura:" to avoid collisions.
 *
 * SECURITY: Never store API key values through these adapters.
 */

export interface PersistenceAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

const NS = 'aura:';

export class LocalStorageAdapter implements PersistenceAdapter {
  private ns(k: string) { return `${NS}${k}`; }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = window.localStorage.getItem(this.ns(key));
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch { return null; }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try { window.localStorage.setItem(this.ns(key), JSON.stringify(value)); }
    catch (e) { console.warn('[Persistence] set failed:', e); }
  }

  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(this.ns(key));
  }

  async clear(): Promise<void> {
    Object.keys(window.localStorage)
      .filter(k => k.startsWith(NS))
      .forEach(k => window.localStorage.removeItem(k));
  }

  async keys(): Promise<string[]> {
    return Object.keys(window.localStorage)
      .filter(k => k.startsWith(NS))
      .map(k => k.slice(NS.length));
  }
}

export class InMemoryAdapter implements PersistenceAdapter {
  private store = new Map<string, string>();
  async get<T>(key: string): Promise<T | null> {
    const v = this.store.get(key);
    try { return v !== undefined ? (JSON.parse(v) as T) : null; }
    catch { return null; }
  }
  async set<T>(key: string, value: T): Promise<void> { this.store.set(key, JSON.stringify(value)); }
  async remove(key: string): Promise<void> { this.store.delete(key); }
  async clear(): Promise<void> { this.store.clear(); }
  async keys(): Promise<string[]> { return Array.from(this.store.keys()); }
}

function makeAdapter(): PersistenceAdapter {
  try {
    const p = '__aura_probe__';
    window.localStorage.setItem(p, '1');
    window.localStorage.removeItem(p);
    return new LocalStorageAdapter();
  } catch {
    return new InMemoryAdapter();
  }
}

export const defaultAdapter: PersistenceAdapter = makeAdapter();

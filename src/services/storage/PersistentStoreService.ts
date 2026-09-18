/**
 * PersistentStoreService — AURA Phase 3K
 *
 * Key-value store that survives app reinstalls.
 *
 * Strategy:
 *   Write → Tauri file store (%APPDATA%\com.aura.commandcenter\persist\) AND localStorage
 *   Read  → Tauri file store first, fall back to localStorage, fall back to null
 *   Dev   → localStorage only (Tauri commands unavailable in browser preview)
 *
 * Why this exists: NSIS reinstalls can wipe the WebView2 data partition
 * (localStorage), losing all memory. The Tauri file store path is stable
 * across reinstalls. See ERR-0017 in ai-build-memory.
 */

import { invoke } from '@tauri-apps/api/core';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

class PersistentStoreServiceImpl {
  async get(key: string): Promise<string | null> {
    // Try Tauri file store first (survives reinstall)
    if (isTauri()) {
      try {
        const val = await invoke<string | null>('persist_read', { key });
        if (val !== null && val !== undefined) {
          // Also write back to localStorage for fast subsequent reads
          try { localStorage.setItem(`persist:${key}`, val); } catch { /* full */ }
          return val;
        }
      } catch { /* Tauri command not yet registered or failed — fall through */ }
    }
    // Fall back to localStorage
    try {
      return localStorage.getItem(`persist:${key}`);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    // Write to localStorage immediately (synchronous, fast UI reads)
    try { localStorage.setItem(`persist:${key}`, value); } catch { /* full */ }
    // Write to Tauri file store (durable across reinstalls)
    if (isTauri()) {
      try {
        await invoke<void>('persist_write', { key, value });
      } catch (e) {
        console.warn('[PersistentStore] Tauri write failed, localStorage only:', e);
      }
    }
  }

  async delete(key: string): Promise<void> {
    try { localStorage.removeItem(`persist:${key}`); } catch { /* ignore */ }
    if (isTauri()) {
      try { await invoke<void>('persist_delete', { key }); } catch { /* ignore */ }
    }
  }

  async list(): Promise<string[]> {
    if (isTauri()) {
      try {
        return await invoke<string[]>('persist_list');
      } catch { /* fall through */ }
    }
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('persist:')) keys.push(k.slice(8));
      }
    } catch { /* ignore */ }
    return keys;
  }

  /** Parse a stored JSON value. Returns null on missing/parse error. */
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  /** Stringify and store a value as JSON. */
  async setJSON<T>(key: string, value: T): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }
}

export const persistentStore = new PersistentStoreServiceImpl();

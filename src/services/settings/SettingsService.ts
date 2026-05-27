/**
 * AURA Command Center — Settings Service
 *
 * Central service for reading and writing app settings, provider configs,
 * project registry, and memory entries via the persistence adapter.
 *
 * All methods are async to remain compatible with future adapter backends
 * (Tauri store, SQLite, etc.) even though localStorage is synchronous.
 */

import type { PersistenceAdapter } from '../../types/persistence';
import type {
  PersistedProject,
  PersistedMemoryEntry,
  MemoryExportBundle,
} from '../../types/persistence';
import type { AppSettings, ProviderConfig } from '../../types/settings';
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_PROVIDERS,
} from '../../types/settings';
import { defaultAdapter } from '../persistence/PersistenceService';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEYS = {
  APP_SETTINGS: 'settings.app',
  PROVIDERS: 'settings.providers',
  PROJECTS: 'registry.projects',
  MEMORY: 'memory.entries',
} as const;

// ---------------------------------------------------------------------------
// SettingsService class
// ---------------------------------------------------------------------------

export class SettingsService {
  constructor(private adapter: PersistenceAdapter = defaultAdapter) {}

  // ── App Settings ──────────────────────────────────────────────────────────

  async getSettings(): Promise<AppSettings> {
    const stored = await this.adapter.get<Partial<AppSettings>>(KEYS.APP_SETTINGS);
    // Merge stored values over defaults so new fields are always present
    return { ...DEFAULT_APP_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.adapter.set(KEYS.APP_SETTINGS, settings);
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...patch };
    await this.saveSettings(updated);
    return updated;
  }

  async resetSettings(): Promise<AppSettings> {
    await this.adapter.remove(KEYS.APP_SETTINGS);
    return { ...DEFAULT_APP_SETTINGS };
  }

  // ── Provider Configs ──────────────────────────────────────────────────────

  async getProviders(): Promise<ProviderConfig[]> {
    const stored = await this.adapter.get<ProviderConfig[]>(KEYS.PROVIDERS);
    if (!stored || stored.length === 0) return [...DEFAULT_PROVIDERS];
    // Merge: ensure any new default providers added in future releases appear
    const storedMap = new Map(stored.map(p => [p.id, p]));
    const merged = DEFAULT_PROVIDERS.map(def => ({
      ...def,
      ...(storedMap.get(def.id) ?? {}),
    }));
    // Append any custom providers the user added that aren't in defaults
    const defaultIds = new Set(DEFAULT_PROVIDERS.map(p => p.id));
    const custom = stored.filter(p => !defaultIds.has(p.id));
    return [...merged, ...custom];
  }

  async saveProviders(providers: ProviderConfig[]): Promise<void> {
    await this.adapter.set(KEYS.PROVIDERS, providers);
  }

  async updateProvider(id: string, patch: Partial<ProviderConfig>): Promise<ProviderConfig[]> {
    const providers = await this.getProviders();
    const updated = providers.map(p => (p.id === id ? { ...p, ...patch } : p));
    await this.saveProviders(updated);
    return updated;
  }

  // ── Project Registry ──────────────────────────────────────────────────────

  async getProjects(): Promise<PersistedProject[]> {
    return (await this.adapter.get<PersistedProject[]>(KEYS.PROJECTS)) ?? [];
  }

  async saveProjects(projects: PersistedProject[]): Promise<void> {
    await this.adapter.set(KEYS.PROJECTS, projects);
  }

  async upsertProject(project: PersistedProject): Promise<void> {
    const projects = await this.getProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    const now = new Date().toISOString();
    if (idx >= 0) {
      projects[idx] = { ...project, updatedAt: now };
    } else {
      projects.push({ ...project, createdAt: now, updatedAt: now });
    }
    await this.saveProjects(projects);
  }

  async removeProject(id: string): Promise<void> {
    const projects = await this.getProjects();
    await this.saveProjects(projects.filter(p => p.id !== id));
  }

  // ── Memory Entries ────────────────────────────────────────────────────────

  async listMemoryEntries(projectId?: string): Promise<PersistedMemoryEntry[]> {
    const all = (await this.adapter.get<PersistedMemoryEntry[]>(KEYS.MEMORY)) ?? [];
    return projectId ? all.filter(m => m.projectId === projectId) : all;
  }

  async addMemoryEntry(entry: PersistedMemoryEntry): Promise<void> {
    const all = await this.listMemoryEntries();
    await this.adapter.set(KEYS.MEMORY, [entry, ...all]);
  }

  async clearMemoryEntries(projectId?: string): Promise<void> {
    if (!projectId) {
      await this.adapter.remove(KEYS.MEMORY);
      return;
    }
    const all = await this.listMemoryEntries();
    await this.adapter.set(
      KEYS.MEMORY,
      all.filter(m => m.projectId !== projectId)
    );
  }

  async exportMemoryJson(): Promise<MemoryExportBundle> {
    const entries = await this.listMemoryEntries();
    return {
      exportedAt: new Date().toISOString(),
      version: '1',
      entries,
    };
  }

  async importMemoryJson(bundle: MemoryExportBundle): Promise<void> {
    if (bundle.version !== '1') {
      throw new Error(`Unsupported memory bundle version: ${bundle.version}`);
    }
    const existing = await this.listMemoryEntries();
    const existingIds = new Set(existing.map(e => e.id));
    const newEntries = bundle.entries.filter(e => !existingIds.has(e.id));
    await this.adapter.set(KEYS.MEMORY, [...newEntries, ...existing]);
  }

  // ── Full reset ────────────────────────────────────────────────────────────

  async clearAll(): Promise<void> {
    await this.adapter.clear();
  }

  // ── Export full settings JSON ─────────────────────────────────────────────

  async exportSettingsJson(): Promise<string> {
    const [settings, providers, projects] = await Promise.all([
      this.getSettings(),
      this.getProviders(),
      this.getProjects(),
    ]);
    const bundle = {
      exportedAt: new Date().toISOString(),
      version: '1',
      settings,
      providers,
      projects,
    };
    return JSON.stringify(bundle, null, 2);
  }
}

// Singleton instance used by hooks and components
export const settingsService = new SettingsService();

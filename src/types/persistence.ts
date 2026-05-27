/**
 * AURA Command Center — Persistence Layer Types
 *
 * PersistenceAdapter is a backend-agnostic interface. Current Phase 2B
 * ships a LocalStorageAdapter (browser) and an InMemoryAdapter (fallback).
 *
 * Future adapters can implement this interface without touching callers:
 *   - TauriStoreAdapter   (tauri-plugin-store, encrypted JSON file)
 *   - SqliteAdapter       (tauri-plugin-sql, SQLite via Rust)
 *   - KeyringAdapter      (OS credential store, secrets only)
 */

// ---------------------------------------------------------------------------
// Core adapter interface
// ---------------------------------------------------------------------------

export interface PersistenceAdapter {
  /** Read a value by key. Returns null if absent or on parse error. */
  get<T>(key: string): Promise<T | null>;
  /** Write a serialisable value under key. */
  set<T>(key: string, value: T): Promise<void>;
  /** Delete a single key. No-op if absent. */
  remove(key: string): Promise<void>;
  /** Wipe all AURA-namespaced keys managed by this adapter. */
  clear(): Promise<void>;
  /** List all keys managed by this adapter. */
  keys(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Persisted domain models
// ---------------------------------------------------------------------------

export type ProjectStatus = 'active' | 'archived' | 'error';

/** Registry entry for a project stored via PersistenceService */
export interface PersistedProject {
  id: string;
  name: string;
  /** Placeholder — real filesystem path requires explicit Tauri FS permission */
  localPath: string;
  repoUrl: string;
  defaultBranch: string;
  activeWorkspaceId: string | null;
  createdAt: string;   // ISO-8601
  updatedAt: string;   // ISO-8601
  status: ProjectStatus;
  notes: string;
}

export type MemoryCategory = 'decision' | 'error' | 'fix' | 'task' | 'handoff' | 'tool_log';
export type MemoryStatus = 'active' | 'resolved' | 'archived';

/** A single persisted memory entry */
export interface PersistedMemoryEntry {
  id: string;
  timestamp: string;   // ISO-8601
  projectId: string;
  agentName: string;
  category: MemoryCategory;
  title: string;
  summary: string;
  details: string;
  relatedFiles: string[];
  tags: string[];
  status: MemoryStatus;
}

/** Shape of the full memory export / import JSON */
export interface MemoryExportBundle {
  exportedAt: string;
  version: '1';
  entries: PersistedMemoryEntry[];
}

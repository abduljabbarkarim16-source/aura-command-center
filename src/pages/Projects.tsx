/**
 * Projects page — Phase 2B
 *
 * Loads projects from the persistence service (localStorage).
 * Falls back to seed data from mockProjects on first launch so the UI
 * is never empty. The seed is written into storage once and then owned
 * by the persistence layer going forward.
 */

import { useEffect, useState } from 'react';
import { FolderGit2, Plus, RefreshCw } from 'lucide-react';
import { mockProjects } from '../store/mockData';
import { settingsService } from '../services/settings/SettingsService';
import type { PersistedProject } from '../types/persistence';

/** Converts the existing mock Project shape into PersistedProject */
function seedFromMock(): PersistedProject[] {
  return mockProjects.map(p => ({
    id: p.id,
    name: p.name,
    localPath: p.localPath,
    repoUrl: p.githubRepo ?? '',
    defaultBranch: 'main',
    activeWorkspaceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active' as const,
    notes: p.environmentNotes,
  }));
}

export function Projects() {
  const [projects, setProjects] = useState<PersistedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    let stored = await settingsService.getProjects();
    if (stored.length === 0) {
      // Seed from mock data on first run
      const seed = seedFromMock();
      await settingsService.saveProjects(seed);
      stored = seed;
    }
    setProjects(stored);
    setIsLoading(false);
  }

  useEffect(() => { load(); }, []);

  const statusColor: Record<string, string> = {
    active: 'bg-emerald-500',
    archived: 'bg-zinc-500',
    error: 'bg-rose-500',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Projects</h1>
          <p className="text-zinc-400 text-sm">
            Manage workspaces and connected repositories
            <span className="ml-2 text-xs text-zinc-600">(persisted · Phase 2B)</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 border border-zinc-800 bg-zinc-900 rounded-md text-zinc-400 hover:text-white transition"
            title="Reload from storage"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition">
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
          Loading projects…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(proj => (
            <div
              key={proj.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition cursor-pointer flex flex-col h-full"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <FolderGit2 className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-white truncate">{proj.name}</h3>
                  {proj.repoUrl && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{proj.repoUrl}</p>
                  )}
                </div>
                <div
                  className={`ml-auto w-2 h-2 rounded-full shrink-0 mt-1 ${statusColor[proj.status] ?? 'bg-zinc-500'}`}
                  title={proj.status}
                />
              </div>

              <div className="mt-auto space-y-2 pt-4 border-t border-zinc-800/50 text-xs text-zinc-500">
                <div className="font-mono truncate" title={proj.localPath}>
                  {proj.localPath || <span className="italic text-zinc-700">No local path set</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="bg-zinc-950 px-2 py-0.5 border border-zinc-800 rounded">
                    {proj.notes || proj.defaultBranch}
                  </span>
                  <span className="text-zinc-700">
                    {new Date(proj.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

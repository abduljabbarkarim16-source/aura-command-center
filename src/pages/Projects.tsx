/**
 * Projects page — Phase 2E (Premium Redesign)
 *
 * Shows a masonry-inspired grid of ProjectMissionCards.
 * Data loads from persistence (Phase 2B) with a mock seed fallback.
 */

import React, { useEffect, useState, Fragment } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { mockProjects, mockAgents } from '../store/mockData';
import { settingsService } from '../services/settings/SettingsService';
import type { PersistedProject } from '../types/persistence';
import {
  ProjectMissionCard,
  NewProjectCard,
  type ProjectMission,
  type ProjectStatus,
} from '../components/operator/ProjectMissionCard';

// ─── Seed conversion ──────────────────────────────────────────────────────────

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

function toMissionCard(proj: PersistedProject, index: number): ProjectMission {
  // Find agent name from mock data
  const mockProj = mockProjects.find(p => p.id === proj.id);
  const agent = mockProj?.activeAgentId
    ? mockAgents.find(a => a.id === mockProj.activeAgentId)
    : undefined;

  // Fabricate some demo mission data for display
  const missions: Record<string, string> = {
    'proj-1': 'Build a unified AI agent orchestration desktop app with relay, memory, and approval workflows.',
    'proj-2': 'Implement a high-performance Rust/Actix-web e-commerce backend with PostgreSQL.',
  };
  const lastActions: Record<string, string> = {
    'proj-1': 'Merged Phase 2D — relay handoff integration with persistent storage',
    'proj-2': 'Completed product catalog API endpoints and search indexing',
  };
  const nextActions: Record<string, string> = {
    'proj-1': 'Phase 2E: premium operator UX redesign and assistant canvas',
    'proj-2': 'Implement Stripe payment webhook handlers and order fulfillment flow',
  };

  return {
    id: proj.id,
    name: proj.name,
    status: (proj.status as ProjectStatus) ?? 'active',
    mission: missions[proj.id] ?? proj.notes ?? 'No mission description set.',
    activeAgent: agent?.name ?? undefined,
    progress: index === 0 ? 72 : index === 1 ? 45 : 20,
    lastAction: lastActions[proj.id],
    nextAction: nextActions[proj.id],
    openApprovals: index === 0 ? 2 : 0,
    lastUpdated: proj.updatedAt,
    tags: proj.notes ? proj.notes.split('/').map(s => s.trim()).filter(Boolean) : [],
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Projects() {
  const [projects, setProjects] = useState<PersistedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function load() {
    setIsLoading(true);
    let stored = await settingsService.getProjects();
    if (stored.length === 0) {
      const seed = seedFromMock();
      await settingsService.saveProjects(seed);
      stored = seed;
    }
    setProjects(stored);
    setActiveId(stored[0]?.id ?? null);
    setIsLoading(false);
  }

  useEffect(() => { load(); }, []);

  const missions = projects
    .map((p, i) => toMissionCard(p, i))
    .filter(m =>
      query.length === 0 ||
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.mission.toLowerCase().includes(query.toLowerCase())
    );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">
            Projects
          </h1>
          <p className="text-zinc-400 text-sm">
            Active missions and connected workspaces
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={load}
            className="p-2 border border-zinc-800 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white hover:border-zinc-700 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search projects..."
          className="w-full pl-9 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 rounded-xl text-zinc-300 placeholder:text-zinc-600 text-[14px] focus:outline-none transition"
        />
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex items-center gap-3 text-zinc-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading projects…</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {missions.map(mission => (
            <Fragment key={mission.id}>
              <ProjectMissionCard
                project={mission}
                isActive={mission.id === activeId}
                onClick={() => setActiveId(mission.id)}
              />
            </Fragment>
          ))}

          {/* New project CTA */}
          <NewProjectCard />
        </div>
      )}

      {!isLoading && missions.length === 0 && query.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <Search className="w-8 h-8 mb-3 opacity-40" />
          <p className="text-sm">No projects match "{query}"</p>
        </div>
      )}
    </div>
  );
}

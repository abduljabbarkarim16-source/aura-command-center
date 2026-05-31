/**
 * Memory page — Phase 2B
 *
 * Loads memory entries from the persistence service (localStorage).
 * Falls back to seed data from mockMemory on first launch.
 * Adds export-as-JSON capability using SettingsService.exportMemoryJson().
 */

import { useEffect, useState, useMemo } from 'react';
import { Search, Filter, Database, BrainCircuit, Download, RefreshCw } from 'lucide-react';
import { mockMemory } from '../store/mockData';
import { settingsService } from '../services/settings/SettingsService';
import type { PersistedMemoryEntry, MemoryCategory } from '../types/persistence';
import { DataSourceNotice } from '../components/common/DataSourceNotice';

const ALL_CATEGORIES: MemoryCategory[] = ['decision', 'error', 'fix', 'task', 'handoff', 'tool_log'];

/** Converts existing MemoryEntry mock shape → PersistedMemoryEntry */
function seedFromMock(): PersistedMemoryEntry[] {
  return mockMemory.map(m => ({
    id: m.id,
    timestamp: m.timestamp,
    projectId: m.projectId,
    agentName: m.agentName,
    category: m.category as MemoryCategory,
    title: m.title,
    summary: m.summary,
    details: m.details,
    relatedFiles: m.relatedFiles,
    tags: m.tags,
    status: m.status as PersistedMemoryEntry['status'],
  }));
}

const categoryStyle: Record<MemoryCategory, string> = {
  decision: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  error:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
  fix:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  task:     'bg-sky-500/10 text-sky-400 border-sky-500/20',
  handoff:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  tool_log: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

export function Memory() {
  const [entries, setEntries] = useState<PersistedMemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seededFromMock, setSeededFromMock] = useState(false);
  const [activeCategory, setActiveCategory] = useState<MemoryCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  async function load() {
    setIsLoading(true);
    let stored = await settingsService.listMemoryEntries();
    if (stored.length === 0) {
      const seed = seedFromMock();
      for (const e of seed) await settingsService.addMemoryEntry(e);
      stored = seed;
      setSeededFromMock(true);
    } else {
      setSeededFromMock(false);
    }
    setEntries(stored);
    setIsLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return entries.filter(m => {
      if (activeCategory !== 'all' && m.category !== activeCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.title.toLowerCase().includes(q) ||
          m.summary.toLowerCase().includes(q) ||
          m.agentName.toLowerCase().includes(q) ||
          m.tags.some(t => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [entries, activeCategory, search]);

  async function handleExport() {
    const bundle = await settingsService.exportMemoryJson();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-memory-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Project Memory</h1>
          <p className="text-zinc-400 text-sm">
            Long-term context, decisions, and knowledge base
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
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white rounded-md transition"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search memory…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 w-48"
            />
          </div>
          <button className="p-2 border border-zinc-800 bg-zinc-900 rounded-md text-zinc-400 hover:text-white transition">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {seededFromMock && (
        <DataSourceNotice detail="No saved project-memory entries were found, so this session was initialized with seed data from the demo fixture." />
      )}

      {/* Main card */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
        {/* Category tabs */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex gap-2 text-sm overflow-x-auto">
          {(['all', ...ALL_CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`capitalize px-3 py-1.5 rounded-full border transition whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat === 'tool_log' ? 'Tool Log' : cat}
            </button>
          ))}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
              Loading memory…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
              No entries match your filter.
            </div>
          ) : (
            filtered.map(mem => (
              <div key={mem.id} className="bg-zinc-950 border border-zinc-800/50 rounded-lg p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize border ${categoryStyle[mem.category] ?? 'bg-zinc-800 text-zinc-400'}`}>
                      {mem.category === 'tool_log' ? 'tool log' : mem.category}
                    </span>
                    <h3 className="font-medium text-zinc-100">{mem.title}</h3>
                  </div>
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5 shrink-0 ml-3">
                    <BrainCircuit className="w-3 h-3" />
                    {mem.agentName}
                  </div>
                </div>

                <p className="text-sm text-zinc-300 mb-3">{mem.summary}</p>

                <div className="text-sm text-zinc-500 mb-4 bg-zinc-900/50 p-3 rounded-md border border-zinc-800/50">
                  {mem.details}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Database className="w-3.5 h-3.5" />
                    <span className="truncate max-w-xs">{mem.relatedFiles.join(', ')}</span>
                  </div>
                  <div className="text-zinc-600 shrink-0 ml-3">
                    {new Date(mem.timestamp).toLocaleString()}
                  </div>
                </div>

                {mem.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mem.tags.map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

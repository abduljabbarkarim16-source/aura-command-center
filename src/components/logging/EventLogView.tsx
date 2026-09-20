/**
 * EventLogView — live and historical view of the AURA event log.
 *
 * Two sources, deliberately distinguished:
 *  - Live: events from this app run, arriving as they happen.
 *  - Disk: the full file, including previous runs, read on demand.
 *
 * The distinction matters because a fault often survives a restart. Showing only the
 * live buffer would hide exactly the history needed to explain it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Download, Pause, Play, FolderOpen, AlertTriangle } from 'lucide-react';
import { eventLog } from '../../services/logging/EventLogService';
import type { AuraEvent, EventLogCategory, EventLogLevel } from '../../types/event-log';

const CATEGORIES: EventLogCategory[] = [
  'app', 'ui', 'mic', 'stt', 'chat', 'tts', 'tool', 'task', 'memory', 'state', 'net', 'error',
];

const LEVEL_STYLE: Record<EventLogLevel, string> = {
  debug: 'text-zinc-500',
  info: 'text-zinc-300',
  warn: 'text-amber-400',
  error: 'text-rose-400',
};

const CATEGORY_STYLE: Record<string, string> = {
  mic: 'bg-cyan-500/10 text-cyan-300',
  stt: 'bg-violet-500/10 text-violet-300',
  chat: 'bg-blue-500/10 text-blue-300',
  tts: 'bg-teal-500/10 text-teal-300',
  tool: 'bg-emerald-500/10 text-emerald-300',
  state: 'bg-indigo-500/10 text-indigo-300',
  ui: 'bg-zinc-700/40 text-zinc-300',
  error: 'bg-rose-500/10 text-rose-300',
};

function timeOf(iso: string): string {
  // Local time to the millisecond — voice faults are decided in tens of milliseconds,
  // and this has to line up with a screen recording's timeline.
  const d = new Date(iso);
  return `${d.toLocaleTimeString([], { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export function EventLogView() {
  const [events, setEvents] = useState<AuraEvent[]>(() => eventLog.recent());
  const [live, setLive] = useState(true);
  const [category, setCategory] = useState<'all' | EventLogCategory>('all');
  const [minLevel, setMinLevel] = useState<EventLogLevel>('info');
  const [query, setQuery] = useState('');
  const [info, setInfo] = useState<{ path: string; bytes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'live' | 'disk'>('live');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void eventLog.info_().then(i => { if (i) setInfo({ path: i.path, bytes: i.bytes }); });
  }, []);

  useEffect(() => {
    if (!live) return;
    return eventLog.subscribe(e => {
      setSource('live');
      setEvents(prev => [...prev.slice(-999), e]);
    });
  }, [live]);

  const loadFromDisk = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await eventLog.readFromDisk(3000);
      setEvents(rows);
      setSource('disk');
      setLive(false);
      const i = await eventLog.info_();
      if (i) setInfo({ path: i.path, bytes: i.bytes });
    } finally {
      setLoading(false);
    }
  }, []);

  const levelRank: Record<EventLogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(e => {
      if (category !== 'all' && e.category !== category) return false;
      if (levelRank[e.level] < levelRank[minLevel]) return false;
      if (!q) return true;
      return (
        e.event.toLowerCase().includes(q) ||
        e.category.includes(q) ||
        (e.turnId ?? '').includes(q) ||
        JSON.stringify(e.data ?? {}).toLowerCase().includes(q)
      );
    });
  }, [events, category, minLevel, query]);

  useEffect(() => {
    if (live) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [filtered.length, live]);

  const copyAll = useCallback(() => {
    const text = filtered.map(e => JSON.stringify(e)).join('\n');
    void navigator.clipboard.writeText(text);
  }, [filtered]);

  const writeError = eventLog.writeError();

  return (
    <div className="flex flex-col h-full gap-4">
      {writeError && (
        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg px-3 py-2 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            The log could not be written to disk ({writeError}). Events below are from memory
            only and will be lost when AURA closes.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setLive(v => !v); if (!live) setSource('live'); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
        >
          {live ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {live ? 'Pause' : 'Resume live'}
        </button>

        <button
          onClick={loadFromDisk}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Load full history
        </button>

        <button
          onClick={copyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
        >
          <Download className="w-3.5 h-3.5" />
          Copy shown
        </button>

        <select
          value={category}
          onChange={e => setCategory(e.target.value as 'all' | EventLogCategory)}
          className="px-2 py-1.5 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-zinc-200"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={minLevel}
          onChange={e => setMinLevel(e.target.value as EventLogLevel)}
          className="px-2 py-1.5 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-zinc-200"
        >
          <option value="debug">debug and up</option>
          <option value="info">info and up</option>
          <option value="warn">warnings and errors</option>
          <option value="error">errors only</option>
        </select>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search text, turn id, event name…"
          className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span>
          Showing {filtered.length} of {events.length} ({source === 'disk' ? 'full history' : 'this session'})
        </span>
        {info && (
          <span className="flex items-center gap-1 font-mono truncate" title={info.path}>
            <FolderOpen className="w-3 h-3 shrink-0" />
            {info.path} · {(info.bytes / 1024).toFixed(0)} KB
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-zinc-950 border border-zinc-800 rounded-xl overflow-y-auto font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 p-8 text-center">
            No events match these filters. Use AURA for a moment, or load the full history.
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {filtered.map(e => (
                <tr key={`${e.runId}-${e.seq}`} className="border-b border-zinc-900 align-top hover:bg-zinc-900/50">
                  <td className="px-3 py-1 text-zinc-600 whitespace-nowrap w-[96px]">{timeOf(e.ts)}</td>
                  <td className="px-1 py-1 w-[64px]">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${CATEGORY_STYLE[e.category] ?? 'bg-zinc-800 text-zinc-400'}`}>
                      {e.category}
                    </span>
                  </td>
                  <td className={`px-2 py-1 whitespace-nowrap ${LEVEL_STYLE[e.level]}`}>{e.event}</td>
                  <td className="px-2 py-1 text-zinc-500 break-all">
                    {e.data ? JSON.stringify(e.data) : ''}
                  </td>
                  <td className="px-2 py-1 text-zinc-700 whitespace-nowrap w-[110px]" title="Turn">
                    {e.turnId ? e.turnId.slice(-6) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

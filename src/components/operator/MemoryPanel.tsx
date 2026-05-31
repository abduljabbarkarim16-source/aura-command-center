/**
 * MemoryPanel — AURA Phase 3G (Milestone 3)
 *
 * Operator view of everything AURA remembers:
 *  - user profile (name, preferred name, voice/autonomy prefs)
 *  - saved facts (editable / deletable / pinnable)
 *  - capability gaps (from the registry)
 *  - active session thread summary
 *
 * Edits here are direct operator actions. (Model-proposed memory updates are
 * approval-gated in the tool layer — see ToolRegistryService memory.* tools.)
 */

import { useEffect, useState, useCallback } from 'react';
import { User, Pin, PinOff, Trash2, Archive, MessageSquare, Layers, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { auraMemoryService } from '../../services/memory/AuraMemoryService';
import { userProfileMemoryService } from '../../services/memory/UserProfileMemoryService';
import { sessionThreadService } from '../../services/session/SessionThreadService';
import { capabilityGapService } from '../../services/capabilities/CapabilityGapService';
import type { AuraMemory } from '../../types/aura-memory';
import type { UserProfile } from '../../types/aura-memory';
import type { SessionThread } from '../../types/session-thread';

export function MemoryPanel() {
  const [profile, setProfile] = useState<UserProfile>(() => userProfileMemoryService.get());
  const [memories, setMemories] = useState<AuraMemory[]>(() => auraMemoryService.getAll());
  const [threads, setThreads] = useState<SessionThread[]>(() => sessionThreadService.getAll());
  const [activeId, setActiveId] = useState<string | null>(() => sessionThreadService.getActiveId());
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => userProfileMemoryService.subscribe(setProfile), []);
  useEffect(() => auraMemoryService.subscribe(setMemories), []);
  useEffect(() => sessionThreadService.subscribe((t, a) => { setThreads(t); setActiveId(a); }), []);

  const saveName = useCallback(() => {
    if (nameDraft.trim()) userProfileMemoryService.setName(nameDraft.trim());
    setEditingName(false);
  }, [nameDraft]);

  const gap = capabilityGapService.report();
  const active = threads.find(t => t.id === activeId) ?? null;
  const activeMemories = memories.filter(m => m.status !== 'archived');
  const displayName = profile.preferredName || profile.name;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      {/* ── User profile ── */}
      <section className="px-3 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-1.5 mb-2">
          <User className="w-3 h-3 text-indigo-400" />
          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">Profile</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 w-16 shrink-0">Name</span>
          {editingName ? (
            <div className="flex items-center gap-1 flex-1">
              <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                placeholder="Your name"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 focus:outline-none focus:border-indigo-500" />
              <button onClick={saveName} className="p-0.5 text-emerald-400 hover:text-emerald-300"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingName(false)} className="p-0.5 text-zinc-500 hover:text-zinc-300"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => { setNameDraft(profile.name ?? ''); setEditingName(true); }}
              className="text-[11px] text-zinc-200 hover:text-indigo-300 transition-colors">
              {displayName || <span className="text-zinc-600 italic">not set — click to add</span>}
            </button>
          )}
        </div>
        {profile.voicePreference && <p className="text-[10px] text-zinc-500 mt-1">Voice: {profile.voicePreference}</p>}
        {profile.autonomyPreference && <p className="text-[10px] text-zinc-500 mt-0.5">Autonomy: {profile.autonomyPreference}</p>}
        {Object.keys(profile.uiPreferences).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(profile.uiPreferences).map(([k, v]) => (
              <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400 border border-zinc-700/50">{k}: {v}</span>
            ))}
          </div>
        )}
      </section>

      {/* ── Active session thread ── */}
      <section className="px-3 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-1.5 mb-2">
          <MessageSquare className="w-3 h-3 text-sky-400" />
          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">Session</span>
        </div>
        {active ? (
          <div className="text-[10px] text-zinc-400 leading-relaxed">
            <p className="text-zinc-300 font-medium truncate">{active.title}</p>
            <p className="text-zinc-600 font-mono text-[9px]">{active.id}</p>
            <p className="mt-0.5">{active.messageCount} msgs{active.compactedAt ? ' · compacted' : ''}</p>
            {active.summary && <p className="mt-1 text-zinc-500">{active.summary}</p>}
          </div>
        ) : (
          <p className="text-[10px] text-zinc-600 italic">No active thread.</p>
        )}
      </section>

      {/* ── Saved facts ── */}
      <section className="px-3 py-2.5 border-b border-zinc-800/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">Facts ({activeMemories.length})</span>
          </div>
        </div>
        <div className="space-y-1">
          {activeMemories.length === 0 && <p className="text-[10px] text-zinc-600 italic">No saved facts yet.</p>}
          {activeMemories.slice(0, 40).map(m => (
            <div key={m.id} className="group flex items-start gap-1.5 px-2 py-1 rounded bg-zinc-900/40 border border-zinc-800/40">
              <span className={cn('mt-0.5 text-[8px] px-1 py-0.5 rounded font-semibold shrink-0',
                m.category === 'personal' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-amber-500/15 text-amber-400')}>
                {m.category[0].toUpperCase()}
              </span>
              <span className="text-[10px] text-zinc-300 leading-snug flex-1">{m.content}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {m.status === 'pinned'
                  ? <button onClick={() => auraMemoryService.unpin(m.id)} title="Unpin" className="p-0.5 text-amber-400 hover:text-amber-300"><PinOff className="w-2.5 h-2.5" /></button>
                  : <button onClick={() => auraMemoryService.pin(m.id)} title="Pin" className="p-0.5 text-zinc-500 hover:text-amber-400"><Pin className="w-2.5 h-2.5" /></button>}
                <button onClick={() => auraMemoryService.archive(m.id)} title="Archive" className="p-0.5 text-zinc-500 hover:text-sky-400"><Archive className="w-2.5 h-2.5" /></button>
                <button onClick={() => auraMemoryService.delete(m.id)} title="Delete" className="p-0.5 text-zinc-500 hover:text-rose-400"><Trash2 className="w-2.5 h-2.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Capability gaps ── */}
      <section className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wide">What I can't do yet</span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed">{gap.text}</p>
      </section>
    </div>
  );
}

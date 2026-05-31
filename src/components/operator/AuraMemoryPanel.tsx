/**
 * AuraMemoryPanel — AURA Phase 3G
 *
 * View, edit, pin, and delete AURA's persistent memories.
 * Both personal and task memories displayed with source badges.
 */

import React, { Fragment, useState, useEffect } from 'react';
import {
  Brain, Pin, Trash2, Edit3, Check, X, User, Briefcase,
  Sparkles, RefreshCw, PlusCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { auraMemoryService } from '../../services/memory/AuraMemoryService';
import type { AuraMemory, MemoryCategory } from '../../types/aura-memory';

// ─── Memory row ───────────────────────────────────────────────────────────────

function MemoryRow({ memory, onPin, onDelete, onEdit }: {
  memory:   AuraMemory;
  onPin:    (id: string) => void;
  onDelete: (id: string) => void;
  onEdit:   (id: string, content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(memory.content);

  const saveEdit = () => {
    if (draft.trim() && draft.trim() !== memory.content) onEdit(memory.id, draft.trim());
    setEditing(false);
  };

  return (
    <div className={cn(
      'border rounded-lg px-3 py-2.5 space-y-1.5 transition-colors',
      memory.status === 'pinned'
        ? 'border-indigo-500/30 bg-indigo-500/5'
        : 'border-zinc-800/60 bg-zinc-900/30',
    )}>
      <div className="flex items-start gap-2">
        {/* Category icon */}
        <span className="mt-0.5 shrink-0">
          {memory.category === 'personal'
            ? <User className="w-3 h-3 text-sky-400" />
            : <Briefcase className="w-3 h-3 text-amber-400" />
          }
        </span>

        {/* Content */}
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
            className="flex-1 text-[11px] bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-zinc-200 outline-none"
          />
        ) : (
          <span className="flex-1 text-[11px] text-zinc-300 leading-relaxed">{memory.content}</span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {editing ? (
            <>
              <button onClick={saveEdit} className="p-1 text-emerald-400 hover:text-emerald-300">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 text-zinc-500 hover:text-zinc-300">
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onPin(memory.id)}
                title={memory.status === 'pinned' ? 'Unpin' : 'Pin — always inject into context'}
                className={cn('p-1 transition-colors', memory.status === 'pinned' ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400')}
              >
                <Pin className="w-3 h-3" />
              </button>
              <button onClick={() => { setDraft(memory.content); setEditing(true); }} className="p-1 text-zinc-600 hover:text-zinc-400">
                <Edit3 className="w-3 h-3" />
              </button>
              <button onClick={() => onDelete(memory.id)} className="p-1 text-zinc-600 hover:text-red-400">
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 pl-5">
        <span className={cn(
          'text-[9px] px-1.5 py-0.5 rounded-full border font-medium',
          memory.source === 'explicit'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-zinc-800 border-zinc-700 text-zinc-500',
        )}>
          {memory.source === 'explicit' ? 'saved' : 'auto'}
        </span>
        {memory.status === 'pinned' && (
          <span className="text-[9px] text-indigo-400 font-medium">pinned</span>
        )}
        {memory.usageCount > 0 && (
          <span className="text-[9px] text-zinc-600">used {memory.usageCount}×</span>
        )}
      </div>
    </div>
  );
}

// ─── Add memory form ──────────────────────────────────────────────────────────

function AddMemoryForm({ onAdd }: { onAdd: (cat: MemoryCategory, content: string) => void }) {
  const [open,    setOpen]    = useState(false);
  const [content, setContent] = useState('');
  const [cat,     setCat]     = useState<MemoryCategory>('personal');

  const submit = () => {
    if (!content.trim()) return;
    onAdd(cat, content.trim());
    setContent('');
    setOpen(false);
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      <PlusCircle className="w-3.5 h-3.5" /> Add memory manually
    </button>
  );

  return (
    <div className="border border-zinc-700/60 rounded-lg p-3 space-y-2 bg-zinc-900/50">
      <div className="flex gap-2">
        {(['personal', 'task'] as MemoryCategory[]).map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              'px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors',
              cat === c
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300',
            )}
          >
            {c === 'personal' ? '👤 Personal' : '🗂 Task'}
          </button>
        ))}
      </div>
      <input
        autoFocus
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder={cat === 'personal' ? 'e.g. Prefers direct answers' : 'e.g. Using gpt-4o-mini for fast mode'}
        className="w-full text-[11px] bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/60"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="px-3 py-1 rounded text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
          Save
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1 rounded text-[11px] text-zinc-500 hover:text-zinc-300 border border-zinc-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function AuraMemoryPanel() {
  const [memories,   setMemories]   = useState<AuraMemory[]>([]);
  const [filter,     setFilter]     = useState<'all' | 'personal' | 'task'>('all');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => auraMemoryService.subscribe(setMemories), []);

  const visible = memories.filter(m => {
    if (!showArchived && m.status === 'archived') return false;
    if (filter === 'personal') return m.category === 'personal';
    if (filter === 'task')     return m.category === 'task';
    return true;
  });

  const personal = memories.filter(m => m.status !== 'archived' && m.category === 'personal').length;
  const task     = memories.filter(m => m.status !== 'archived' && m.category === 'task').length;

  return (
    <div className="h-full flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-4">

        {/* Header stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/10 border border-sky-500/20 rounded-full">
            <User className="w-3 h-3 text-sky-400" />
            <span className="text-[10px] text-sky-400 font-semibold">{personal} personal</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
            <Briefcase className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-400 font-semibold">{task} task</span>
          </div>
          <button
            onClick={() => auraMemoryService.clearAuto()}
            title="Clear auto-extracted memories (keeps pinned + explicit)"
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" /> Clear auto
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(['all', 'personal', 'task'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors capitalize',
                filter === f
                  ? 'bg-zinc-700 border-zinc-600 text-zinc-200'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Memory list */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Brain className="w-8 h-8 text-zinc-700" />
            <p className="text-[11px] text-zinc-600">No memories yet.</p>
            <p className="text-[10px] text-zinc-700">AURA extracts facts automatically from conversations.<br />You can also save them manually below.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(m => (
              <Fragment key={m.id}>
                <MemoryRow
                  memory={m}
                  onPin={id => m.status === 'pinned' ? auraMemoryService.unpin(id) : auraMemoryService.pin(id)}
                  onDelete={id => auraMemoryService.delete(id)}
                  onEdit={(id, content) => auraMemoryService.update(id, { content })}
                />
              </Fragment>
            ))}
          </div>
        )}

        {/* Add manually */}
        <AddMemoryForm
          onAdd={(cat, content) => auraMemoryService.add({ category: cat, source: 'explicit', content })}
        />

        {/* Show archived toggle */}
        {memories.some(m => m.status === 'archived') && (
          <button
            onClick={() => setShowArchived(p => !p)}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
        )}

        {/* Explanation */}
        <p className="text-[10px] text-zinc-700 leading-relaxed border-t border-zinc-800/60 pt-3">
          Pinned memories are always injected into AURA's context. Auto memories are extracted silently after each turn. Explicit memories are saved when you click "Remember this" or add them here.
        </p>

      </div>
    </div>
  );
}

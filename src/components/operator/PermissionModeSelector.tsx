/**
 * PermissionModeSelector — AURA Phase 3G (Milestone 12)
 *
 * Compact selector for the active permission mode. Visible but small; affects
 * ToolRegistryService execution decisions via PermissionModeService.
 */

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, ChevronDown, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { permissionModeService } from '../../services/permissions/PermissionModeService';
import { PERMISSION_MODE_META, type PermissionMode } from '../../types/permission-mode';

const TONE: Record<string, string> = {
  emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  sky:     'text-sky-400 border-sky-500/30 bg-sky-500/10',
  amber:   'text-amber-400 border-amber-500/30 bg-amber-500/10',
  zinc:    'text-zinc-400 border-zinc-600/40 bg-zinc-700/20',
};

// Static dot classes (Tailwind can't see dynamically-built class names).
const DOT: Record<string, string> = {
  emerald: 'bg-emerald-400',
  sky:     'bg-sky-400',
  amber:   'bg-amber-400',
  zinc:    'bg-zinc-400',
};

export function PermissionModeSelector() {
  const [mode, setMode] = useState<PermissionMode>(() => permissionModeService.getMode());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => permissionModeService.subscribe(setMode), []);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const meta = PERMISSION_MODE_META[mode];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} title={meta.description}
        className={cn('flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold transition-colors', TONE[meta.tone])}>
        {mode === 'locked' ? <Lock className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
        {meta.label}
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-60 z-50 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1">
          {(Object.values(PERMISSION_MODE_META)).map(m => (
            <button key={m.id} onClick={() => { permissionModeService.setMode(m.id); setOpen(false); }}
              className={cn('w-full text-left px-2.5 py-1.5 hover:bg-zinc-800/70 transition-colors', m.id === mode && 'bg-zinc-800/50')}>
              <div className="flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', DOT[m.tone])} />
                <span className={cn('text-[11px] font-semibold', TONE[m.tone].split(' ')[0])}>{m.label}</span>
                {m.id === mode && <span className="ml-auto text-[9px] text-zinc-500">active</span>}
              </div>
              <p className="text-[9px] text-zinc-500 mt-0.5 leading-snug">{m.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

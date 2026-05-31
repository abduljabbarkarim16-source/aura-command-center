import { Keyboard, Orbit, ShieldCheck } from 'lucide-react';
import { RuntimeTaskBadge } from './operator/RuntimeTaskBadge';
import { APP_PHASE, APP_PHASE_LABEL, VERSION_DISPLAY } from '../lib/appVersion';

export function TopBar() {
  return (
    <header className="z-10 flex h-14 w-full shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/80 px-5 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
          <Orbit className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-zinc-200">AURA Command Center</p>
          <p className="truncate text-[10px] text-zinc-600">{VERSION_DISPLAY} - {APP_PHASE_LABEL}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-1.5 text-[11px] text-zinc-600 sm:flex">
          <Keyboard className="h-3.5 w-3.5" />
          <kbd className="rounded border border-zinc-700/50 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            Ctrl+K
          </kbd>
        </div>

        <div className="hidden h-4 w-px bg-zinc-800 sm:block" />

        <RuntimeTaskBadge />

        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800/70 bg-zinc-950/55 px-2.5 py-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span className="hidden text-[11px] font-medium text-zinc-400 md:inline">{APP_PHASE}</span>
          <span className="text-[11px] font-medium text-zinc-500">UI branch</span>
        </div>
      </div>
    </header>
  );
}

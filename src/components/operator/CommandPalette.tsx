import React, { useEffect, useState } from 'react';
import { Search, Terminal, ArrowRight, X, Briefcase, Orbit, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800/60">
          <Search className="w-5 h-5 text-zinc-500" />
          <input 
            autoFocus
            type="text" 
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none focus:outline-none text-zinc-100 placeholder:text-zinc-500 text-lg"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded-md font-sans font-medium border border-zinc-700/50">ESC</kbd>
          </div>
        </div>

        {/* Results */}
        <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          
          <div className="px-3 py-2 text-xs font-semibold text-zinc-500 tracking-wider uppercase">Actions</div>
          
          <CommandItem icon={<Terminal className="w-4 h-4 text-indigo-400" />} title="Continue current task" />
          <CommandItem icon={<Briefcase className="w-4 h-4 text-emerald-400" />} title="Show approvals" />
          <CommandItem icon={<ArrowRight className="w-4 h-4 text-amber-400" />} title="Open Relay" />
          <CommandItem icon={<Settings className="w-4 h-4 text-zinc-400" />} title="Open technical drawer" />
          
          <div className="px-3 py-2 mt-2 text-xs font-semibold text-zinc-500 tracking-wider uppercase">System</div>
          
          <CommandItem icon={<Orbit className="w-4 h-4 text-rose-400" />} title="Start voice mode" />
          <CommandItem icon={<Settings className="w-4 h-4 text-blue-400" />} title="Switch active agent" />

        </div>
      </div>
    </div>
  );
}

function CommandItem({ icon, title }: { icon: React.ReactNode, title: string }) {
  return (
    <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-zinc-800/60 text-left transition-colors group">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/50 group-hover:bg-zinc-900 group-hover:border-zinc-700 transition-colors">
          {icon}
        </div>
        <span className="text-zinc-200 font-medium group-hover:text-white transition-colors">{title}</span>
      </div>
      <span className="opacity-0 group-hover:opacity-100 text-zinc-500 text-xs font-medium transition-opacity flex items-center gap-1">
        Action <ArrowRight className="w-3 h-3" />
      </span>
    </button>
  );
}

import { Folders, Bot, ChevronDown, Keyboard } from 'lucide-react';
import { mockProjects, mockAgents } from '../store/mockData';
import { RuntimeTaskBadge } from './operator/RuntimeTaskBadge';

export function TopBar() {
  const activeProj = mockProjects[0];
  const activeAgent = mockAgents.find(a => a.id === activeProj.activeAgentId) ?? mockAgents[0];

  const agentStatusColor: Record<string, string> = {
    idle:    'bg-zinc-500',
    working: 'bg-amber-400 animate-pulse',
    error:   'bg-rose-500',
  };

  return (
    <header className="h-14 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800/60 flex items-center justify-between px-5 shrink-0 z-10 w-full">

      {/* Left: project switcher */}
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 rounded-lg cursor-pointer transition-colors group">
          <Folders className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          <span className="text-[13px] font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
            {activeProj.name}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 ml-1 transition-colors" />
        </button>
      </div>

      {/* Right: keyboard hint + active agent */}
      <div className="flex items-center gap-3">


        <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
        
        {/* Runtime Task Badge */}
        <RuntimeTaskBadge />

        {/* Active agent pill */}
        <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg cursor-pointer transition-all group">
          <Bot className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[13px] font-medium text-indigo-300">{activeAgent.name}</span>
          <div className={`w-2 h-2 rounded-full ml-0.5 flex-shrink-0 ${agentStatusColor[activeAgent.status] ?? 'bg-zinc-500'}`} />
        </button>
      </div>
    </header>
  );
}

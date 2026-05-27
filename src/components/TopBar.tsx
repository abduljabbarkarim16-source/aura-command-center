import { Folders, Bot, ChevronDown } from 'lucide-react';
import { mockProjects, mockAgents } from '../store/mockData';

export function TopBar() {
  const activeProj = mockProjects[0];
  const activeAgent = mockAgents.find(a => a.id === activeProj.activeAgentId) || mockAgents[0];

  return (
    <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0 z-10 w-full">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md cursor-pointer hover:border-zinc-700 transition">
          <Folders className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-200">{activeProj.name}</span>
          <ChevronDown className="w-4 h-4 text-zinc-500 ml-2" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-xs text-zinc-500 font-mono">
          Model: {activeAgent.model}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md cursor-pointer hover:bg-indigo-500/20 transition">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-indigo-300">{activeAgent.name}</span>
          <div className="w-2 h-2 rounded-full bg-amber-400 ml-1 animate-pulse"></div>
        </div>
      </div>
    </header>
  );
}

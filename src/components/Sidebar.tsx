import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Bot, TerminalSquare, BrainCircuit, BringToFront, Link2, FileCog, Settings, Orbit, Workflow, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { name: 'Console', path: '/', icon: TerminalSquare },
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', path: '/projects', icon: FolderKanban },
  { name: 'Agents', path: '/agents', icon: Bot },
  { name: 'Relay', path: '/relay', icon: Workflow },
  { name: 'Memory', path: '/memory', icon: BrainCircuit },
  { name: 'Handoffs', path: '/handoffs', icon: BringToFront },
  { name: 'MCP Connectors', path: '/connectors', icon: Link2 },
  { name: 'Tool Logs', path: '/logs', icon: FileCog },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col h-screen text-zinc-300">
      <div className="h-[4.25rem] flex items-center px-6 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-inner flex items-center justify-center">
            <Orbit className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-zinc-100 tracking-tight text-lg">AURA</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1.5 custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium border border-transparent',
                isActive 
                  ? 'bg-zinc-900/80 text-white shadow-sm border-zinc-800' 
                  : 'hover:bg-zinc-900/40 hover:text-zinc-100 text-zinc-400'
              )
            }
          >
            <item.icon className={cn("w-4 h-4 transition-colors", "opacity-80")} />
            {item.name}
          </NavLink>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-800/60 bg-zinc-950/80 shrink-0">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">System Status</span>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Online & Monitoring
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

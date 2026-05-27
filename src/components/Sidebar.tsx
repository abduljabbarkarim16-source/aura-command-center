import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Bot, TerminalSquare, BrainCircuit, BringToFront, Link2, FileCog, Settings, Orbit, Workflow } from 'lucide-react';
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
      <div className="h-16 flex items-center px-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center">
            <Orbit className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-zinc-100 tracking-tight">AURA</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium',
                isActive 
                  ? 'bg-zinc-800 text-white' 
                  : 'hover:bg-zinc-800/50 hover:text-zinc-100 text-zinc-400'
              )
            }
          >
            <item.icon className="w-4 h-4" />
            {item.name}
          </NavLink>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-800 text-xs text-zinc-600 flex flex-col gap-1 items-center justify-center">
        <span>AURA Command Center</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          System Online
        </span>
      </div>
    </aside>
  );
}

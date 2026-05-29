import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Bot, TerminalSquare, BrainCircuit, BringToFront, Link2, FileCog, Settings, Orbit, Workflow, ShieldCheck, PanelLeftClose, PanelLeft, PlaySquare } from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { name: 'Console', path: '/', icon: TerminalSquare },
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', path: '/projects', icon: FolderKanban },
  { name: 'Agents', path: '/agents', icon: Bot },
  { name: 'Relay', path: '/relay', icon: Workflow },
  { name: 'Commands', path: '/commands', icon: PlaySquare },
  { name: 'Memory', path: '/memory', icon: BrainCircuit },
  { name: 'Handoffs', path: '/handoffs', icon: BringToFront },
  { name: 'MCP Connectors', path: '/connectors', icon: Link2 },
  { name: 'Tool Logs', path: '/logs', icon: FileCog },
  { name: 'Settings', path: '/settings', icon: Settings },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  return (
    <aside className={cn(
      "bg-zinc-950 border-r border-zinc-800/60 flex flex-col h-screen text-zinc-300 transition-all duration-300 ease-in-out z-20 shrink-0",
      isCollapsed ? "w-[4.25rem]" : "w-64"
    )}>
      {/* Header */}
      <div className={cn(
        "h-[4.25rem] flex items-center border-b border-zinc-800/60 shrink-0 transition-all",
        isCollapsed ? "justify-center px-0" : "px-6 justify-between"
      )}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-inner flex items-center justify-center shrink-0">
            <Orbit className="w-4 h-4 text-white" />
          </div>
          {!isCollapsed && <span className="font-semibold text-zinc-100 tracking-tight text-lg whitespace-nowrap">AURA</span>}
        </div>
        
        {!isCollapsed && (
          <button onClick={onToggle} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Navigation */}
      <div className={cn("flex-1 overflow-y-auto py-6 flex flex-col gap-1.5 custom-scrollbar", isCollapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-xl transition-all duration-200 font-medium border border-transparent overflow-hidden',
                isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5 text-sm',
                isActive 
                  ? 'bg-zinc-900/80 text-white shadow-sm border-zinc-800' 
                  : 'hover:bg-zinc-900/40 hover:text-zinc-100 text-zinc-400'
              )
            }
          >
            <item.icon className={cn("shrink-0 transition-colors opacity-80", isCollapsed ? "w-5 h-5" : "w-4 h-4")} />
            {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
          </NavLink>
        ))}
      </div>

      {/* Footer Status */}
      <div className={cn("border-t border-zinc-800/60 bg-zinc-950/80 shrink-0", isCollapsed ? "p-3" : "p-4")}>
        {isCollapsed ? (
          <button 
            onClick={onToggle}
            title="Expand Sidebar"
            className="w-full flex items-center justify-center p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg transition-colors"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        ) : (
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
        )}
      </div>
    </aside>
  );
}

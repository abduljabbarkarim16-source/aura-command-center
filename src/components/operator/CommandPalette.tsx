/**
 * CommandPalette — Phase 2E Deep Refinement
 *
 * Ctrl+K global command palette with navigation, actions, and system commands.
 */

import { useEffect, useState, useMemo, Fragment, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Terminal, Workflow, Settings,
  LayoutDashboard, FolderKanban, BrainCircuit, BringToFront,
  Bot, Mic, ShieldCheck, Network, MemoryStick, ChevronRight,
  Activity, Link2, Eye, Bell, Webhook
} from 'lucide-react';

// ─── Command definitions ──────────────────────────────────────────────────────

interface Command {
  id: string;
  group: string;
  icon: ReactNode;
  title: string;
  description?: string;
  action?: 'navigate' | 'toggle' | 'info';
  path?: string;
  shortcut?: string;
}

const ALL_COMMANDS: Command[] = [
  // Navigation
  { id: 'nav-console',    group: 'Navigate',  icon: <Terminal className="w-4 h-4 text-indigo-400" />,    title: 'Go to Console',          description: 'Open the main assistant canvas', action: 'navigate', path: '/'          },
  { id: 'nav-dashboard',  group: 'Navigate',  icon: <LayoutDashboard className="w-4 h-4 text-zinc-400" />, title: 'Go to Dashboard',        description: 'Operations overview',            action: 'navigate', path: '/dashboard' },
  { id: 'nav-projects',   group: 'Navigate',  icon: <FolderKanban className="w-4 h-4 text-emerald-400" />, title: 'Go to Projects',         description: 'Mission workspaces',             action: 'navigate', path: '/projects'  },
  { id: 'nav-relay',      group: 'Navigate',  icon: <Workflow className="w-4 h-4 text-amber-400" />,      title: 'Go to Relay',            description: 'Approval-gated reasoning relay',  action: 'navigate', path: '/relay'     },
  { id: 'nav-memory',     group: 'Navigate',  icon: <BrainCircuit className="w-4 h-4 text-sky-400" />,    title: 'Go to Memory',           description: 'Persistent agent memory',        action: 'navigate', path: '/memory'    },
  { id: 'nav-handoffs',   group: 'Navigate',  icon: <BringToFront className="w-4 h-4 text-violet-400" />, title: 'Go to Handoffs',         description: 'Agent handoff tracker',          action: 'navigate', path: '/handoffs'  },
  { id: 'nav-agents',     group: 'Navigate',  icon: <Bot className="w-4 h-4 text-zinc-400" />,            title: 'Go to Agents',           description: 'Agent fleet',                    action: 'navigate', path: '/agents'    },
  { id: 'nav-connectors', group: 'Navigate',  icon: <Link2 className="w-4 h-4 text-zinc-400" />,          title: 'Go to MCP Connectors',   description: 'Connector management',           action: 'navigate', path: '/connectors'},
  { id: 'nav-make',       group: 'Navigate',  icon: <Webhook className="w-4 h-4 text-indigo-400" />,      title: 'Open Make Connector',    description: 'Make.com scenario settings',     action: 'navigate', path: '/settings'  },
  { id: 'nav-settings',   group: 'Navigate',  icon: <Settings className="w-4 h-4 text-zinc-400" />,       title: 'Go to Settings',         description: 'App configuration',             action: 'navigate', path: '/settings'  },

  // Actions
  { id: 'act-continue',   group: 'Actions',   icon: <Terminal className="w-4 h-4 text-indigo-400" />,     title: 'Continue current task',  description: 'Resume the active agent mission'  },
  { id: 'act-approvals',  group: 'Actions',   icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, title: 'Show approvals',         description: 'View pending approval requests'   },
  { id: 'act-relay',      group: 'Actions',   icon: <Workflow className="w-4 h-4 text-amber-400" />,      title: 'Create new relay',       description: 'Draft an approval-gated relay packet' },
  { id: 'act-memory',     group: 'Actions',   icon: <MemoryStick className="w-4 h-4 text-sky-400" />,     title: 'Show memory',            description: 'Browse persistent memory entries'  },
  { id: 'act-technical',  group: 'Actions',   icon: <Settings className="w-4 h-4 text-zinc-400" />,       title: 'Toggle technical details', description: 'Open/close the technical drawer'  },
  { id: 'act-make-dryrun',group: 'Actions',   icon: <Webhook className="w-4 h-4 text-indigo-400" />,      title: 'Dry-run Make payload',   description: 'Test a simulated Make.com webhook' },

  // System
  { id: 'sys-voice',      group: 'System',    icon: <Mic      className="w-4 h-4 text-rose-400" />,        title: 'Start voice mode',           description: 'Activate voice input'                      },
  { id: 'sys-agent',      group: 'System',    icon: <Bot      className="w-4 h-4 text-blue-400" />,        title: 'Switch active agent',        description: 'Change the primary agent for this session'  },
  { id: 'sys-status',     group: 'System',    icon: <Activity className="w-4 h-4 text-emerald-400" />,    title: 'Provider status',            description: 'Review connected provider status'           },
  { id: 'sys-safe-mode',  group: 'System',    icon: <Eye      className="w-4 h-4 text-amber-400" />,       title: 'Toggle safe monitor mode',   description: 'AURA observes without executing actions'    },
  { id: 'sys-notifs',     group: 'System',    icon: <Bell     className="w-4 h-4 text-indigo-400" />,      title: 'Open notifications',         description: 'View recent alerts and approvals'          },
  { id: 'sys-dispatcher', group: 'System',    icon: <Network  className="w-4 h-4 text-zinc-500" />,        title: 'Dispatcher Mode',            description: 'Autonomous multi-agent mode — planned'      },
];

// ─── CommandPalette ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery]   = useState('');
  const navigate            = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_COMMANDS;
    const q = query.toLowerCase();
    return ALL_COMMANDS.filter(
      c =>
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q)
    );
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const cmd of filtered) {
      if (!map.has(cmd.group)) map.set(cmd.group, []);
      map.get(cmd.group)!.push(cmd);
    }
    return map;
  }, [filtered]);

  function executeCommand(cmd: Command) {
    if (cmd.action === 'navigate' && cmd.path) {
      navigate(cmd.path);
    }
    setIsOpen(false);
    setQuery('');
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
        onClick={() => { setIsOpen(false); setQuery(''); }}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Search header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800/60">
          <Search className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search commands or navigate…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none focus:outline-none text-zinc-100 placeholder:text-zinc-500 text-[16px]"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[11px] rounded font-mono border border-zinc-700/50">ESC</kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
          {groups.size === 0 ? (
            <div className="flex items-center justify-center py-10 text-zinc-600 text-sm">
              No commands match "{query}"
            </div>
          ) : (
            Array.from(groups.entries()).map(([group, cmds]) => (
              <div key={group} className="mb-2">
                <div className="px-3 py-2 text-[10px] font-semibold text-zinc-500 tracking-widest uppercase">
                  {group}
                </div>
                {cmds.map(cmd => (
                  <Fragment key={cmd.id}>
                    <CommandItem cmd={cmd} onExecute={executeCommand} />
                  </Fragment>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800/40 bg-zinc-950/30">
          <span className="text-[11px] text-zinc-600">
            {filtered.length} command{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-3 text-[11px] text-zinc-600">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>ESC close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CommandItem ──────────────────────────────────────────────────────────────

function CommandItem({ cmd, onExecute }: { cmd: Command; onExecute: (c: Command) => void }) {
  return (
    <button
      onClick={() => onExecute(cmd)}
      className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-zinc-800/60 text-left transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/40 group-hover:border-zinc-600/60 transition-colors flex-shrink-0">
          {cmd.icon}
        </div>
        <div className="min-w-0">
          <span className="block text-[14px] text-zinc-200 font-medium group-hover:text-white transition-colors">
            {cmd.title}
          </span>
          {cmd.description && (
            <span className="block text-[11px] text-zinc-600 group-hover:text-zinc-500 transition-colors truncate">
              {cmd.description}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
    </button>
  );
}

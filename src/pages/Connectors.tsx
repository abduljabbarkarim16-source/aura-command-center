import { mockConnectors } from '../store/mockData';
import { Link2, Github, HardDrive, Edit2, Play, Square } from 'lucide-react';
import { DataSourceNotice } from '../components/common/DataSourceNotice';

export function Connectors() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">MCP Connectors</h1>
          <p className="text-zinc-400 text-sm">Model Context Protocol tools and permissions</p>
        </div>
        <button className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md text-sm font-medium transition">
          <Link2 className="w-4 h-4" />
          Add Connector
        </button>
      </div>

      <DataSourceNotice detail="Connector cards and Start/Stop controls are demo state until MCP process management is wired to the desktop backend." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockConnectors.map(conn => (
          <div key={conn.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                  {conn.id === 'mcp-github' ? <Github className="w-5 h-5 text-white" /> : <HardDrive className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="font-medium text-white">{conn.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${conn.status === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                    <span className="text-xs text-zinc-500 capitalize">{conn.status}</span>
                  </div>
                </div>
              </div>
              <button className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 transition">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3 mb-4 font-mono text-xs text-zinc-400 overflow-x-auto whitespace-nowrap">
              $ {conn.command} {conn.args.join(' ')}
            </div>

            <div className="mb-4">
              <div className="text-zinc-500 mb-2 text-xs">Allowed Agents</div>
              <div className="flex flex-wrap gap-2">
                {conn.allowedAgents.map(a => (
                  <span key={a} className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                    {a.replace('agent-', '')}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-800/50">
              <button className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                conn.status === 'connected' 
                  ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}>
                {conn.status === 'connected' ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {conn.status === 'connected' ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

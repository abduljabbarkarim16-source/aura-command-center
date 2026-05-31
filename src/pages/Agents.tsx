import { mockAgents } from '../store/mockData';
import { Bot, Settings2, Power } from 'lucide-react';
import { DataSourceNotice } from '../components/common/DataSourceNotice';

export function Agents() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Agents & Adapters</h1>
          <p className="text-zinc-400 text-sm">Configure AI providers and routing capabilities</p>
        </div>
      </div>

      <DataSourceNotice detail="Agent cards are currently rendered from local mock data. Provider key status and smoke tests live in Settings." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mockAgents.map(agent => (
          <div key={agent.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  agent.provider === 'openai' ? 'bg-green-500/10 text-green-400' :
                  agent.provider === 'anthropic' ? 'bg-orange-500/10 text-orange-400' :
                  agent.provider === 'gemini' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-zinc-800 text-zinc-400'
                }`}>
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-white flex items-center gap-2">
                    {agent.name}
                    {!agent.enabled && <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-zinc-800 text-zinc-500">Disabled</span>}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5 capitalize">{agent.provider} • {agent.model}</p>
                </div>
              </div>
              <button className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 transition">
                <Settings2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-zinc-500 mb-1 text-xs">Max Context</div>
                  <div className="text-zinc-200 font-mono">{(agent.maxContextTokens / 1000).toFixed(0)}k tkns</div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-1 text-xs">Cost Est.</div>
                  <div className="text-zinc-200 font-mono">${agent.costInputPerMillion}/1M</div>
                </div>
              </div>

              <div>
                <div className="text-zinc-500 mb-2 text-xs">Capabilities / Tools</div>
                <div className="flex flex-wrap gap-2">
                  {agent.availableTools.map(tool => (
                    <span key={tool} className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-zinc-800/50 flex justify-end">
              <button className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                agent.enabled 
                  ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              }`}>
                <Power className="w-4 h-4" />
                {agent.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

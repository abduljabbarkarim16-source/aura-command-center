import { mockMemory } from '../store/mockData';
import { Search, Filter, Database, BrainCircuit } from 'lucide-react';

export function Memory() {
  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Project Memory</h1>
          <p className="text-zinc-400 text-sm">Long-term context, decisions, and knowledge base</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search memory..." 
              className="bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button className="p-2 border border-zinc-800 bg-zinc-900 rounded-md text-zinc-400 hover:text-white transition">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex gap-4 text-sm overflow-x-auto">
          {['all', 'decision', 'error', 'fix', 'task'].map(cat => (
            <button key={cat} className={`capitalize px-3 py-1.5 rounded-full border transition whitespace-nowrap ${
              cat === 'all' 
                ? 'bg-zinc-800 border-zinc-700 text-white' 
                : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mockMemory.map(mem => (
            <div key={mem.id} className="bg-zinc-950 border border-zinc-800/50 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                    mem.category === 'decision' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                    mem.category === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    'bg-zinc-800 text-zinc-400'
                  } border`}>
                    {mem.category}
                  </div>
                  <h3 className="font-medium text-zinc-100">{mem.title}</h3>
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-2">
                  <BrainCircuit className="w-3 h-3" />
                  {mem.agentName}
                </div>
              </div>
              
              <p className="text-sm text-zinc-300 mb-3">{mem.summary}</p>
              
              <div className="text-sm text-zinc-500 mb-4 bg-zinc-900/50 p-3 rounded-md border border-zinc-800/50">
                {mem.details}
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-2 text-zinc-500">
                  <Database className="w-4 h-4" />
                  {mem.relatedFiles.join(', ')}
                </div>
                <div className="text-zinc-600">
                  {new Date(mem.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

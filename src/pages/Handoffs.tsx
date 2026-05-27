import { mockHandoffs } from '../store/mockData';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';

export function Handoffs() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Agent Handoffs</h1>
        <p className="text-zinc-400 text-sm">Transfer summaries between providers</p>
      </div>

      <div className="space-y-4">
        {mockHandoffs.map(ho => (
          <div key={ho.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-800/50 font-mono text-sm">
              <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-md text-indigo-400">
                {ho.fromAgentId}
              </div>
              <ArrowRightLeft className="w-5 h-5 text-zinc-500" />
              <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-md text-emerald-400">
                {ho.toAgentId || 'Manual Triage'}
              </div>
              <div className="ml-auto text-zinc-500 text-xs">
                {new Date(ho.timestamp).toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <div className="space-y-6">
                <div>
                  <h4 className="text-zinc-500 font-medium mb-2 text-xs uppercase tracking-wider">Goal</h4>
                  <p className="text-zinc-300">{ho.goal}</p>
                </div>
                <div>
                  <h4 className="text-zinc-500 font-medium mb-2 text-xs uppercase tracking-wider">Completed Tasks</h4>
                  <ul className="list-disc list-inside text-emerald-400 space-y-1">
                    {ho.completedTasks.map((t, i) => <li key={i}><span className="text-zinc-300">{t}</span></li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="text-zinc-500 font-medium mb-2 text-xs uppercase tracking-wider">Failed Tasks</h4>
                  <ul className="list-disc list-inside text-rose-400 space-y-1">
                    {ho.failedTasks.map((t, i) => <li key={i}><span className="text-zinc-300">{t}</span></li>)}
                  </ul>
                </div>
              </div>

              <div className="space-y-6 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/50">
                <div>
                  <h4 className="text-zinc-500 font-medium mb-2 text-xs uppercase tracking-wider">Next Recommended Action</h4>
                  <p className="text-indigo-300 font-medium">{ho.nextRecommendedAction}</p>
                </div>
                
                {ho.warnings && ho.warnings.length > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-md p-3">
                    <div className="flex items-center gap-2 text-rose-400 font-medium mb-2 text-xs uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4" />
                      Warnings
                    </div>
                    <ul className="space-y-1">
                      {ho.warnings.map((w, i) => <li key={i} className="text-rose-300 text-sm">{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

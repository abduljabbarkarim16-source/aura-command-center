import { useEffect, useState } from 'react';
import { mockHandoffs } from '../store/mockData';
import { ArrowRightLeft, AlertTriangle, GitBranch, ListTodo, ShieldAlert } from 'lucide-react';
import { handoffService } from '../services/handoff/HandoffService';
import type { Handoff } from '../types/handoff';

export function Handoffs() {
  const [realHandoffs, setRealHandoffs] = useState<Handoff[]>([]);

  useEffect(() => {
    handoffService.listHandoffs().then(setRealHandoffs);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Agent Handoffs</h1>
        <p className="text-zinc-400 text-sm">Active transfers and memory integration between providers</p>
      </div>

      <div className="space-y-4">
        {realHandoffs.map(ho => (
          <div key={ho.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-800/50 font-mono text-sm">
              <div className="bg-zinc-950 border border-indigo-500/20 px-3 py-1.5 rounded-md text-indigo-400 capitalize">
                {ho.sourceAgentId || ho.sourceType}
              </div>
              <ArrowRightLeft className="w-5 h-5 text-zinc-500" />
              <div className="bg-zinc-950 border border-emerald-500/20 px-3 py-1.5 rounded-md text-emerald-400 capitalize">
                {ho.targetAgentId || ho.targetType}
              </div>
              
              <div className="ml-auto flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                  ho.priority === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                  ho.priority === 'high'     ? 'bg-amber-500/20 text-amber-400' :
                  'bg-zinc-800 text-zinc-400'
                }`}>
                  {ho.priority}
                </span>
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider px-2 py-0.5 border border-zinc-800 rounded">
                  {ho.status.replace(/_/g, ' ')}
                </span>
                <div className="text-zinc-500 text-xs">
                  {new Date(ho.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <div className="space-y-6">
                <div>
                  <h4 className="text-zinc-500 font-medium mb-2 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    Objective / Title
                  </h4>
                  <p className="text-zinc-200 font-medium">{ho.title}</p>
                  <p className="text-zinc-400 mt-1 text-sm">{ho.objective}</p>
                </div>
                {ho.originalRelayPacketId && (
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded">
                      <GitBranch className="w-3.5 h-3.5" />
                      From Relay: {ho.originalRelayPacketId}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                  <h4 className="text-zinc-500 font-medium mb-2 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <ListTodo className="w-4 h-4 text-indigo-400" />
                    Next Actions ({ho.nextActions.length})
                  </h4>
                  {ho.nextActions.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-indigo-300">
                      {ho.nextActions.map((a, i) => <li key={i}><span className="text-zinc-300">{a}</span></li>)}
                    </ul>
                  ) : (
                    <span className="text-zinc-600 text-sm">No actions specified.</span>
                  )}
                </div>

                <div className="bg-rose-950/20 p-4 rounded-lg border border-rose-900/30">
                  <h4 className="text-zinc-500 font-medium mb-2 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Risks & Constraints ({ho.risks.length})
                  </h4>
                  {ho.risks.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-rose-400">
                      {ho.risks.map((r, i) => <li key={i}><span className="text-rose-300/80">{r}</span></li>)}
                    </ul>
                  ) : (
                    <span className="text-zinc-600 text-sm">No risks identified.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Mock Data Section */}
        {realHandoffs.length === 0 && (
          <div className="mb-6 p-4 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>No real persisted handoffs found. Showing mock data for demonstration purposes.</p>
          </div>
        )}

        {mockHandoffs.map(ho => (
          <div key={ho.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 opacity-60">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-800/50 font-mono text-sm">
              <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-md text-indigo-400">
                {ho.fromAgentId}
              </div>
              <ArrowRightLeft className="w-5 h-5 text-zinc-500" />
              <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-md text-emerald-400">
                {ho.toAgentId || 'Manual Triage'}
              </div>
              <div className="ml-auto flex items-center gap-3">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                  Mock Data
                </span>
                <div className="text-zinc-500 text-xs">
                  {new Date(ho.timestamp).toLocaleString()}
                </div>
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

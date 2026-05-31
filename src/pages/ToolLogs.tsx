import { mockMessages } from '../store/mockData';
import { Terminal, CheckCircle2, XCircle } from 'lucide-react';
import { DataSourceNotice } from '../components/common/DataSourceNotice';

export function ToolLogs() {
  const toolCalls = mockMessages.flatMap(m => m.toolCalls || []).map((tc, idx) => ({ ...tc, idx }));

  return (
    <div className="max-w-6xl mx-auto space-y-6 flex flex-col h-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Tool Execution Logs</h1>
        <p className="text-zinc-400 text-sm">Audit trail of all actions performed by agents</p>
      </div>

      <DataSourceNotice detail="This view is populated from seeded message history, not a persisted command execution log yet." />

      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {toolCalls.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
              No tool executions logged yet.
            </div>
          ) : (
            toolCalls.map((tc, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Terminal className="w-4 h-4 text-zinc-400" />
                    {tc.name}
                  </div>
                  <div className="flex items-center gap-2">
                    {tc.status === 'success' ? (
                      <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> Success
                      </span>
                    ) : tc.status === 'error' ? (
                      <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                        <XCircle className="w-3 h-3" /> Error
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">Pending</span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-zinc-600 mb-1 uppercase tracking-wider text-[10px]">Arguments</div>
                    <div className="text-zinc-400 break-all bg-zinc-900 border border-zinc-800/50 p-2 rounded">
                      {tc.args}
                    </div>
                  </div>
                  
                  {tc.result && (
                    <div>
                      <div className="text-zinc-600 mb-1 uppercase tracking-wider text-[10px]">Result / Output</div>
                      <div className={`break-all p-2 rounded border border-zinc-800/50 ${tc.status === 'error' ? 'text-rose-400 bg-rose-500/5' : 'text-zinc-500 bg-zinc-900'}`}>
                        {tc.result}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

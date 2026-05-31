import { useEffect, useState, useRef } from 'react';
import { CheckCircle2, XCircle, Activity, Box, AlertTriangle } from 'lucide-react';
import { runtimeTaskService, RuntimeTaskEvent } from '../../services/runtime/RuntimeTaskService';
import { RuntimeTask } from '../../types/runtime-task';
import { cn } from '../../lib/utils';

export function LivingVisualCanvas() {
  const [activeTask, setActiveTask] = useState<RuntimeTask | null>(() => {
    const active = runtimeTaskService.listActive();
    return active.length > 0 ? active[0] : null;
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: RuntimeTaskEvent) => {
      const active = runtimeTaskService.listActive();
      
      if (active.length > 0) {
        // Find if we are currently looking at one of the active tasks
        const currentlyViewing = active.find(t => t.id === activeTask?.id);
        if (currentlyViewing) {
            setActiveTask({ ...currentlyViewing });
        } else {
            setActiveTask({ ...active[0] });
        }
      } else {
        // If the task we were looking at just completed/failed, show its final state
        if (event.task.id === activeTask?.id) {
           setActiveTask({ ...event.task });
        } else if (!activeTask) {
           setActiveTask(null);
        }
      }
    };
    const unsubscribe = runtimeTaskService.subscribe(handler);
    return () => unsubscribe();
  }, [activeTask?.id]);

  useEffect(() => {
    if (activeTask?.logs.length) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTask?.logs.length]);

  if (!activeTask) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800/50 rounded-xl bg-zinc-900/20 text-zinc-600 mb-4 animate-in fade-in zoom-in duration-300">
        <Box className="w-8 h-8 opacity-20 mb-3" />
        <p className="text-[12px]">Canvas idle. Waiting for task execution...</p>
      </div>
    );
  }

  const isTerminalTask = activeTask.toolName === 'terminal.run' || activeTask.toolName === 'execute_command' || activeTask.logs.length > 0;
  
  return (
    <div className="w-full mb-4 flex flex-col border border-zinc-800/60 rounded-xl overflow-hidden bg-zinc-950/80 shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800/60">
        <Activity className="w-4 h-4 text-indigo-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-zinc-200 truncate">{activeTask.intent || activeTask.toolName}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/50">{activeTask.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {activeTask.status === 'running' && <span className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Running</span>}
          {activeTask.status === 'queued' && <span className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />Queued</span>}
          {activeTask.status === 'blocked' && <span className="flex items-center gap-1.5 text-[10px] text-amber-500 font-medium"><AlertTriangle className="w-3 h-3" />Blocked</span>}
          {activeTask.status === 'completed' && <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium"><CheckCircle2 className="w-3 h-3" />Completed</span>}
          {activeTask.status === 'failed' && <span className="flex items-center gap-1.5 text-[10px] text-rose-400 font-medium"><XCircle className="w-3 h-3" />Failed</span>}
          {activeTask.status === 'cancelled' && <span className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium"><XCircle className="w-3 h-3" />Cancelled</span>}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col bg-zinc-950 p-3 max-h-[40vh] overflow-y-auto min-h-[120px] custom-scrollbar">
        {isTerminalTask ? (
          <div className="font-mono text-[11px] leading-relaxed">
            {activeTask.logs.length === 0 ? (
              <span className="text-zinc-600 italic">No output yet...</span>
            ) : (
              activeTask.logs.map((log, i) => (
                <div key={i} className={cn("whitespace-pre-wrap break-all", log.level === 'error' ? 'text-rose-400' : log.level === 'warn' ? 'text-amber-400' : 'text-zinc-300')}>
                  <span className="text-zinc-600 select-none mr-2">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  {log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        ) : (
           <div className="flex flex-col gap-2">
             {activeTask.args && (
               <div className="p-2 bg-zinc-900/50 rounded-lg border border-zinc-800/40">
                 <div className="text-[10px] font-semibold text-zinc-500 mb-1 uppercase">Parameters</div>
                 <pre className="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap">{JSON.stringify(activeTask.args, null, 2)}</pre>
               </div>
             )}
             {activeTask.result && (
               <div className="p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/20 mt-2">
                 <div className="text-[10px] font-semibold text-emerald-500/70 mb-1 uppercase">Result</div>
                 <pre className="text-[11px] text-emerald-400/90 font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto custom-scrollbar">{typeof activeTask.result === 'string' ? activeTask.result : JSON.stringify(activeTask.result, null, 2)}</pre>
               </div>
             )}
             {activeTask.error && (
               <div className="p-2 bg-rose-500/5 rounded-lg border border-rose-500/20 mt-2">
                 <div className="text-[10px] font-semibold text-rose-500/70 mb-1 uppercase">Error</div>
                 <pre className="text-[11px] text-rose-400/90 font-mono whitespace-pre-wrap">{activeTask.error}</pre>
               </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}

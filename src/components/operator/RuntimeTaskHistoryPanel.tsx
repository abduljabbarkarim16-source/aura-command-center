import { useEffect, useState } from 'react';
import { Terminal, Database, Shield, Zap, Clock, Trash2, ChevronDown, ChevronRight, XSquare, Activity } from 'lucide-react';
import { runtimeTaskService } from '../../services/runtime/RuntimeTaskService';
import type { RuntimeTask } from '../../types/runtime-task';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

function formatElapsed(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export function RuntimeTaskHistoryPanel() {
  const [tasks, setTasks] = useState<RuntimeTask[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setTasks(runtimeTaskService.listRecent());
    const unsubscribe = runtimeTaskService.subscribe(() => {
      setTasks(runtimeTaskService.listRecent());
    });
    return unsubscribe;
  }, []);

  const getIcon = (type: RuntimeTask['type']) => {
    switch (type) {
      case 'terminal': return <Terminal className="w-4 h-4" />;
      case 'memory': return <Database className="w-4 h-4" />;
      case 'capability': return <Shield className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-6 text-center">
        <Activity className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-[13px] font-medium text-zinc-400">No runtime tasks yet</p>
        <p className="text-[12px] mt-1 text-zinc-600">Tasks executed by AURA will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center justify-between p-3 border-b border-zinc-900 shrink-0">
        <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Runtime Task History
        </div>
        <button 
          onClick={() => runtimeTaskService.clearCompleted()}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded transition-colors"
          title="Clear completed tasks"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence initial={false}>
          {tasks.map(task => {
            const isExpanded = expandedId === task.id;
            return (
              <motion.div 
                key={task.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={clsx(
                  "border rounded-lg overflow-hidden transition-colors",
                  task.status === 'failed' ? 'border-rose-900/50 bg-rose-950/10' : 'border-zinc-800/60 bg-zinc-900/30'
                )}
              >
                <div 
                  className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  onClick={() => toggleExpand(task.id)}
                >
                  <div className={clsx(
                    "p-1.5 rounded-md shrink-0",
                    task.status === 'running' ? 'bg-indigo-500/20 text-indigo-400' :
                    task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    task.status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
                    'bg-zinc-800 text-zinc-400'
                  )}>
                    {getIcon(task.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-medium text-zinc-200 truncate">{task.title}</span>
                        {task.updatedMemory && (
                          <div title="This task updated memory" className="shrink-0 p-0.5 rounded bg-indigo-500/20 text-indigo-400">
                            <Database className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <span className={clsx(
                        "text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded",
                        task.status === 'running' ? 'text-indigo-400 bg-indigo-500/10' :
                        task.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10' :
                        task.status === 'failed' ? 'text-rose-400 bg-rose-500/10' :
                        'text-zinc-500 bg-zinc-800'
                      )}>
                        {task.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(task.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                      </span>
                      {task.elapsedMs && (
                        <span className="font-mono">{formatElapsed(task.elapsedMs)}</span>
                      )}
                      <span>source: {task.source}</span>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex items-center gap-2 text-zinc-600">
                    {task.status === 'running' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); runtimeTaskService.cancelTask(task.id); }}
                        className="text-zinc-500 hover:text-rose-400 p-1 rounded transition-colors"
                        title="Cancel Task"
                      >
                        <XSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-zinc-800/50 bg-zinc-950/50"
                    >
                      <div className="p-3 space-y-3">
                        {task.summary && (
                          <div className="text-[12px] text-zinc-300 bg-zinc-900 p-2 rounded border border-zinc-800">
                            {task.summary}
                          </div>
                        )}
                        
                        {task.error && (
                          <div className="text-[12px] text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-900/50 font-mono">
                            {task.error}
                          </div>
                        )}
                        
                        {task.logs.length > 0 && (
                          <div className="space-y-1 bg-zinc-950 p-2 rounded border border-zinc-900">
                            {task.logs.map((log, idx) => (
                              <div key={idx} className="flex gap-2 text-[11px] font-mono">
                                <span className="text-zinc-600 shrink-0">
                                  {new Date(log.timestamp).toISOString().split('T')[1].slice(0,-1)}
                                </span>
                                <span className={clsx(
                                  "break-all",
                                  log.level === 'error' ? 'text-rose-400' :
                                  log.level === 'warn' ? 'text-amber-400' :
                                  log.level === 'success' ? 'text-emerald-400' :
                                  'text-zinc-400'
                                )}>
                                  {log.message}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

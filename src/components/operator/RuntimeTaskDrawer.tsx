import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Database, Shield, Zap, X, AlertCircle, CheckCircle2, Loader2, Pin } from 'lucide-react';
import { runtimeTaskService, type RuntimeTaskEvent } from '../../services/runtime/RuntimeTaskService';
import type { RuntimeTask } from '../../types/runtime-task';
import clsx from 'clsx';

export function RuntimeTaskDrawer() {
  const [activeTask, setActiveTask] = useState<RuntimeTask | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const checkActive = () => {
      const active = runtimeTaskService.listActive();
      if (active.length > 0) {
        // Show the most recently updated active task
        setActiveTask(active[0]);
        clearAutoHide();
      } else if (!isPinned) {
        // No active tasks and not pinned, start auto-hide
        startAutoHide();
      }
    };

    checkActive();

    const unsubscribe = runtimeTaskService.subscribe((event) => {
      // Whenever a task changes state, re-evaluate what to show
      
      // If we're showing a task that just completed/failed, keep it visible briefly
      if (activeTask && event.task.id === activeTask.id && 
         (event.type === 'task_completed' || event.type === 'task_failed')) {
        setActiveTask(event.task); // update its state
        if (!isPinned) startAutoHide();
        return;
      }
      
      // If a new task is started/created, peek it immediately
      if (event.type === 'task_started' || event.type === 'task_created') {
        setActiveTask(event.task);
        clearAutoHide();
        return;
      }

      // Fallback: just check active queue
      if (event.type === 'task_log_appended' && activeTask && event.task.id === activeTask.id) {
        setActiveTask(event.task); // just update logs
      } else {
        checkActive();
      }
    });

    return unsubscribe;
  }, [activeTask?.id, isPinned]);

  const clearAutoHide = () => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const startAutoHide = () => {
    clearAutoHide();
    hideTimeoutRef.current = window.setTimeout(() => {
      setActiveTask(null);
    }, 4000);
  };

  const handleClose = () => {
    setActiveTask(null);
    setIsPinned(false);
  };

  const getIcon = (type: RuntimeTask['type']) => {
    switch (type) {
      case 'terminal': return <Terminal className="w-4 h-4" />;
      case 'memory': return <Database className="w-4 h-4" />;
      case 'capability': return <Shield className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const lastLog = activeTask?.logs[activeTask.logs.length - 1];

  return (
    <AnimatePresence>
      {activeTask && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-6 right-6 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/50 border-b border-zinc-800/60">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className={clsx(
                "p-1.5 rounded-md",
                activeTask.status === 'running' ? 'bg-indigo-500/20 text-indigo-400' :
                activeTask.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                activeTask.status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
                'bg-zinc-800 text-zinc-400'
              )}>
                {getIcon(activeTask.type)}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-[12px] font-semibold text-zinc-200 truncate">{activeTask.title}</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {activeTask.status} {activeTask.elapsedMs ? `(${activeTask.elapsedMs}ms)` : ''}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              {activeTask.status === 'running' && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 mr-1" />
              )}
              {activeTask.status === 'completed' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1" />
              )}
              {activeTask.status === 'failed' && (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 mr-1" />
              )}
              <button 
                onClick={() => setIsPinned(!isPinned)}
                className={clsx(
                  "p-1 rounded hover:bg-zinc-800 transition-colors",
                  isPinned ? "text-indigo-400" : "text-zinc-600"
                )}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-3 bg-zinc-900 min-h-[60px] flex flex-col justify-center">
            {activeTask.status === 'failed' ? (
              <div className="text-[11px] text-rose-400 font-mono line-clamp-3">
                {activeTask.error || "Task failed with unknown error."}
              </div>
            ) : lastLog ? (
              <div className={clsx(
                "text-[11px] font-mono line-clamp-2",
                lastLog.level === 'error' ? 'text-rose-400' :
                lastLog.level === 'warn' ? 'text-amber-400' :
                'text-zinc-400'
              )}>
                {lastLog.message}
              </div>
            ) : activeTask.summary ? (
               <div className="text-[12px] text-zinc-300">
                 {activeTask.summary}
               </div>
            ) : (
              <div className="text-[11px] text-zinc-600 font-mono italic">
                waiting for output...
              </div>
            )}
          </div>
          
          {/* Progress bar line */}
          {activeTask.status === 'running' && (
            <div className="h-0.5 w-full bg-zinc-800 overflow-hidden">
              <motion.div 
                className="h-full bg-indigo-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

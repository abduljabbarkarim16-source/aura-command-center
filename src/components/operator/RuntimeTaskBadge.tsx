import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { RuntimeTask, RuntimeTaskStatus } from '../../types/runtime-task';
import { runtimeTaskService } from '../../services/runtime/RuntimeTaskService';

export function RuntimeTaskBadge() {
  const [activeTasks, setActiveTasks] = useState<RuntimeTask[]>([]);

  useEffect(() => {
    // Initial load
    setActiveTasks(runtimeTaskService.listActive());

    // Subscribe to task updates
    const unsubscribe = runtimeTaskService.subscribe((event) => {
      if (
        event.type === 'task_created' ||
        event.type === 'task_started' ||
        event.type === 'task_completed' ||
        event.type === 'task_failed' ||
        event.type === 'task_cancelled' ||
        event.type === 'task_blocked'
      ) {
        setActiveTasks(runtimeTaskService.listActive());
      }
    });

    return unsubscribe;
  }, []);

  if (activeTasks.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300">
      <Activity className="w-3.5 h-3.5 animate-pulse" />
      <span className="text-[12px] font-medium font-mono">{activeTasks.length} active</span>
    </div>
  );
}

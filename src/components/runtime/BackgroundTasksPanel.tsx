import { ListTree, Play, Pause, XSquare, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { mockRuntimeState } from '../../mock/runtime';
import { BackgroundTask } from '../../types/runtime';

function TaskItem({ task }: { task: BackgroundTask, key?: string }) {
  const getStatusIcon = () => {
    switch(task.status) {
      case 'in_progress': return <Play className="w-3 h-3 text-indigo-400" />;
      case 'pending': return <Clock className="w-3 h-3 text-zinc-500" />;
      case 'completed': return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
      case 'failed': return <AlertCircle className="w-3 h-3 text-red-500" />;
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded bg-zinc-950 border border-zinc-800/50 text-xs">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-1.5 font-medium text-zinc-200">
          {getStatusIcon()}
          {task.title}
        </div>
        <div className="flex gap-1 opacity-50 hover:opacity-100 transition-opacity">
          {task.status === 'in_progress' && <Pause className="w-3.5 h-3.5 cursor-pointer hover:text-amber-400" />}
          {task.status !== 'completed' && <XSquare className="w-3.5 h-3.5 cursor-pointer hover:text-red-400" />}
        </div>
      </div>
      
      <div className="flex flex-col gap-1 text-[10px] text-zinc-500">
        <div className="flex justify-between">
          <span>Agent: <span className="text-zinc-400">{task.assignedAgent}</span></span>
          <span>{(task.elapsedTimeMs / 1000).toFixed(1)}s</span>
        </div>
        <div className="flex justify-between">
          <span>Model: <span className="text-zinc-400 uppercase">{task.modelUsed}</span></span>
        </div>
        <div className="mt-1 text-indigo-300 truncate">
          → {task.currentStep}
        </div>
      </div>
    </div>
  );
}

export function BackgroundTasksPanel() {
  const { activeTasks, queuedTasks, completedTasks } = mockRuntimeState;

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <ListTree className="w-4 h-4 text-purple-400" />
          Background Tasks
        </div>
        <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-mono">
          {activeTasks.length} Active
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {activeTasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Active</h4>
            {activeTasks.map(t => <TaskItem key={t.id} task={t} />)}
          </div>
        )}
        
        {queuedTasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Queued</h4>
            {queuedTasks.map(t => <TaskItem key={t.id} task={t} />)}
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Recently Completed</h4>
            {completedTasks.slice(0, 1).map(t => <TaskItem key={t.id} task={t} />)}
          </div>
        )}
      </div>

      <button className="text-xs text-zinc-500 hover:text-white transition-colors py-1">
        View All Logs
      </button>
    </div>
  );
}

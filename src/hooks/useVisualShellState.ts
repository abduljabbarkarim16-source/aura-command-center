import { useEffect, useMemo, useState } from 'react';
import { runtimeTaskService } from '../services/runtime/RuntimeTaskService';
import { visualShellStateService } from '../services/visual/VisualShellStateService';
import type { RuntimeTask } from '../types/runtime-task';
import type { CanvasMode } from '../types/visual-canvas';
import { terminalVisualFromTask } from '../types/visual-canvas';
import type { VisualShellCommandState, VisualShellState, VisualShellStateInput } from '../types/visual-shell';

const RECENT_STATE_MS = 7_000;

function isActive(task: RuntimeTask): boolean {
  return task.status === 'queued' || task.status === 'running' || task.status === 'blocked';
}

function isRecentFinal(task: RuntimeTask, now: number): boolean {
  if (!task.completedAt) return false;
  return now - new Date(task.completedAt).getTime() < RECENT_STATE_MS;
}

function modeForTask(task: RuntimeTask | null): CanvasMode {
  if (!task) return 'ambient';
  if (task.status === 'completed') return 'completed';
  if (task.status === 'failed' || task.status === 'blocked' || task.status === 'cancelled') return 'failed';
  if (task.type === 'terminal' || task.type === 'cli') return 'terminal';
  if (task.type === 'memory') return 'memory';
  return 'working';
}

export function useVisualShellState(input: VisualShellStateInput): VisualShellState {
  const [commandState, setCommandState] = useState<VisualShellCommandState>(() => visualShellStateService.getState());
  const [tasks, setTasks] = useState<RuntimeTask[]>(() => runtimeTaskService.listRecent());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => visualShellStateService.subscribe(setCommandState), []);
  useEffect(() => runtimeTaskService.subscribe(() => setTasks(runtimeTaskService.listRecent())), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const activeTask = tasks.find(isActive) ?? null;
    const recentFinalTask = tasks.find(task => isRecentFinal(task, now)) ?? null;
    const taskForMode = activeTask ?? recentFinalTask;
    const taskMode = modeForTask(taskForMode);

    const activeTerminalTask = tasks.find(task => (task.type === 'terminal' || task.type === 'cli') && (isActive(task) || isRecentFinal(task, now)));
    const activeTerminalVisual = commandState.activeTerminalVisual
      ?? (activeTerminalTask ? terminalVisualFromTask(activeTerminalTask) : null);

    let mode: CanvasMode = 'ambient';
    if (commandState.activeDiagram) mode = 'diagram';
    else if (input.voiceMode !== 'ambient') mode = input.voiceMode;
    else if (activeTerminalVisual) mode = 'terminal';
    else if (taskMode !== 'ambient') mode = taskMode;

    return {
      mode,
      activeDiagram: commandState.activeDiagram,
      activeTerminalVisual,
      activeTask: taskForMode,
      themeColor: commandState.themeColor,
      accentIcon: commandState.accentIcon,
      message: commandState.message ?? taskForMode?.title,
      updatedAt: commandState.updatedAt,
    };
  }, [commandState, input.voiceMode, now, tasks]);
}

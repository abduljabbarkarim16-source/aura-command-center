import type { RuntimeTask } from './runtime-task';

export type CanvasMode =
  | 'ambient'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'working'
  | 'diagram'
  | 'terminal'
  | 'memory'
  | 'completed'
  | 'failed';

export type DiagramLayoutMode = 'grid' | 'list' | 'flow' | 'bento';
export type DiagramNodeAnimation = 'none' | 'pulse' | 'bounce' | 'glow';
export type DiagramNodeStatus = 'idle' | 'running' | 'completed' | 'failed' | 'blocked' | 'planned';

export interface DiagramNode {
  id?: string;
  label: string;
  detail?: string;
  color?: string;
  icon?: string;
  emoji?: string;
  animation?: DiagramNodeAnimation;
  status?: DiagramNodeStatus;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramData {
  title: string;
  description?: string;
  layoutMode: DiagramLayoutMode;
  themeColor?: string;
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
}

export interface TerminalVisualLogLine {
  timestamp?: string;
  level?: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface TerminalVisualData {
  taskId?: string;
  command?: string;
  status: 'idle' | 'running' | 'success' | 'failed' | 'blocked';
  logs: TerminalVisualLogLine[];
  startedAt?: string;
  durationMs?: number;
  resultSummary?: string;
  illustrative?: boolean;
}

export function terminalVisualFromTask(task: RuntimeTask): TerminalVisualData {
  const status: TerminalVisualData['status'] =
    task.status === 'completed' ? 'success'
      : task.status === 'failed' || task.status === 'cancelled' ? 'failed'
        : task.status === 'blocked' ? 'blocked'
          : task.status === 'running' || task.status === 'queued' ? 'running'
            : 'idle';

  return {
    taskId: task.id,
    command: task.toolId ?? task.title,
    status,
    logs: task.logs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
    })),
    startedAt: task.startedAt ?? task.createdAt,
    durationMs: task.elapsedMs,
    resultSummary: task.summary ?? task.error,
  };
}

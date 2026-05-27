export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface BackgroundTask {
  id: string;
  title: string;
  status: TaskStatus;
  assignedAgent: string;
  modelUsed: string;
  elapsedTimeMs: number;
  currentStep: string;
}

export interface RuntimeState {
  activeTasks: BackgroundTask[];
  queuedTasks: BackgroundTask[];
  completedTasks: BackgroundTask[];
  failedTasks: BackgroundTask[];
}

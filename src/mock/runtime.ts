import { RuntimeState } from '../types/runtime';

export const mockRuntimeState: RuntimeState = {
  activeTasks: [
    {
      id: 'task-live-1',
      title: 'Scaffold Workspace UI',
      status: 'in_progress',
      assignedAgent: 'Codex Dev',
      modelUsed: 'gpt-4o',
      elapsedTimeMs: 145000,
      currentStep: 'Generating React components...'
    }
  ],
  queuedTasks: [
    {
      id: 'task-live-2',
      title: 'Run Linting',
      status: 'pending',
      assignedAgent: 'Claude Architect',
      modelUsed: 'claude-3-5-sonnet',
      elapsedTimeMs: 0,
      currentStep: 'Waiting for available agent...'
    }
  ],
  completedTasks: [
    {
      id: 'task-live-0',
      title: 'Project Initialization',
      status: 'completed',
      assignedAgent: 'AURA Config',
      modelUsed: 'antigravity',
      elapsedTimeMs: 3400,
      currentStep: 'Done'
    }
  ],
  failedTasks: []
};

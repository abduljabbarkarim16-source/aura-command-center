import { runtimeTaskService } from './RuntimeTaskService';
import type { RuntimeTask } from '../../types/runtime-task';
import type { ToolResult } from '../../types/tool-result';

type ContinuationListener = (taskId: string, message: string) => void;

class RuntimeTaskContinuationServiceImpl {
  private voiceListeners = new Set<ContinuationListener>();
  private consoleListeners = new Set<ContinuationListener>();

  constructor() {
    // We could hook into the task service directly if it emitted events per task completion, 
    // but the task service emits the whole array.
    // In a full implementation, the executor (AuraToolDispatchService) would trigger the continuation.
  }

  subscribeVoice(fn: ContinuationListener) {
    this.voiceListeners.add(fn);
    return () => this.voiceListeners.delete(fn);
  }

  subscribeConsole(fn: ContinuationListener) {
    this.consoleListeners.add(fn);
    return () => this.consoleListeners.delete(fn);
  }

  /** Called when a background task finishes and we need to notify the user */
  continueTask(taskId: string, source: 'voice' | 'agent' | 'user', message: string) {
    if (source === 'voice') {
      for (const fn of this.voiceListeners) fn(taskId, message);
    } else {
      for (const fn of this.consoleListeners) fn(taskId, message);
    }
  }
}

export const runtimeTaskContinuationService = new RuntimeTaskContinuationServiceImpl();

import { RuntimeTask, RuntimeTaskStatus, RuntimeTaskLogLine } from '../../types/runtime-task';

export type RuntimeTaskEventType = 'task_created' | 'task_started' | 'task_completed' | 'task_failed' | 'task_cancelled' | 'task_blocked' | 'task_log_appended';

export interface RuntimeTaskEvent {
  type: RuntimeTaskEventType;
  task: RuntimeTask;
}

export type RuntimeTaskListener = (event: RuntimeTaskEvent) => void;

class RuntimeTaskServiceImpl {
  private tasks: Map<string, RuntimeTask> = new Map();
  private listeners: Set<RuntimeTaskListener> = new Set();
  private readonly STORAGE_KEY = 'aura.runtimeTasks';
  private readonly MAX_TASKS = 200;
  
  private saveTimeout: number | null = null;
  private pendingLogEmits: Set<string> = new Set();
  private logEmitTimeout: number | null = null;

  constructor() {
    this.loadTasks();
  }

  // EVENT EMITTER

  subscribe(listener: RuntimeTaskListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(type: RuntimeTaskEventType, task: RuntimeTask) {
    const event: RuntimeTaskEvent = { type, task };
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in RuntimeTaskListener:', err);
      }
    });
  }

  // PERSISTENCE

  private loadTasks() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed: RuntimeTask[] = JSON.parse(raw);
        parsed.forEach(t => this.tasks.set(t.id, t));
      }
    } catch (err) {
      console.error('Failed to load runtime tasks from localStorage', err);
    }
  }

  private saveTasks() {
    if (this.saveTimeout !== null) return;
    this.saveTimeout = window.setTimeout(() => {
      this.saveTimeout = null;
      try {
        const allTasks = Array.from(this.tasks.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, this.MAX_TASKS);
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allTasks));
      } catch (err) {
        console.error('Failed to save runtime tasks to localStorage', err);
      }
    }, 500);
  }

  // TASK LIFECYCLE CRUD

  createTask(taskDef: Omit<RuntimeTask, 'id' | 'createdAt' | 'status' | 'logs'>): RuntimeTask {
    const task: RuntimeTask = {
      ...taskDef,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
      status: 'queued',
      logs: []
    };

    this.tasks.set(task.id, task);
    this.saveTasks();
    this.emit('task_created', task);
    return task;
  }

  startTask(id: string): RuntimeTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = 'running';
    task.startedAt = new Date().toISOString();
    
    this.saveTasks();
    this.emit('task_started', task);
    return task;
  }

  appendLog(id: string, message: string, level: RuntimeTaskLogLine['level'] = 'info'): void {
    const task = this.tasks.get(id);
    if (!task) return;

    task.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message
    });

    this.saveTasks();
    
    this.pendingLogEmits.add(id);
    if (this.logEmitTimeout === null) {
      this.logEmitTimeout = window.setTimeout(() => {
        this.logEmitTimeout = null;
        this.pendingLogEmits.forEach(taskId => {
          const t = this.tasks.get(taskId);
          if (t) this.emit('task_log_appended', t);
        });
        this.pendingLogEmits.clear();
      }, 200);
    }
  }

  completeTask(id: string, result?: any, summary?: string): RuntimeTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    if (result !== undefined) task.result = result;
    if (summary) task.summary = summary;
    
    if (task.startedAt) {
      task.elapsedMs = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
    }

    this.saveTasks();
    this.emit('task_completed', task);
    return task;
  }

  failTask(id: string, error: string, result?: any): RuntimeTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = 'failed';
    task.error = error;
    task.completedAt = new Date().toISOString();
    if (result !== undefined) task.result = result;

    if (task.startedAt) {
      task.elapsedMs = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
    }

    this.saveTasks();
    this.emit('task_failed', task);
    return task;
  }
  
  blockTask(id: string, reason: string): RuntimeTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = 'blocked';
    task.error = reason;
    this.saveTasks();
    this.emit('task_blocked', task);
    return task;
  }

  cancelTask(id: string): RuntimeTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = 'cancelled';
    task.completedAt = new Date().toISOString();
    
    if (task.startedAt) {
      task.elapsedMs = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
    }

    this.saveTasks();
    this.emit('task_cancelled', task);
    return task;
  }

  // GETTERS

  getTask(id: string): RuntimeTask | undefined {
    return this.tasks.get(id);
  }

  listRecent(): RuntimeTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  listActive(): RuntimeTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'running' || t.status === 'queued')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  clearCompleted(): void {
    const toKeep = Array.from(this.tasks.values()).filter(t => 
      t.status === 'running' || t.status === 'queued' || t.status === 'blocked'
    );
    
    this.tasks.clear();
    toKeep.forEach(t => this.tasks.set(t.id, t));
    this.saveTasks();
  }
}

export const runtimeTaskService = new RuntimeTaskServiceImpl();

import type { RuntimeTask } from '../../types/runtime-task';
import type { DiagramData, DiagramLayoutMode, TerminalVisualData } from '../../types/visual-canvas';
import { terminalVisualFromTask } from '../../types/visual-canvas';
import type { VisualShellCommandState } from '../../types/visual-shell';
import { runtimeTaskService } from '../runtime/RuntimeTaskService';

type VisualShellListener = (state: VisualShellCommandState) => void;

function nowIso(): string {
  return new Date().toISOString();
}

function safeLayoutMode(value?: string): DiagramLayoutMode {
  return value === 'grid' || value === 'list' || value === 'flow' || value === 'bento' ? value : 'grid';
}

function parseJsonArray<T>(raw?: string): T[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

class VisualShellStateServiceImpl {
  private state: VisualShellCommandState = {
    activeDiagram: null,
    activeTerminalVisual: null,
    themeColor: 'indigo',
    updatedAt: nowIso(),
  };

  private listeners = new Set<VisualShellListener>();

  subscribe(listener: VisualShellListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): VisualShellCommandState {
    return {
      ...this.state,
      activeDiagram: this.state.activeDiagram ? { ...this.state.activeDiagram, nodes: [...this.state.activeDiagram.nodes], edges: this.state.activeDiagram.edges ? [...this.state.activeDiagram.edges] : undefined } : null,
      activeTerminalVisual: this.state.activeTerminalVisual ? { ...this.state.activeTerminalVisual, logs: [...this.state.activeTerminalVisual.logs] } : null,
    };
  }

  private setState(patch: Partial<VisualShellCommandState>): VisualShellCommandState {
    this.state = {
      ...this.state,
      ...patch,
      updatedAt: nowIso(),
    };
    const snapshot = this.getState();
    this.listeners.forEach(listener => listener(snapshot));
    return snapshot;
  }

  showDiagram(diagram: DiagramData): VisualShellCommandState {
    return this.setState({
      activeDiagram: {
        ...diagram,
        layoutMode: safeLayoutMode(diagram.layoutMode),
        nodes: diagram.nodes.slice(0, 12),
        edges: diagram.edges?.slice(0, 16),
      },
      message: diagram.title,
      themeColor: diagram.themeColor ?? this.state.themeColor,
    });
  }

  showDiagramFromTool(inputs: Record<string, string>): VisualShellCommandState {
    const nodes = parseJsonArray<DiagramData['nodes'][number]>(inputs.nodesJson);
    const edges = parseJsonArray<NonNullable<DiagramData['edges']>[number]>(inputs.edgesJson);
    const title = (inputs.title ?? '').trim() || 'AURA diagram';

    return this.showDiagram({
      title,
      description: (inputs.description ?? '').trim() || undefined,
      layoutMode: safeLayoutMode(inputs.layoutMode),
      themeColor: (inputs.themeColor ?? '').trim() || undefined,
      nodes: nodes.length > 0 ? nodes : [{ label: title, detail: 'No diagram nodes were provided.', status: 'planned' }],
      edges: edges.length > 0 ? edges : undefined,
    });
  }

  closeDiagram(): VisualShellCommandState {
    return this.setState({ activeDiagram: null, message: undefined });
  }

  showTerminalVisual(visual: TerminalVisualData): VisualShellCommandState {
    return this.setState({
      activeTerminalVisual: {
        ...visual,
        logs: visual.logs.slice(-40),
      },
      message: visual.command ?? visual.resultSummary,
    });
  }

  showTerminalVisualFromTool(inputs: Record<string, string>): VisualShellCommandState {
    const taskId = (inputs.taskId ?? '').trim();
    const task = taskId ? runtimeTaskService.getTask(taskId) : undefined;

    if (task) {
      return this.showTerminalVisual(terminalVisualFromTask(task));
    }

    const command = (inputs.command ?? '').trim();
    return this.showTerminalVisual({
      taskId: undefined,
      command: command || 'No command executed',
      status: 'idle',
      logs: [{ level: 'info', message: 'Illustrative visual only - no terminal command has been executed.' }],
      resultSummary: 'No real RuntimeTask was provided for this terminal visual.',
      illustrative: true,
    });
  }

  closeTerminalVisual(): VisualShellCommandState {
    return this.setState({ activeTerminalVisual: null });
  }

  setCanvasTheme(themeColor?: string, accentIcon?: string, message?: string): VisualShellCommandState {
    return this.setState({
      themeColor: themeColor?.trim() || this.state.themeColor,
      accentIcon: accentIcon?.trim() || undefined,
      message: message?.trim() || undefined,
    });
  }

  focusTask(task: RuntimeTask): VisualShellCommandState {
    const terminalVisual = task.type === 'terminal' || task.type === 'cli'
      ? terminalVisualFromTask(task)
      : this.state.activeTerminalVisual;

    return this.setState({
      focusedTaskId: task.id,
      activeTerminalVisual: terminalVisual,
      message: task.title,
    });
  }

  focusTaskFromTool(inputs: Record<string, string>): VisualShellCommandState {
    const taskId = (inputs.taskId ?? '').trim();
    const task = taskId ? runtimeTaskService.getTask(taskId) : undefined;
    if (!task) {
      return this.setState({ focusedTaskId: undefined, message: taskId ? `Task not found: ${taskId}` : 'No task id provided.' });
    }
    return this.focusTask(task);
  }

  resetCanvas(): VisualShellCommandState {
    return this.setState({
      activeDiagram: null,
      activeTerminalVisual: null,
      focusedTaskId: undefined,
      themeColor: 'indigo',
      accentIcon: undefined,
      message: undefined,
    });
  }
}

export const visualShellStateService = new VisualShellStateServiceImpl();

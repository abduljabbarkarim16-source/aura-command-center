import type { RuntimeTask } from './runtime-task';
import type { CanvasMode, DiagramData, TerminalVisualData } from './visual-canvas';

export interface VisualShellState {
  mode: CanvasMode;
  activeDiagram: DiagramData | null;
  activeTerminalVisual: TerminalVisualData | null;
  activeTask: RuntimeTask | null;
  themeColor?: string;
  accentIcon?: string;
  message?: string;
  updatedAt: string;
}

export interface VisualShellCommandState {
  activeDiagram: DiagramData | null;
  activeTerminalVisual: TerminalVisualData | null;
  focusedTaskId?: string;
  themeColor?: string;
  accentIcon?: string;
  message?: string;
  updatedAt: string;
}

export interface VisualShellStateInput {
  voiceMode: CanvasMode;
  micLevel?: number;
  audioAmplitude?: number;
}

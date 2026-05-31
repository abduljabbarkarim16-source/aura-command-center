/**
 * SequentialTaskRunnerService — AURA Phase 3K+
 *
 * Executes a named sequence of tool calls one after another automatically.
 * Each step receives the results of prior steps. A final summary is produced
 * by the model (or as a structured report when skipModel=true).
 *
 * This is what makes "do a full system check" work as a single command
 * instead of requiring the user to trigger each tool manually.
 *
 * Usage:
 *   const result = await sequentialTaskRunner.run('system_diagnostic', onProgress);
 *
 * Sequences are defined in NAMED_SEQUENCES below. Add new ones there.
 *
 * Progress callback receives each step result as it completes so the UI
 * can stream output rather than waiting for everything to finish.
 */

import { toolRegistryService } from '../tools/ToolRegistryService';
import { runtimeTaskService } from '../runtime/RuntimeTaskService';

// ── Step definition ────────────────────────────────────────────────────────────

export interface SequenceStep {
  toolId: string;
  label: string;
  /** Static inputs. Dynamic inputs (from prior results) set by stepInputResolver. */
  inputs?: Record<string, string>;
  /** If true, a failure here stops the sequence. Default: false (continue). */
  stopOnFailure?: boolean;
}

export interface StepResult {
  toolId: string;
  label: string;
  ok: boolean;
  output: string;
  durationMs: number;
}

export interface SequenceResult {
  sequenceId: string;
  label: string;
  steps: StepResult[];
  allOk: boolean;
  summary: string;
  durationMs: number;
}

export type ProgressCallback = (step: StepResult, index: number, total: number) => void;

// ── Named sequences ────────────────────────────────────────────────────────────

const NAMED_SEQUENCES: Record<string, { label: string; steps: SequenceStep[] }> = {

  system_diagnostic: {
    label: 'Full System Diagnostic',
    steps: [
      { toolId: 'terminal.gitStatus',   label: 'Git status',            stopOnFailure: false },
      { toolId: 'terminal.gitBranch',   label: 'Git branch',            stopOnFailure: false },
      { toolId: 'cli.claudeCheck',      label: 'Claude CLI detection',  stopOnFailure: false },
      { toolId: 'cli.codexCheck',       label: 'Codex CLI detection',   stopOnFailure: false },
      { toolId: 'terminal.cargoTest',   label: 'Rust tests',            stopOnFailure: false },
      { toolId: 'terminal.npmLint',     label: 'TypeScript lint',       stopOnFailure: false },
      { toolId: 'memory.getUserProfile',label: 'User profile',          stopOnFailure: false },
      { toolId: 'capabilities.can',     label: 'Core capabilities',     inputs: { capability: 'voice.shortSpeech' }, stopOnFailure: false },
      { toolId: 'memory.getCapabilityStatus', label: 'Capability status', stopOnFailure: false },
    ],
  },

  quick_health: {
    label: 'Quick Health Check',
    steps: [
      { toolId: 'terminal.gitStatus',  label: 'Git status',   stopOnFailure: false },
      { toolId: 'cli.claudeCheck',     label: 'Claude CLI',   stopOnFailure: false },
      { toolId: 'cli.codexCheck',      label: 'Codex CLI',    stopOnFailure: false },
      { toolId: 'memory.getUserProfile', label: 'Memory',     stopOnFailure: false },
    ],
  },

  run_tests: {
    label: 'Run All Tests',
    steps: [
      { toolId: 'terminal.npmLint',  label: 'TypeScript lint', stopOnFailure: false },
      { toolId: 'terminal.cargoTest', label: 'Rust tests',     stopOnFailure: false },
    ],
  },
};

// ── Service ────────────────────────────────────────────────────────────────────

class SequentialTaskRunnerServiceImpl {

  listSequences(): Array<{ id: string; label: string; stepCount: number }> {
    return Object.entries(NAMED_SEQUENCES).map(([id, s]) => ({
      id, label: s.label, stepCount: s.steps.length,
    }));
  }

  hasSequence(id: string): boolean {
    return id in NAMED_SEQUENCES;
  }

  /**
   * Run a named sequence. Progress callback fires after each step.
   * Returns the full result including a plain-text summary.
   */
  async run(
    sequenceId: string,
    onProgress?: ProgressCallback,
  ): Promise<SequenceResult> {
    const seq = NAMED_SEQUENCES[sequenceId];
    if (!seq) throw new Error(`Unknown sequence: ${sequenceId}`);

    const start = Date.now();
    const stepResults: StepResult[] = [];

    // Create a RuntimeTask so the sequence is visible in the Activity panel
    const task = runtimeTaskService.createTask({
      title: seq.label,
      type: 'cli',
      source: 'console',
      risk: 'low',
      args: { sequenceId },
    });
    const taskId = task.id;
    runtimeTaskService.startTask(taskId);

    for (let i = 0; i < seq.steps.length; i++) {
      const step = seq.steps[i];
      const stepStart = Date.now();

      runtimeTaskService.appendLog(taskId, `[${i + 1}/${seq.steps.length}] ${step.label}...`, 'info');

      let ok = false;
      let output = '';

      try {
        const exec = await toolRegistryService.execute(
          step.toolId,
          step.inputs ?? {},
          { approved: true },
        );
        output = [exec.stdout, exec.stderr].filter(Boolean).join('\n').trim() || '(done)';
        ok = exec.exitCode === 0;
      } catch (err) {
        output = `Error: ${String(err).slice(0, 200)}`;
        ok = false;
      }

      const result: StepResult = {
        toolId: step.toolId,
        label: step.label,
        ok,
        output,
        durationMs: Date.now() - stepStart,
      };

      stepResults.push(result);
      runtimeTaskService.appendLog(
        taskId,
        `${ok ? '✓' : '✗'} ${step.label}: ${output.slice(0, 120)}`,
        ok ? 'success' : 'warn',
      );

      onProgress?.(result, i, seq.steps.length);

      if (!ok && step.stopOnFailure) break;
    }

    const allOk = stepResults.every(r => r.ok);
    const summary = buildSummary(seq.label, stepResults);
    const totalMs = Date.now() - start;

    if (allOk) {
      runtimeTaskService.completeTask(taskId, undefined, summary);
    } else {
      const failed = stepResults.filter(r => !r.ok).map(r => r.label).join(', ');
      runtimeTaskService.failTask(taskId, `Failed: ${failed}`);
    }

    return { sequenceId, label: seq.label, steps: stepResults, allOk, summary, durationMs: totalMs };
  }
}

// ── Summary builder ────────────────────────────────────────────────────────────

function buildSummary(label: string, steps: StepResult[]): string {
  const passed = steps.filter(s => s.ok).length;
  const failed = steps.filter(s => !s.ok).length;
  const lines: string[] = [`${label} — ${passed}/${steps.length} checks passed.`];

  const failedSteps = steps.filter(s => !s.ok);
  if (failedSteps.length > 0) {
    lines.push(`Issues: ${failedSteps.map(s => s.label).join(', ')}.`);
  }

  // Include meaningful outputs for key checks
  for (const step of steps) {
    if (step.toolId === 'terminal.gitStatus' && step.output && step.output !== '(done)') {
      lines.push(`Git: ${step.output.slice(0, 100)}`);
    }
    if (step.toolId === 'memory.getUserProfile' && step.output) {
      lines.push(`Profile: ${step.output.slice(0, 100)}`);
    }
    if (!step.ok && step.output) {
      lines.push(`${step.label} error: ${step.output.slice(0, 120)}`);
    }
  }

  return lines.join('\n');
}

export const sequentialTaskRunner = new SequentialTaskRunnerServiceImpl();

// ── Intent detection ─────────────────────────────────────────────────────────
// Exported for use in useConsoleConversation and useConversationLoop.

export function detectSequenceIntent(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (/\b(full\s+system\s+(check|diagnostic|test)|system\s+diagnostic|run\s+diagnostics?|check\s+everything|self.?diagnos|full\s+check)\b/.test(t)) {
    return 'system_diagnostic';
  }
  if (/\b(quick\s+(health|check)|health\s+check|status\s+check)\b/.test(t)) {
    return 'quick_health';
  }
  if (/\b(run\s+(all\s+)?tests?|test\s+everything|lint\s+and\s+test)\b/.test(t)) {
    return 'run_tests';
  }
  return null;
}

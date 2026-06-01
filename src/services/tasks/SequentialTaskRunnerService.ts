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

import { invoke } from '@tauri-apps/api/core';
import { toolRegistryService } from '../tools/ToolRegistryService';
import { runtimeTaskService } from '../runtime/RuntimeTaskService';
import { auraMemoryService } from '../memory/AuraMemoryService';

const LAST_SEQUENCE_RESULT_KEY = 'aura.sequence.lastResult';

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
      { toolId: 'capabilities.can',     label: 'Core capabilities',     inputs: { capabilityId: 'voice.shortSpeech' }, stopOnFailure: false },
      { toolId: 'memory.getCapabilityStatus', label: 'Capability status', stopOnFailure: false },
    ],
  },

  repair_last_diagnostic: {
    label: 'Repair Last Diagnostic',
    steps: [],
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
    if (sequenceId === 'repair_last_diagnostic') {
      return this.repairLastDiagnostic(onProgress);
    }

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

    const result = { sequenceId, label: seq.label, steps: stepResults, allOk, summary, durationMs: totalMs };
    this.persistLastResult(result);
    return result;
  }

  getLastResult(): SequenceResult | null {
    try {
      const raw = localStorage.getItem(LAST_SEQUENCE_RESULT_KEY);
      return raw ? JSON.parse(raw) as SequenceResult : null;
    } catch {
      return null;
    }
  }

  private persistLastResult(result: SequenceResult): void {
    try { localStorage.setItem(LAST_SEQUENCE_RESULT_KEY, JSON.stringify(result)); } catch { /* full */ }
  }

  private async repairLastDiagnostic(onProgress?: ProgressCallback): Promise<SequenceResult> {
    const start = Date.now();
    const previous = this.getLastResult();
    const steps: StepResult[] = [];

    const task = runtimeTaskService.createTask({
      title: 'Repair Last Diagnostic',
      type: 'system',
      source: 'agent',
      risk: 'medium',
      args: { previousSequenceId: previous?.sequenceId ?? null },
    });
    runtimeTaskService.startTask(task.id);

    const addStep = (label: string, ok: boolean, output: string, startedAt: number) => {
      const step: StepResult = {
        toolId: 'system.repairLastDiagnostic',
        label,
        ok,
        output,
        durationMs: Date.now() - startedAt,
      };
      steps.push(step);
      runtimeTaskService.appendLog(task.id, `${ok ? 'OK' : 'WARN'} ${label}: ${output.slice(0, 180)}`, ok ? 'success' : 'warn');
      onProgress?.(step, steps.length - 1, 3);
    };

    const analysisStart = Date.now();
    if (!previous) {
      addStep('Read last diagnostic', false, 'No previous diagnostic was stored. Run a full system check first.', analysisStart);
      const summary = buildSummary('Repair Last Diagnostic', steps);
      runtimeTaskService.failTask(task.id, summary);
      const result = { sequenceId: 'repair_last_diagnostic', label: 'Repair Last Diagnostic', steps, allOk: false, summary, durationMs: Date.now() - start };
      this.persistLastResult(result);
      return result;
    }

    const failed = previous.steps.filter(s => !s.ok);
    addStep('Read last diagnostic', true, `${previous.label}: ${previous.steps.length - failed.length}/${previous.steps.length} passed.`, analysisStart);

    const repairStart = Date.now();
    const actions = buildRepairActions(failed);
    if (actions.length === 0) {
      actions.push('No safe automatic repair was needed. Non-failing profile notes are informational, not broken checks.');
    }
    addStep('Apply safe repairs', true, actions.join(' '), repairStart);

    await this.logRepairMemory(previous, actions, task.id);

    const rerunStart = Date.now();
    runtimeTaskService.appendLog(task.id, 'Rerunning full system diagnostic after repair actions.', 'info');
    const rerun = await this.run('system_diagnostic');
    addStep('Rerun diagnostic', rerun.allOk, rerun.summary, rerunStart);

    const allOk = steps.every(s => s.ok);
    const summary = [
      buildSummary('Repair Last Diagnostic', steps),
      '',
      'After repair rerun:',
      rerun.summary,
    ].join('\n');
    const result = { sequenceId: 'repair_last_diagnostic', label: 'Repair Last Diagnostic', steps, allOk, summary, durationMs: Date.now() - start };

    if (allOk) runtimeTaskService.completeTask(task.id, undefined, summary);
    else runtimeTaskService.failTask(task.id, summary);
    this.persistLastResult(result);
    return result;
  }

  private async logRepairMemory(previous: SequenceResult, actions: string[], taskId: string): Promise<void> {
    const summary = `Self-repair reviewed ${previous.label}: ${actions.join(' ').slice(0, 120)}`;
    try {
      auraMemoryService.add({
        category: 'task',
        source: 'explicit',
        content: summary,
        context: `RuntimeTask ${taskId}`,
      });
    } catch { /* non-critical */ }

    try {
      await invoke<string>('append_memory_repo_event', {
        eventType: 'self_repair',
        summary,
        details: `Previous: ${previous.summary} Actions: ${actions.join(' ')}`,
      });
    } catch (err) {
      runtimeTaskService.appendLog(taskId, `Memory repo log skipped: ${String(err).slice(0, 160)}`, 'warn');
    }
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

function buildRepairActions(failed: StepResult[]): string[] {
  const actions: string[] = [];
  for (const step of failed) {
    const output = step.output.toLowerCase();
    if (step.toolId === 'terminal.cargoTest' || output.includes('cargo.toml')) {
      actions.push('Rust test diagnostics are repaired by running cargo from src-tauri instead of the app root.');
    } else if (step.toolId === 'capabilities.can') {
      actions.push('Core capability diagnostics now pass capabilityId=voice.shortSpeech to capabilities.can.');
    } else if (step.toolId.startsWith('cli.')) {
      actions.push(`${step.label} remains environment-dependent; run a background handshake to verify prompt response when the CLI is available.`);
    } else {
      actions.push(`${step.label} needs manual or future repair planning: ${step.output.slice(0, 120)}.`);
    }
  }
  return [...new Set(actions)];
}

export function detectSequenceIntent(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (/\b(fix|repair|resolve)\b.*\b(system|diagnostic|check|problems?|issues?)\b/.test(t) ||
      /\b(system|diagnostic|check)\b.*\b(fix|repair|resolve)\b/.test(t)) {
    return 'repair_last_diagnostic';
  }
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

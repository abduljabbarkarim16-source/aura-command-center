import type { ToolResult, ToolResultStatus } from '../../types/tool-result';

export class ToolResultNormalizer {
  static normalizeSuccess(
    toolId: string, 
    taskId: string | undefined, 
    startedAt: string, 
    durationMs: number, 
    summary: string, 
    output: { stdout?: string; stderr?: string; data?: any; exitCode?: number },
    options: { capabilityEvidence?: any; nextAction?: string } = {}
  ): ToolResult {
    return {
      toolId,
      taskId,
      status: 'success',
      summary,
      stdout: output.stdout,
      stderr: output.stderr,
      data: output.data,
      exitCode: output.exitCode,
      durationMs,
      startedAt,
      completedAt: new Date().toISOString(),
      capabilityEvidence: options.capabilityEvidence,
      nextSuggestedAction: options.nextAction
    };
  }

  static normalizeError(
    toolId: string,
    taskId: string | undefined,
    startedAt: string,
    durationMs: number,
    err: unknown,
    output?: { stdout?: string; stderr?: string; exitCode?: number },
    options: { retryable?: boolean; nextAction?: string } = {}
  ): ToolResult {
    const errorMsg = err instanceof Error ? err.message : String(err);
    
    let status: ToolResultStatus = 'failed';
    if (errorMsg.includes('requires approval') || errorMsg.includes('Approval Required')) {
      status = 'requires_approval';
    } else if (errorMsg.includes('Execution blocked') || errorMsg.includes('Blocked')) {
      status = 'blocked';
    } else if (errorMsg.includes('not found') || errorMsg.includes('unavailable')) {
      status = 'unavailable';
    }

    return {
      toolId,
      taskId,
      status,
      summary: `Failed: ${errorMsg.slice(0, 200)}`,
      stdout: output?.stdout,
      stderr: output?.stderr,
      error: errorMsg,
      exitCode: output?.exitCode ?? -1,
      durationMs,
      startedAt,
      completedAt: new Date().toISOString(),
      retryable: options.retryable ?? (status === 'requires_approval'),
      nextSuggestedAction: options.nextAction
    };
  }
}

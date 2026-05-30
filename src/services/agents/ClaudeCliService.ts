/**
 * ClaudeCliService — AURA Phase 3F
 *
 * Claude Code CLI specific wrapper.
 * Handles the AURA_CLAUDE_CLI_OK smoke test and targeted task prompts.
 *
 * Security:
 *  - All execution via CliSessionService → Rust backend
 *  - No API keys, no repo source, no file paths in prompts
 *  - Prompts are length and character limited in Rust
 */

import { cliSessionService } from './CliSessionService';
import { cliDiscoveryService } from './CliDiscoveryService';

const SMOKE_PROMPT = 'Reply exactly with: AURA_CLAUDE_CLI_OK';
const SMOKE_EXPECTED = 'AURA_CLAUDE_CLI_OK';

export interface ClaudeSmokeResult {
  available: boolean;
  authenticated: boolean;
  responseOk: boolean;
  output: string;
  errorSummary?: string;
  usageLimitDetected: boolean;
}

class ClaudeCliServiceImpl {
  async isAvailable(): Promise<boolean> {
    const cap = await cliDiscoveryService.discover('claude');
    return cap.available;
  }

  /** Minimal smoke test: confirms Claude CLI is available and authenticated. */
  async smokeTest(): Promise<ClaudeSmokeResult> {
    const cap = await cliDiscoveryService.discover('claude', true);
    if (!cap.available) {
      return { available: false, authenticated: false, responseOk: false, output: '', usageLimitDetected: false };
    }

    const sessionId = await cliSessionService.spawn('claude', SMOKE_PROMPT);
    const session   = cliSessionService.getSession(sessionId);

    if (!session) {
      return { available: true, authenticated: false, responseOk: false, output: '', usageLimitDetected: false };
    }

    const output = session.outputLines.join('\n');
    const responseOk = output.includes(SMOKE_EXPECTED);
    const usageLimitDetected = session.status === 'usage_limit';
    const authenticated = session.status !== 'error' || responseOk;

    return {
      available: true,
      authenticated,
      responseOk,
      output: output.slice(0, 500),
      errorSummary: session.errorSummary,
      usageLimitDetected,
    };
  }

  /** Run a task with approval — use only for very short tasks without file access. */
  async runTask(prompt: string): Promise<string> {
    if (!await this.isAvailable()) throw new Error('Claude CLI not available');
    const id = await cliSessionService.spawn('claude', prompt);
    const session = cliSessionService.getSession(id);
    return session?.outputLines.join('\n') ?? '';
  }
}

export const claudeCliService = new ClaudeCliServiceImpl();

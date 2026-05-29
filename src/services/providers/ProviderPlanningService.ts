/**
 * ProviderPlanningService — AURA Phase 3B
 *
 * Makes one minimal live provider call to get a planning suggestion.
 * Uses Anthropic first, falls back to OpenAI.
 *
 * Security rules:
 * - Prompt contains ONLY a sanitised status summary — no source code, no repo
 *   contents, no secrets, no file paths
 * - max_tokens capped at 64 to minimise cost
 * - One call only, no retry loops
 * - Response is validated before use
 */

export interface PlanningRequest {
  sanitizedStatus: string;
}

export interface PlanningProposal {
  title: string;
  reason: string;
  risk: 'safe' | 'moderate' | 'high';
  validationCommand?: string;
}

export interface PlanningResult {
  success: boolean;
  provider: 'anthropic' | 'openai' | 'none';
  model: string;
  proposal?: PlanningProposal;
  rawResponse?: string;
  latencyMs?: number;
  error?: string;
  isDryRun: boolean;
}

const SYSTEM_PROMPT =
  'You are a minimal planning assistant for AURA. Given a sanitized system status, ' +
  'return exactly one low-risk next improvement as JSON with keys: ' +
  '"title" (string), "reason" (string), "risk" ("safe"|"moderate"|"high"), ' +
  '"validationCommand" (optional string, must be a read-only command like git status or npm run lint). ' +
  'Do not include source code, file contents, credentials, or paths. ' +
  'Respond with only the JSON object.';

const USER_PROMPT = (status: string) =>
  `AURA system status (sanitised):\n${status}\n\nReturn one low-risk improvement as JSON.`;

const MAX_TOKENS = 64;

function parseProposal(raw: string): PlanningProposal | undefined {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    const obj = JSON.parse(match[0]) as Record<string, unknown>;
    if (typeof obj.title !== 'string' || typeof obj.reason !== 'string') return undefined;
    const risk = (['safe', 'moderate', 'high'] as const).includes(obj.risk as 'safe') ? obj.risk as PlanningProposal['risk'] : 'safe';
    return {
      title: obj.title,
      reason: obj.reason,
      risk,
      validationCommand: typeof obj.validationCommand === 'string' ? obj.validationCommand : undefined,
    };
  } catch {
    return undefined;
  }
}

class ProviderPlanningServiceImpl {

  async requestPlan(req: PlanningRequest, dryRun = false): Promise<PlanningResult> {
    if (dryRun) {
      return {
        success: true,
        provider: 'none',
        model: 'dry-run',
        isDryRun: true,
        proposal: {
          title: 'Verify provider status cards show live test results',
          reason: 'Phase 3A smoke tests completed — UI should reflect real provider status.',
          risk: 'safe',
          validationCommand: 'npm run lint',
        },
      };
    }

    // Try Anthropic first
    const anthropicKey: string = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
    if (anthropicKey) {
      return this.callAnthropic(anthropicKey, req);
    }

    // Fallback to OpenAI
    const openaiKey: string = import.meta.env.VITE_OPENAI_API_KEY ?? '';
    if (openaiKey) {
      return this.callOpenAI(openaiKey, req);
    }

    return { success: false, provider: 'none', model: 'none', isDryRun: false, error: 'No provider key configured' };
  }

  private async callAnthropic(key: string, req: PlanningRequest): Promise<PlanningResult> {
    const start = Date.now();
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: USER_PROMPT(req.sanitizedStatus) }],
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const msg = (data.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
        return { success: false, provider: 'anthropic', model: 'claude-haiku-4-5-20251001', latencyMs, error: msg, isDryRun: false };
      }
      const content = data.content as Array<{ text?: string }> | undefined;
      const raw = content?.[0]?.text?.trim() ?? '';
      const proposal = parseProposal(raw);
      return { success: true, provider: 'anthropic', model: 'claude-haiku-4-5-20251001', latencyMs, rawResponse: raw, proposal, isDryRun: false };
    } catch (err) {
      return { success: false, provider: 'anthropic', model: 'claude-haiku-4-5-20251001', latencyMs: Date.now() - start, error: String(err), isDryRun: false };
    }
  }

  private async callOpenAI(key: string, req: PlanningRequest): Promise<PlanningResult> {
    const start = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: MAX_TOKENS,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: USER_PROMPT(req.sanitizedStatus) },
          ],
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const msg = (data.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
        return { success: false, provider: 'openai', model: 'gpt-4o-mini', latencyMs, error: msg, isDryRun: false };
      }
      const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
      const raw = choices?.[0]?.message?.content?.trim() ?? '';
      const proposal = parseProposal(raw);
      return { success: true, provider: 'openai', model: 'gpt-4o-mini', latencyMs, rawResponse: raw, proposal, isDryRun: false };
    } catch (err) {
      return { success: false, provider: 'openai', model: 'gpt-4o-mini', latencyMs: Date.now() - start, error: String(err), isDryRun: false };
    }
  }
}

export const providerPlanningService = new ProviderPlanningServiceImpl();

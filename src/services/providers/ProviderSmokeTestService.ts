/**
 * ProviderSmokeTestService — AURA Phase 3A
 *
 * Approval-gated, minimal live connectivity tests for each configured LLM provider.
 *
 * Security rules (same as ProviderRegistryService):
 * - NEVER reads, prints, logs, or exposes API key values
 * - NEVER sends source code, repo contents, or secrets in prompts
 * - Prompts are fixed, minimal, and contain no sensitive data
 * - max_tokens capped at 16 to minimise cost
 * - One call per provider, no retry loops
 */

export interface SmokeTestResult {
  provider: string;
  success: boolean;
  response?: string;
  error?: string;
  latencyMs?: number;
  model: string;
  timestamp: number;
  isDryRun: boolean;
}

const MAX_TOKENS = 16;

function reply(tag: string) {
  return `Reply with exactly: ${tag}`;
}

class ProviderSmokeTestServiceImpl {
  private results: Record<string, SmokeTestResult> = {};
  private pending: Set<string> = new Set();

  getResult(provider: string): SmokeTestResult | undefined {
    return this.results[provider];
  }

  isPending(provider: string): boolean {
    return this.pending.has(provider);
  }

  async testAnthropic(): Promise<SmokeTestResult> {
    const key: string = import.meta.env.VITE_ANTHROPIC_API_KEY ?? '';
    if (!key) return this.store({ provider: 'anthropic', success: false, error: 'Key not configured', model: 'claude-haiku-4-5-20251001', timestamp: Date.now(), isDryRun: false });

    this.pending.add('anthropic');
    const start = Date.now();
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'user', content: reply('AURA_ANTHROPIC_OK') }],
        }),
      });
      const data: Record<string, unknown> = await res.json() as Record<string, unknown>;
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const errMsg = (data.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
        return this.store({ provider: 'anthropic', success: false, error: errMsg, model: 'claude-haiku-4-5-20251001', latencyMs, timestamp: Date.now(), isDryRun: false });
      }
      const content = data.content as Array<{ text?: string }> | undefined;
      const text = content?.[0]?.text?.trim() ?? '';
      return this.store({ provider: 'anthropic', success: text.includes('AURA_ANTHROPIC_OK'), response: text, model: 'claude-haiku-4-5-20251001', latencyMs, timestamp: Date.now(), isDryRun: false });
    } catch (err) {
      return this.store({ provider: 'anthropic', success: false, error: String(err), model: 'claude-haiku-4-5-20251001', latencyMs: Date.now() - start, timestamp: Date.now(), isDryRun: false });
    } finally {
      this.pending.delete('anthropic');
    }
  }

  async testOpenAI(): Promise<SmokeTestResult> {
    const key: string = import.meta.env.VITE_OPENAI_API_KEY ?? '';
    if (!key) return this.store({ provider: 'openai', success: false, error: 'Key not configured', model: 'gpt-4o-mini', timestamp: Date.now(), isDryRun: false });

    this.pending.add('openai');
    const start = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'user', content: reply('AURA_OPENAI_OK') }],
        }),
      });
      const data: Record<string, unknown> = await res.json() as Record<string, unknown>;
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const errMsg = (data.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
        return this.store({ provider: 'openai', success: false, error: errMsg, model: 'gpt-4o-mini', latencyMs, timestamp: Date.now(), isDryRun: false });
      }
      const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
      const text = choices?.[0]?.message?.content?.trim() ?? '';
      return this.store({ provider: 'openai', success: text.includes('AURA_OPENAI_OK'), response: text, model: 'gpt-4o-mini', latencyMs, timestamp: Date.now(), isDryRun: false });
    } catch (err) {
      return this.store({ provider: 'openai', success: false, error: String(err), model: 'gpt-4o-mini', latencyMs: Date.now() - start, timestamp: Date.now(), isDryRun: false });
    } finally {
      this.pending.delete('openai');
    }
  }

  async testGemini(): Promise<SmokeTestResult> {
    const key: string = import.meta.env.VITE_GOOGLE_API_KEY ?? '';
    if (!key) return this.store({ provider: 'gemini', success: false, error: 'Key not configured', model: 'gemini-2.0-flash', timestamp: Date.now(), isDryRun: false });

    this.pending.add('gemini');
    const start = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: reply('AURA_GEMINI_OK') }] }],
          generationConfig: { maxOutputTokens: MAX_TOKENS },
        }),
      });
      const data: Record<string, unknown> = await res.json() as Record<string, unknown>;
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const errMsg = (data.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
        return this.store({ provider: 'gemini', success: false, error: errMsg, model: 'gemini-2.0-flash', latencyMs, timestamp: Date.now(), isDryRun: false });
      }
      const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
      const text = candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      return this.store({ provider: 'gemini', success: text.includes('AURA_GEMINI_OK'), response: text, model: 'gemini-2.0-flash', latencyMs, timestamp: Date.now(), isDryRun: false });
    } catch (err) {
      return this.store({ provider: 'gemini', success: false, error: String(err), model: 'gemini-2.0-flash', latencyMs: Date.now() - start, timestamp: Date.now(), isDryRun: false });
    } finally {
      this.pending.delete('gemini');
    }
  }

  private store(result: SmokeTestResult): SmokeTestResult {
    this.results[result.provider] = result;
    return result;
  }
}

export const providerSmokeTestService = new ProviderSmokeTestServiceImpl();

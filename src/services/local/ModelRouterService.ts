/**
 * ModelRouterService — AURA Phase 3K
 *
 * Routes AI tasks to the cheapest capable model available.
 *
 * Tier 1 — Local Ollama (free, private, instant, on-device):
 *   - Intent classification
 *   - Transcript cleanup / correction
 *   - Name correction resolution
 *   - Memory tagging (category: personal | task)
 *   - Short summarisation
 *
 * Tier 2 — OpenAI API (capable, costs tokens):
 *   - Multi-step reasoning
 *   - Tool planning / function calling
 *   - Long-context explanation
 *   - Any task that Tier 1 returns low-confidence on
 *
 * The router checks Ollama availability once at startup and on each request
 * (with a short TTL cache so it doesn't add latency per turn).
 *
 * Adding a new task type: add a case to routeTask() + a specific method.
 */

import { ollamaService, type OllamaChatResult } from './OllamaService';

type TaskType =
  | 'intent'
  | 'cleanup'
  | 'name_correction'
  | 'memory_tag'
  | 'summarise'
  | 'reason';  // always API

export interface RouteResult {
  text: string;
  tier: 'local' | 'api';
  model: string;
  durationMs: number;
  ok: boolean;
  error?: string;
}

const AVAILABILITY_TTL_MS = 30_000;

class ModelRouterServiceImpl {
  private _ollamaAvailable: boolean | null = null;
  private _lastCheck = 0;

  private async ollamaReady(): Promise<boolean> {
    const now = Date.now();
    if (this._ollamaAvailable !== null && now - this._lastCheck < AVAILABILITY_TTL_MS) {
      return this._ollamaAvailable;
    }
    this._ollamaAvailable = await ollamaService.isAvailable();
    this._lastCheck = now;
    return this._ollamaAvailable;
  }

  /** Force a fresh availability check (e.g. after Ollama install). */
  async refresh(): Promise<boolean> {
    this._ollamaAvailable = null;
    return this.ollamaReady();
  }

  // ── Public task methods ─────────────────────────────────────────────────────

  /**
   * Classify the intent of a short transcript.
   * Returns: 'name_set' | 'name_query' | 'tool' | 'memory' | 'question' | 'other'
   */
  async classifyIntent(transcript: string): Promise<{ intent: string; confidence: 'high' | 'medium' | 'low'; tier: 'local' | 'api' }> {
    if (await this.ollamaReady()) {
      const result = await ollamaService.complete(
        `Classify this voice/text command into exactly one of these labels:\nname_set | name_query | tool | memory | question | other\n\nCommand: "${transcript}"\n\nLabel:`,
        {
          system: 'You are an intent classifier. Reply with exactly one label from the list, nothing else.',
          maxTokens: 8,
        },
      );
      if (result.ok) {
        const label = result.text.toLowerCase().trim().split(/\s+/)[0];
        const valid = ['name_set', 'name_query', 'tool', 'memory', 'question', 'other'];
        const intent = valid.includes(label) ? label : 'other';
        return { intent, confidence: valid.includes(label) ? 'high' : 'low', tier: 'local' };
      }
    }
    // Fallback: simple regex (always available, no model needed)
    const t = transcript.toLowerCase();
    if (/\bmy name is\b/.test(t) || /\bcall me\b/.test(t)) return { intent: 'name_set', confidence: 'high', tier: 'api' };
    if (/\bwhat.*my name\b/.test(t) || /\bwho am i\b/.test(t)) return { intent: 'name_query', confidence: 'high', tier: 'api' };
    if (/\bremember\b/.test(t) || /\bsave\b/.test(t)) return { intent: 'memory', confidence: 'medium', tier: 'api' };
    return { intent: 'other', confidence: 'low', tier: 'api' };
  }

  /**
   * Resolve a name correction using the local model (fast, cheap).
   * Returns the corrected name string or null if uncertain.
   */
  async resolveNameCorrection(params: {
    wrong: string;
    correction: string;
    stored?: string;
  }): Promise<{ name: string | null; tier: 'local' | 'api' }> {
    const prompt = [
      `The voice transcriber heard: "${params.wrong}"`,
      `The user is correcting it by saying: "${params.correction}"`,
      params.stored ? `Previously saved name: "${params.stored}"` : '',
      `What is the correct name? Reply with ONLY the corrected name (title-cased) or "UNCERTAIN".`,
    ].filter(Boolean).join('\n');

    if (await this.ollamaReady()) {
      const result = await ollamaService.complete(prompt, {
        system: 'You resolve voice-transcription name corrections. Reply with ONLY the corrected name or "UNCERTAIN".',
        maxTokens: 12,
      });
      if (result.ok) {
        const name = result.text.trim();
        if (name && name !== 'UNCERTAIN' && name.length <= 60 && name.split(/\s+/).length <= 4) {
          return { name: name.replace(/^([a-z])/, c => c.toUpperCase()), tier: 'local' };
        }
      }
    }
    return { name: null, tier: 'local' };
  }

  /**
   * Tag a memory entry as 'personal' or 'task' category.
   */
  async tagMemory(content: string): Promise<{ category: 'personal' | 'task'; tier: 'local' | 'api' }> {
    if (await this.ollamaReady()) {
      const result = await ollamaService.complete(
        `Tag this memory as "personal" (about the user) or "task" (about work/projects):\n"${content}"\n\nTag:`,
        { system: 'Reply with exactly one word: personal or task.', maxTokens: 4 },
      );
      if (result.ok) {
        const tag = result.text.trim().toLowerCase();
        if (tag === 'personal' || tag === 'task') return { category: tag, tier: 'local' };
      }
    }
    // Fallback heuristic
    const personal = /\b(name|age|prefer|like|love|hate|live|born|family|call me)\b/i.test(content);
    return { category: personal ? 'personal' : 'task', tier: 'api' };
  }

  /**
   * Summarise a short text locally.
   */
  async summarise(text: string, maxWords = 20): Promise<RouteResult> {
    if (await this.ollamaReady()) {
      const result = await ollamaService.complete(
        `Summarise in ${maxWords} words or fewer:\n"${text}"`,
        { maxTokens: maxWords * 2 },
      );
      if (result.ok) return { ...result, tier: 'local', model: ollamaService.reflexModel };
    }
    return { ok: false, text: text.slice(0, 100), tier: 'api', model: 'fallback', durationMs: 0 };
  }

  /** Current Ollama availability (cached). */
  get isLocalAvailable(): boolean { return this._ollamaAvailable === true; }
}

export const modelRouter = new ModelRouterServiceImpl();

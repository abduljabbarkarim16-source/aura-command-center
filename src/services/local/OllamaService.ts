/**
 * OllamaService — AURA Phase 3K
 *
 * TypeScript interface to the local Ollama server (http://localhost:11434).
 * Provides:
 *  - Health check / model list
 *  - Chat completions (OpenAI-compatible endpoint)
 *  - Embeddings for local memory recall
 *
 * Ollama runs as a local background service after install.
 * No API key needed. All traffic stays on-device.
 *
 * Model assignments (settable via setModels()):
 *  reflexModel  — fast intent / cleanup / correction  (Phi-3.5-mini or Llama 3.2 3B)
 *  embedModel   — embeddings for memory               (nomic-embed-text)
 */

const OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 30_000;

export type OllamaModel = 'phi3.5' | 'llama3.2:3b' | 'nomic-embed-text' | string;

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatResult {
  ok: boolean;
  text: string;
  model: string;
  durationMs: number;
  error?: string;
}

export interface OllamaEmbedResult {
  ok: boolean;
  embedding: number[];
  durationMs: number;
  error?: string;
}

export interface OllamaStatus {
  running: boolean;
  models: string[];
  error?: string;
}

class OllamaServiceImpl {
  private _reflexModel: OllamaModel = 'phi3.5';
  private _embedModel: OllamaModel = 'nomic-embed-text';
  private _available: boolean | null = null;

  setModels(opts: { reflex?: OllamaModel; embed?: OllamaModel }) {
    if (opts.reflex) this._reflexModel = opts.reflex;
    if (opts.embed)  this._embedModel  = opts.embed;
  }

  get reflexModel() { return this._reflexModel; }
  get embedModel()  { return this._embedModel; }

  // ── Health / status ──────────────────────────────────────────────────────

  async getStatus(): Promise<OllamaStatus> {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { running: false, models: [], error: `HTTP ${res.status}` };
      const data = await res.json() as { models?: Array<{ name: string }> };
      const models = (data.models ?? []).map(m => m.name);
      this._available = true;
      return { running: true, models };
    } catch (e) {
      this._available = false;
      return { running: false, models: [], error: String(e) };
    }
  }

  async isAvailable(): Promise<boolean> {
    if (this._available !== null) return this._available;
    const status = await this.getStatus();
    return status.running;
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  async chat(params: {
    messages: OllamaChatMessage[];
    model?: OllamaModel;
    maxTokens?: number;
  }): Promise<OllamaChatResult> {
    const model = params.model ?? this._reflexModel;
    const start = Date.now();
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: params.messages,
          stream: false,
          options: { num_predict: params.maxTokens ?? 256 },
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      if (!res.ok) {
        const err = await res.text();
        return { ok: false, text: '', model, durationMs: Date.now() - start, error: err };
      }
      const data = await res.json() as { message?: { content?: string } };
      const text = data.message?.content?.trim() ?? '';
      return { ok: true, text, model, durationMs: Date.now() - start };
    } catch (e) {
      return { ok: false, text: '', model, durationMs: Date.now() - start, error: String(e) };
    }
  }

  /** Convenience: single user message, optional system message. */
  async complete(userMsg: string, opts?: {
    system?: string;
    model?: OllamaModel;
    maxTokens?: number;
  }): Promise<OllamaChatResult> {
    const messages: OllamaChatMessage[] = [];
    if (opts?.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: userMsg });
    return this.chat({ messages, model: opts?.model, maxTokens: opts?.maxTokens });
  }

  // ── Embeddings ───────────────────────────────────────────────────────────

  async embed(text: string): Promise<OllamaEmbedResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this._embedModel, prompt: text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const err = await res.text();
        return { ok: false, embedding: [], durationMs: Date.now() - start, error: err };
      }
      const data = await res.json() as { embedding?: number[] };
      return { ok: true, embedding: data.embedding ?? [], durationMs: Date.now() - start };
    } catch (e) {
      return { ok: false, embedding: [], durationMs: Date.now() - start, error: String(e) };
    }
  }

  // ── Cosine similarity helper (for memory recall) ──────────────────────────

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }
}

export const ollamaService = new OllamaServiceImpl();

/**
 * ContextCompressionService — AURA Phase 3E
 *
 * Safe local context compression for reducing token count before sending
 * to LLM providers. Does NOT send data anywhere automatically.
 *
 * Security: masks likely secrets before any compression operation.
 * Never sends compressed context to providers without explicit caller action.
 */

import type {
  CompressionMethod,
  CompressionOptions,
  CompressionResult,
} from '../../types/context-compression';

// ─── Secret masking patterns ──────────────────────────────────────────────────

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9\-_]{20,}/g,        // OpenAI keys
  /Bearer\s+[A-Za-z0-9\-_\.]{20,}/g, // Bearer tokens
  /api[_-]?key[=:\s]+[^\s"']{10,}/gi, // Generic api_key=...
  /password[=:\s]+[^\s"']{6,}/gi,    // password=...
  /secret[=:\s]+[^\s"']{6,}/gi,      // secret=...
  /token[=:\s]+[^\s"']{10,}/gi,      // token=...
  /[A-Za-z0-9+/]{40,}={0,2}/g,       // Base64 blobs (potential keys)
];

// ─── Service ──────────────────────────────────────────────────────────────────

export class ContextCompressionService {

  compress(input: string, options: Partial<CompressionOptions> = {}): CompressionResult {
    const methods: CompressionMethod[] = options.methods ?? [
      'mask_secrets',
      'strip_html',
      'dedup_lines',
      'shorten_urls',
      'compress_logs',
    ];

    let text = input;
    let secretsMasked = 0;
    const methodsApplied: CompressionMethod[] = [];

    for (const method of methods) {
      const before = text;
      switch (method) {
        case 'mask_secrets':
          ({ text, count: secretsMasked } = this.maskSecrets(text));
          break;
        case 'strip_html':
          text = this.stripHtml(text);
          break;
        case 'dedup_lines':
          text = this.dedupLines(text);
          break;
        case 'shorten_urls':
          text = this.shortenUrls(text);
          break;
        case 'summarize_file_list':
          text = this.summarizeFileList(text);
          break;
        case 'compress_logs':
          text = this.compressLogs(text);
          break;
        case 'compress_terminal':
          text = this.compressTerminal(text);
          break;
        case 'truncate_head_tail':
          text = this.truncateHeadTail(text, options);
          break;
      }
      if (text !== before) methodsApplied.push(method);
    }

    // Final truncation if maxChars set
    if (options.maxChars && text.length > options.maxChars) {
      text = this.truncateHeadTail(text, options);
      if (!methodsApplied.includes('truncate_head_tail')) {
        methodsApplied.push('truncate_head_tail');
      }
    }

    const originalChars = input.length;
    const compressedChars = text.length;

    return {
      original:               input,
      compressed:             text,
      originalChars,
      compressedChars,
      estimatedTokenReduction: Math.round((originalChars - compressedChars) / 4),
      methodsApplied,
      secretsMasked,
    };
  }

  // ── Methods ────────────────────────────────────────────────────────────────

  private maskSecrets(text: string): { text: string; count: number } {
    let count = 0;
    let result = text;
    for (const pattern of SECRET_PATTERNS) {
      result = result.replace(pattern, (match) => {
        // Skip short base64 matches that are probably not secrets
        if (match.length < 32 && match.match(/^[A-Za-z0-9+/]+={0,2}$/)) return match;
        count++;
        return '[REDACTED]';
      });
    }
    return { text: result, count };
  }

  private stripHtml(text: string): string {
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private dedupLines(text: string): string {
    const lines = text.split('\n');
    const seen = new Set<string>();
    const result: string[] = [];
    let dupCount = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && seen.has(trimmed)) {
        dupCount++;
        continue;
      }
      if (trimmed) seen.add(trimmed);
      result.push(line);
    }
    if (dupCount > 0) result.push(`[${dupCount} duplicate lines removed]`);
    return result.join('\n');
  }

  private shortenUrls(text: string): string {
    return text.replace(
      /https?:\/\/([a-zA-Z0-9.-]+)(\/[^\s"'<>]{30,})/g,
      (_match, domain, path) => `https://${domain}${path.slice(0, 30)}…`,
    );
  }

  private summarizeFileList(text: string): string {
    const lines = text.split('\n');
    if (lines.length <= 20) return text;
    const kept = lines.slice(0, 10);
    const skipped = lines.length - 20;
    const tail = lines.slice(-10);
    return [...kept, `… [${skipped} files omitted] …`, ...tail].join('\n');
  }

  private compressLogs(text: string): string {
    return text
      .replace(/\[DEBUG\][^\n]*/g, '')
      .replace(/\[TRACE\][^\n]*/g, '')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[ts]')
      .replace(/\n{3,}/g, '\n\n');
  }

  private compressTerminal(text: string): string {
    const lines = text.split('\n');
    if (lines.length <= 50) return text;
    const head = lines.slice(0, 20);
    const tail = lines.slice(-20);
    return [...head, `\n… [${lines.length - 40} lines omitted] …\n`, ...tail].join('\n');
  }

  private truncateHeadTail(text: string, options: Partial<CompressionOptions>): string {
    const max = options.maxChars ?? 8000;
    if (text.length <= max) return text;

    if (options.preserveHeadTail !== false) {
      const half = Math.floor(max / 2);
      return text.slice(0, half) + '\n… [content truncated] …\n' + text.slice(-half);
    }

    return text.slice(0, max) + '\n… [truncated]';
  }
}

export const contextCompressionService = new ContextCompressionService();

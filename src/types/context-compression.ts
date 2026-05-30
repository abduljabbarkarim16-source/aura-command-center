/**
 * context-compression.ts — AURA Phase 3E
 *
 * Types for the context compression service.
 * Inspired by TokenJuice-style compression: reduce token count before
 * sending context to LLMs without losing semantic content.
 *
 * Security: secrets are masked before compression, never passed through.
 */

export type CompressionMethod =
  | 'strip_html'
  | 'dedup_lines'
  | 'shorten_urls'
  | 'summarize_file_list'
  | 'compress_logs'
  | 'compress_terminal'
  | 'truncate_head_tail'
  | 'mask_secrets';

export interface CompressionOptions {
  methods: CompressionMethod[];
  /** Max characters to keep. 0 = unlimited. */
  maxChars?: number;
  /** If true, keep first N and last M chars when truncating */
  preserveHeadTail?: boolean;
  /** Lines to keep from start */
  headLines?: number;
  /** Lines to keep from end */
  tailLines?: number;
}

export interface CompressionResult {
  original: string;
  compressed: string;
  originalChars: number;
  compressedChars: number;
  /** Estimated token reduction (rough: chars/4) */
  estimatedTokenReduction: number;
  methodsApplied: CompressionMethod[];
  secretsMasked: number;
}

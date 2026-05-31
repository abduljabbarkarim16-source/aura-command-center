/**
 * aura-memory.ts — AURA Phase 3G
 *
 * Types for AURA's persistent memory system.
 * Two sources: auto-extracted from conversation turns, and user-explicit saves.
 * Two categories: personal (about the user) and task (project/work decisions).
 */

export type MemoryCategory = 'personal' | 'task';
export type MemorySource   = 'auto'     | 'explicit';
export type MemoryStatus   = 'active'   | 'pinned' | 'archived';

export interface AuraMemory {
  id: string;
  category: MemoryCategory;
  source:   MemorySource;
  status:   MemoryStatus;
  content:  string;           // The fact itself — plain text, ≤200 chars
  context?: string;           // Optional: what conversation produced this
  createdAt: string;          // ISO timestamp
  updatedAt: string;
  usageCount: number;         // How many times injected into context
}

export interface MemoryExtractionResult {
  facts: Array<{
    category: MemoryCategory;
    content:  string;
  }>;
}

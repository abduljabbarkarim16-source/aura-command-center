/**
 * permission-mode.ts — AURA Phase 3G (Milestone 12)
 *
 * Visible permission modes that control how readily AURA runs tools. Modes
 * relax *approval prompts* for already-allowlisted tools — they NEVER relax the
 * Rust allowlist itself. There is intentionally no true unrestricted bypass.
 */

export type PermissionMode =
  | 'safe-auto'          // auto-run low-risk allowlisted tools; ask for medium/high
  | 'approval-required'  // ask before every tool
  | 'admin-bypass'       // auto-run low + medium allowlisted tools; never high/destructive
  | 'locked';            // no execution at all (chat only)

export type PermissionDecision = 'auto' | 'ask' | 'block';

export interface PermissionModeMeta {
  id: PermissionMode;
  label: string;
  description: string;
  tone: 'emerald' | 'sky' | 'amber' | 'zinc';
}

export const PERMISSION_MODE_META: Record<PermissionMode, PermissionModeMeta> = {
  'safe-auto': {
    id: 'safe-auto', label: 'Safe Auto', tone: 'emerald',
    description: 'Auto-run low-risk allowlisted tools. Ask before medium/high-risk.',
  },
  'approval-required': {
    id: 'approval-required', label: 'Approval', tone: 'sky',
    description: 'Ask before running any tool.',
  },
  'admin-bypass': {
    id: 'admin-bypass', label: 'Admin Bypass', tone: 'amber',
    description: 'Auto-run low + medium allowlisted tools. Still blocks destructive, secrets, unknown binaries, and high-risk actions.',
  },
  'locked': {
    id: 'locked', label: 'Locked', tone: 'zinc',
    description: 'No tool execution. Chat only.',
  },
};

/** Hard guarantees that no mode may bypass. */
export const NEVER_BYPASS = [
  'secrets',
  'destructive commands',
  'unknown binaries',
  'credential extraction',
  'raw file deletion',
  'external webhook spam',
] as const;

/**
 * CliDiscoveryService — AURA Phase 3F
 *
 * Discovers which CLI agents (claude, codex) are available on PATH
 * and summarises their capabilities from --help output.
 *
 * Security:
 *  - Only queries allowlisted binaries (checked in Rust too)
 *  - No prompts, no secrets, no file paths passed
 *  - Results cached in memory for the session
 */

import { invoke } from '@tauri-apps/api/core';
import type { AgentCLI, CLIAvailability } from '../../types/agent-session';

export interface CliCapabilities {
  cli: AgentCLI;
  available: boolean;
  path?: string;
  helpSummary: string;
  supportsPrintFlag: boolean;
  supportsNonInteractive: boolean;
  checkedAt: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class CliDiscoveryServiceImpl {
  private cache = new Map<AgentCLI, { data: CliCapabilities; expiresAt: number }>();

  async discover(cli: AgentCLI, force = false): Promise<CliCapabilities> {
    const cached = this.cache.get(cli);
    if (!force && cached && Date.now() < cached.expiresAt) return cached.data;

    // 1. Check availability
    let availability: CLIAvailability;
    try {
      const raw = await invoke<{ available: boolean; path?: string }>('check_cli_available', { binary: cli });
      availability = { cli, available: raw.available, path: raw.path, checkedAt: new Date().toISOString() };
    } catch {
      availability = { cli, available: false, checkedAt: new Date().toISOString() };
    }

    if (!availability.available) {
      const result: CliCapabilities = {
        cli, available: false, helpSummary: '',
        supportsPrintFlag: false, supportsNonInteractive: false,
        checkedAt: availability.checkedAt,
      };
      this.cache.set(cli, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }

    // 2. Get help summary
    let helpSummary = '';
    let supportsPrintFlag = false;
    let supportsNonInteractive = false;

    try {
      const helpResult = await invoke<{ binary: string; available: boolean; help_text: string; path?: string }>(
        'get_cli_help', { binary: cli },
      );
      helpSummary = helpResult.help_text;
      const lower = helpSummary.toLowerCase();
      supportsPrintFlag       = lower.includes('--print') || lower.includes('-p');
      supportsNonInteractive  = lower.includes('non-interactive') || lower.includes('--print') || lower.includes('no-interactive');
    } catch {
      helpSummary = 'Help unavailable';
    }

    const result: CliCapabilities = {
      cli,
      available: true,
      path: availability.path,
      helpSummary,
      supportsPrintFlag,
      supportsNonInteractive,
      checkedAt: new Date().toISOString(),
    };

    this.cache.set(cli, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  async discoverAll(force = false): Promise<CliCapabilities[]> {
    return Promise.all((['claude', 'codex'] as AgentCLI[]).map(cli => this.discover(cli, force)));
  }

  getCached(cli: AgentCLI): CliCapabilities | null {
    const cached = this.cache.get(cli);
    return cached ? cached.data : null;
  }

  clearCache() { this.cache.clear(); }
}

export const cliDiscoveryService = new CliDiscoveryServiceImpl();

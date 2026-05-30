/**
 * TerminalPanel — AURA Phase 3E QA2
 *
 * Safe terminal panel wired to the Tauri native command bridge.
 * Only allowlisted commands — no arbitrary shell.
 * Shows workspace path, repo status, stdout/stderr, exit code, duration.
 *
 * Phase 3E QA2 fixes:
 *  - Shows resolved workspace path (fixes installed-app cwd bug)
 *  - exitCode field properly mapped from Rust camelCase serialization
 *  - "Set AURA repo" button to persist workspace path
 *  - cargo test added to command buttons
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Play, Trash2, Copy, CheckCircle, XCircle, Clock,
  Terminal, FolderOpen, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { notificationService } from '../../services/notifications/NotificationService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandResult {
  program: string;
  args: string[];
  exitCode: number;       // Rust serde camelCase (rename_all = "camelCase")
  stdout: string;
  stderr: string;
  durationMs: number;
  allowed: boolean;
  cwd: string;
  error?: string;
}

interface WorkspaceStatus {
  workspacePath: string;
  hasPackageJson: boolean;
  hasGit: boolean;
  isConfigured: boolean;
}

interface TerminalEntry {
  id: string;
  label: string;
  command: string;
  result?: CommandResult;
  running: boolean;
  timestamp: string;
}

// ─── Allowed command buttons ──────────────────────────────────────────────────

const ALLOWED_BUTTONS = [
  { label: 'git status',    program: 'git',   args: ['status', '--short'],        description: 'Show working tree changes' },
  { label: 'git branch',    program: 'git',   args: ['branch', '--show-current'], description: 'Current branch name' },
  { label: 'git log',       program: 'git',   args: ['log', '--oneline', '-20'],  description: 'Last 20 commits' },
  { label: 'npm lint',      program: 'npm',   args: ['run', 'lint'],              description: 'TypeScript type check' },
  { label: 'npm build',     program: 'npm',   args: ['run', 'build'],             description: 'Vite production build (slow)' },
  { label: 'cargo test',    program: 'cargo', args: ['test'],                     description: 'Run Rust unit tests' },
] as const;

const MAX_ENTRIES = 50;
const KNOWN_AURA_PATH = 'C:\\Users\\karim\\Documents\\AURA\\agent-command-center';

// ─── Component ────────────────────────────────────────────────────────────────

export function TerminalPanel() {
  const [entries, setEntries]         = useState<TerminalEntry[]>([]);
  const [copied, setCopied]           = useState<string | null>(null);
  const [workspace, setWorkspace]     = useState<WorkspaceStatus | null>(null);
  const [wsLoading, setWsLoading]     = useState(false);
  const [runningCmds, setRunningCmds] = useState<Set<string>>(new Set());
  const bottomRef                     = useRef<HTMLDivElement | null>(null);

  // Load workspace status on mount
  useEffect(() => {
    loadWorkspace();
  }, []);

  const loadWorkspace = useCallback(async () => {
    setWsLoading(true);
    try {
      const status = await invoke<WorkspaceStatus>('get_workspace_path');
      setWorkspace(status);
    } catch {
      setWorkspace(null);
    } finally {
      setWsLoading(false);
    }
  }, []);

  const setKnownAuraPath = useCallback(async () => {
    try {
      await invoke('set_workspace_path', { path: KNOWN_AURA_PATH });
      await loadWorkspace();
    } catch (err) {
      notificationService.add({
        type: 'warning', title: 'Workspace not set',
        message: String(err), ttl: 6000,
      });
    }
  }, [loadWorkspace]);

  const addEntry = useCallback((label: string, command: string): string => {
    const id = `te-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setEntries(prev => [...prev, { id, label, command, running: true, timestamp: new Date().toLocaleTimeString() }].slice(-MAX_ENTRIES));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    return id;
  }, []);

  const updateEntry = useCallback((id: string, result: CommandResult) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, running: false, result } : e));
    setRunningCmds(prev => { const n = new Set(prev); n.delete(id); return n; });

    if (result.exitCode !== 0 && result.exitCode !== undefined) {
      notificationService.add({
        type: 'warning',
        title: `Command failed: ${result.program} ${result.args.join(' ')}`,
        message: (result.stderr?.slice(0, 120) || result.error || `exit ${result.exitCode}`),
        ttl: 8000,
      });
    }
  }, []);

  const runCommand = useCallback(async (label: string, program: string, args: string[]) => {
    const displayCmd = `${program} ${args.join(' ')}`;
    const id = addEntry(label, displayCmd);
    setRunningCmds(prev => new Set([...prev, id]));
    try {
      const result = await invoke<CommandResult>('run_allowed_command', { program, args });
      updateEntry(id, result);
      // Refresh workspace after any git/npm command
      if (program === 'git' || program === 'npm') loadWorkspace();
    } catch (err) {
      updateEntry(id, {
        program, args,
        exitCode: -1, stdout: '', stderr: '', durationMs: 0, allowed: false,
        cwd: workspace?.workspacePath ?? '?',
        error: String(err),
      });
    }
  }, [addEntry, updateEntry, loadWorkspace, workspace]);

  const copyOutput = useCallback(async (entry: TerminalEntry) => {
    if (!entry.result) return;
    const text = [`$ ${entry.command}`, entry.result.stdout, entry.result.stderr ? `[stderr] ${entry.result.stderr}` : ''].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(entry.id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const isConfigured = workspace?.isConfigured ?? false;

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px]">
      {/* Workspace status bar */}
      <div className={cn(
        'shrink-0 px-3 py-2 border-b text-[10px] flex items-start gap-2',
        isConfigured ? 'border-zinc-800/50 bg-zinc-950/60' : 'border-amber-500/20 bg-amber-500/5',
      )}>
        {wsLoading ? (
          <span className="text-zinc-600 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Detecting workspace…</span>
        ) : isConfigured ? (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-0.5">
              <CheckCircle className="w-3 h-3 shrink-0" /> Workspace ready
            </div>
            <div className="text-zinc-600 font-mono truncate">{workspace?.workspacePath}</div>
          </div>
        ) : (
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <AlertTriangle className="w-3 h-3 shrink-0" /> Workspace not configured
            </div>
            <div className="text-zinc-600">
              Commands may run from the wrong directory.
              {workspace?.workspacePath && <span className="font-mono ml-1 text-zinc-700">{workspace.workspacePath}</span>}
            </div>
            <button
              onClick={setKnownAuraPath}
              className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors text-[10px] font-semibold"
            >
              <FolderOpen className="w-2.5 h-2.5" />
              Use AURA repo ({KNOWN_AURA_PATH.split('\\').pop()})
            </button>
          </div>
        )}
        <button onClick={loadWorkspace} className="shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors p-0.5 mt-0.5" title="Refresh workspace status">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Command buttons */}
      <div className="shrink-0 px-2 py-1.5 border-b border-zinc-800/50 flex flex-wrap gap-1">
        {ALLOWED_BUTTONS.map(btn => {
          const isRunning = [...runningCmds].some(id => entries.find(e => e.id === id && e.command === `${btn.program} ${btn.args.join(' ')}`));
          return (
            <button
              key={btn.label}
              onClick={() => runCommand(btn.label, btn.program, [...btn.args])}
              disabled={isRunning}
              title={btn.description}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md border text-zinc-300 transition-colors font-mono text-[10px]',
                isRunning
                  ? 'bg-zinc-800/40 border-zinc-700/30 text-zinc-600 cursor-not-allowed'
                  : 'bg-zinc-800/60 border-zinc-700/50 hover:bg-zinc-700/70 hover:text-white',
              )}
            >
              {isRunning
                ? <RefreshCw className="w-2.5 h-2.5 text-amber-400 animate-spin shrink-0" />
                : <Play className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              }
              {btn.label}
            </button>
          );
        })}
        {entries.length > 0 && (
          <button
            onClick={() => setEntries([])}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-zinc-600 hover:text-rose-400 transition-colors text-[10px]"
            title="Clear output"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Output area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 font-mono">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <Terminal className="w-5 h-5 text-zinc-700 mb-2" />
            <span className="text-zinc-600 text-[10px]">Run a command to see output</span>
          </div>
        )}

        {entries.map(entry => (
          <div key={entry.id} className="rounded-lg border border-zinc-800/60 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-900/80 border-b border-zinc-800/40">
              <div className="flex items-center gap-2 min-w-0">
                {entry.running ? (
                  <RefreshCw className="w-2.5 h-2.5 text-amber-400 animate-spin shrink-0" />
                ) : entry.result?.exitCode === 0 ? (
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                )}
                <span className="text-zinc-300 truncate">$ {entry.command}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {entry.result && (
                  <>
                    <span className="text-zinc-600 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{entry.result.durationMs}ms
                    </span>
                    <span className={cn(
                      'text-[9px] font-semibold px-1.5 py-0.5 rounded',
                      entry.result.exitCode === 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400',
                    )}>
                      exit {entry.result.exitCode ?? '?'}
                    </span>
                  </>
                )}
                <span className="text-zinc-700 text-[9px]">{entry.timestamp}</span>
                <button onClick={() => copyOutput(entry)} className="text-zinc-600 hover:text-zinc-300 transition-colors" title="Copy output">
                  {copied === entry.id
                    ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                    : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* CWD hint */}
            {entry.result?.cwd && (
              <div className="px-2.5 py-0.5 text-[9px] text-zinc-700 bg-zinc-950/40 font-mono truncate border-b border-zinc-800/30">
                cwd: {entry.result.cwd}
              </div>
            )}

            {/* Output */}
            {entry.running && (
              <div className="px-2.5 py-2 text-amber-400 text-[10px] animate-pulse">Running…</div>
            )}
            {!entry.running && entry.result && (
              <div className="px-2.5 py-2 max-h-48 overflow-y-auto">
                {entry.result.stdout && (
                  <pre className="text-zinc-300 text-[10px] leading-relaxed whitespace-pre-wrap break-words">{entry.result.stdout}</pre>
                )}
                {entry.result.stderr && (
                  <pre className="text-rose-400/80 text-[10px] leading-relaxed whitespace-pre-wrap break-words mt-1">{entry.result.stderr}</pre>
                )}
                {entry.result.error && !entry.result.stderr && (
                  <pre className="text-rose-400 text-[10px] leading-relaxed">{entry.result.error}</pre>
                )}
                {!entry.result.stdout && !entry.result.stderr && !entry.result.error && (
                  <span className="text-zinc-600 text-[10px]">(no output)</span>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

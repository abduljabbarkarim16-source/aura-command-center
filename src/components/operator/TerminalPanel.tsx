/**
 * TerminalPanel — AURA Phase 3E QA
 *
 * Safe terminal panel wired to the Tauri native command bridge.
 * Only allowed commands are shown — no arbitrary shell input.
 * Displays stdout/stderr, exit code, duration, and timestamp.
 *
 * Security: allowlist enforced in Rust; UI only shows pre-defined command buttons.
 */

import React, { useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play, Trash2, Copy, CheckCircle, XCircle, Clock, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { notificationService } from '../../services/notifications/NotificationService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandResult {
  program: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  allowed: boolean;
  error?: string;
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
  { label: 'npm build',     program: 'npm',   args: ['run', 'build'],             description: 'Vite production build' },
  { label: 'cargo test',    program: 'cargo', args: ['test'],                     description: 'Run Rust unit tests' },
] as const;

const MAX_ENTRIES = 50;

// ─── Component ────────────────────────────────────────────────────────────────

export function TerminalPanel() {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [copied, setCopied]   = useState<string | null>(null);
  const bottomRef             = useRef<HTMLDivElement | null>(null);

  const addEntry = useCallback((label: string, command: string): string => {
    const id = `te-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const entry: TerminalEntry = {
      id, label, command, running: true,
      timestamp: new Date().toLocaleTimeString(),
    };
    setEntries(prev => [...prev, entry].slice(-MAX_ENTRIES));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    return id;
  }, []);

  const updateEntry = useCallback((id: string, result: CommandResult) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, running: false, result } : e));

    // Notify on failure
    if (result.exitCode !== 0) {
      notificationService.add({
        type:    'warning',
        title:   `Command failed: ${result.program} ${result.args.join(' ')}`,
        message: result.stderr?.slice(0, 120) || result.error || 'Non-zero exit code',
        ttl:     8000,
      });
    }
  }, []);

  const runCommand = useCallback(async (label: string, program: string, args: string[]) => {
    const displayCmd = `${program} ${args.join(' ')}`;
    const id = addEntry(label, displayCmd);
    try {
      const result = await invoke<CommandResult>('run_allowed_command', { program, args });
      updateEntry(id, result);
    } catch (err) {
      updateEntry(id, {
        program, args,
        exitCode:   -1,
        stdout:     '',
        stderr:     String(err),
        durationMs: 0,
        allowed:    false,
        error:      String(err),
      });
    }
  }, [addEntry, updateEntry]);

  const copyOutput = useCallback(async (entry: TerminalEntry) => {
    if (!entry.result) return;
    const text = [
      `$ ${entry.command}`,
      entry.result.stdout,
      entry.result.stderr ? `[stderr] ${entry.result.stderr}` : '',
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(entry.id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 text-[11px]">
      {/* Command buttons */}
      <div className="shrink-0 px-2 py-2 border-b border-zinc-800/50 flex flex-wrap gap-1">
        {ALLOWED_BUTTONS.map(btn => (
          <button
            key={btn.label}
            onClick={() => runCommand(btn.label, btn.program, [...btn.args])}
            title={btn.description}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/70 hover:text-white transition-colors font-mono text-[10px]"
          >
            <Play className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            {btn.label}
          </button>
        ))}
        {entries.length > 0 && (
          <button
            onClick={() => setEntries([])}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-zinc-600 hover:text-rose-400 transition-colors"
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
            {/* Command header */}
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-900/80 border-b border-zinc-800/40">
              <div className="flex items-center gap-2 min-w-0">
                {entry.running ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                ) : entry.result?.exitCode === 0 ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                )}
                <span className="text-zinc-300 truncate">$ {entry.command}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {entry.result && (
                  <>
                    <span className="text-zinc-600 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{entry.result.durationMs}ms
                    </span>
                    <span className={cn('font-semibold', entry.result.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400')}>
                      {entry.result.exitCode === 0 ? 'ok' : `exit ${entry.result.exitCode}`}
                    </span>
                  </>
                )}
                <span className="text-zinc-700">{entry.timestamp}</span>
                <button onClick={() => copyOutput(entry)} className="text-zinc-600 hover:text-zinc-300 transition-colors" title="Copy output">
                  {copied === entry.id ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

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

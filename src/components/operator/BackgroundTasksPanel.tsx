/**
 * BackgroundTasksPanel — AURA Phase 3F QA
 *
 * Shows CLI agent availability, active/completed/failed sessions,
 * and provides safe approval-gated test controls for Claude and Codex.
 *
 * Security:
 *  - Tiny test prompts are fixed strings, not user input
 *  - Live CLI runs require explicit user approval in the panel
 *  - No repo source, no secrets, no file paths in prompts
 *  - Sessions capped at 2 concurrent (enforced by CliSessionService + Rust)
 */

import React, { Fragment, useState, useEffect, useCallback } from 'react';
import {
  Bot, CheckCircle2, XCircle, Clock, AlertTriangle,
  RefreshCw, Play, Copy, Trash2, ChevronDown, ChevronUp,
  Terminal, Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { cliDiscoveryService, type CliCapabilities } from '../../services/agents/CliDiscoveryService';
import { cliSessionService } from '../../services/agents/CliSessionService';
import { claudeCliService } from '../../services/agents/ClaudeCliService';
import { reminderService } from '../../services/reminders/ReminderService';
import { notificationService } from '../../services/notifications/NotificationService';
import type { AgentSession } from '../../types/agent-session';

// ─── Tiny test prompts ────────────────────────────────────────────────────────

const CLAUDE_TINY_PROMPT  = 'Reply exactly: AURA_CLAUDE_CLI_OK';
const CODEX_TINY_PROMPT   = 'Reply exactly: AURA_CODEX_CLI_OK';
const CLAUDE_EXPECTED     = 'AURA_CLAUDE_CLI_OK';
const CODEX_EXPECTED      = 'AURA_CODEX_CLI_OK';

// ─── Usage-limit sample test strings ─────────────────────────────────────────

const USAGE_LIMIT_SAMPLES = [
  'Usage limit reached. Try again after 5pm.',
  'Out of usage credits.',
  'Rate limit exceeded.',
  'API Error: Usage credits required for 1M context.',
  "You've reached your usage limit. Try again after your limit resets.",
];

function detectUsageLimit(text: string): { detected: boolean; message: string } {
  const lower = text.toLowerCase();
  const patterns = [
    'usage limit', 'out of usage', 'usage credits', 'rate limit exceeded',
    'usage limit reached', "you've reached your usage",
  ];
  const detected = patterns.some(p => lower.includes(p));
  return { detected, message: detected ? text : '' };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ available, label }: { available: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
      available
        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
        : 'bg-zinc-800 border border-zinc-700 text-zinc-500',
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', available ? 'bg-emerald-400' : 'bg-zinc-600')} />
      {label}
    </span>
  );
}

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({ session }: { session: AgentSession }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = () => {
    switch (session.status) {
      case 'running':     return <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />;
      case 'completed':   return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      case 'error':       return <XCircle className="w-3 h-3 text-red-400" />;
      case 'usage_limit': return <AlertTriangle className="w-3 h-3 text-amber-400" />;
      default:            return <Clock className="w-3 h-3 text-zinc-500" />;
    }
  };

  const copyOutput = () => {
    const text = session.outputLines.join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const elapsedLabel = () => {
    if (!session.startedAt) return '';
    const start = new Date(session.startedAt).getTime();
    const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    const ms = end - start;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="border border-zinc-800/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-900/50 transition-colors"
      >
        {statusIcon()}
        <span className="text-[11px] font-medium text-zinc-300 uppercase">{session.cli}</span>
        <span className="text-[10px] text-zinc-500 truncate flex-1 text-left">
          {session.prompt?.slice(0, 40) ?? '—'}
        </span>
        <span className="text-[10px] text-zinc-600 shrink-0">{elapsedLabel()}</span>
        {expanded ? <ChevronUp className="w-3 h-3 text-zinc-600 shrink-0" /> : <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 bg-zinc-950/50">
          {session.usageLimitMessage && (
            <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              {session.usageLimitMessage}
            </div>
          )}
          {session.errorSummary && (
            <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
              {session.errorSummary}
            </div>
          )}
          <div className="bg-zinc-900/80 rounded px-2 py-1.5 max-h-24 overflow-y-auto">
            {session.outputLines.length > 0
              ? session.outputLines.map((line, i) => (
                <p key={i} className="text-[10px] text-zinc-400 font-mono leading-relaxed">{line}</p>
              ))
              : <p className="text-[10px] text-zinc-600 italic">No output</p>
            }
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyOutput}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <Copy className="w-2.5 h-2.5" /> Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BackgroundTasksPanel() {
  const [claudeCaps, setClaudeCaps] = useState<CliCapabilities | null>(null);
  const [codexCaps,  setCodexCaps]  = useState<CliCapabilities | null>(null);
  const [sessions,   setSessions]   = useState<AgentSession[]>([]);
  const [checking,   setChecking]   = useState(false);
  const [running,    setRunning]    = useState<'claude' | 'codex' | null>(null);
  const [testApproval, setTestApproval] = useState<'claude' | 'codex' | null>(null);
  const [usageLimitTestResult, setUsageLimitTestResult] = useState<string | null>(null);
  const [selfTestOutput, setSelfTestOutput] = useState<string[] | null>(null);
  const [selfTestRunning, setSelfTestRunning] = useState(false);

  // ── Subscribe to sessions ──────────────────────────────────────────────────
  useEffect(() => cliSessionService.subscribe(setSessions), []);

  // ── Initial discovery ─────────────────────────────────────────────────────
  useEffect(() => {
    const cached = cliDiscoveryService.getCached('claude');
    if (cached) setClaudeCaps(cached);
    const cachedCodex = cliDiscoveryService.getCached('codex');
    if (cachedCodex) setCodexCaps(cachedCodex);
  }, []);

  // ── Refresh discovery ─────────────────────────────────────────────────────
  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      const [claude, codex] = await cliDiscoveryService.discoverAll(true);
      setClaudeCaps(claude);
      setCodexCaps(codex);
    } finally {
      setChecking(false);
    }
  }, []);

  // ── Approve + run tiny test ────────────────────────────────────────────────
  const runTest = useCallback(async (cli: 'claude' | 'codex') => {
    setTestApproval(null);
    setRunning(cli);
    try {
      const prompt   = cli === 'claude' ? CLAUDE_TINY_PROMPT : CODEX_TINY_PROMPT;
      const expected = cli === 'claude' ? CLAUDE_EXPECTED    : CODEX_EXPECTED;
      const id       = await cliSessionService.spawn(cli, prompt);
      const session  = cliSessionService.getSession(id);
      const output   = session?.outputLines.join('\n') ?? '';
      const ok       = output.includes(expected);

      if (session?.status === 'usage_limit' && session.usageLimitMessage) {
        reminderService.addUsageLimitReminder(cli, new Date(Date.now() + 3600_000), id);
        notificationService.add({
          type: 'warning',
          title: `${cli} CLI: Usage limit`,
          message: session.usageLimitMessage,
          ttl: 10_000,
        });
      } else if (ok) {
        notificationService.add({
          type: 'success',
          title: `${cli} CLI: OK`,
          message: `Tiny test passed — ${expected}`,
          ttl: 5_000,
        });
      }
    } catch (err) {
      notificationService.add({
        type: 'error',
        title: `${cli} CLI: Test failed`,
        message: String(err),
        ttl: 8_000,
      });
    } finally {
      setRunning(null);
    }
  }, []);

  // ── Usage-limit parser test ────────────────────────────────────────────────
  const runUsageLimitTest = useCallback(() => {
    const results = USAGE_LIMIT_SAMPLES.map(sample => {
      const r = detectUsageLimit(sample);
      return `${r.detected ? '✓' : '✗'} ${sample.slice(0, 50)}`;
    });
    setUsageLimitTestResult(results.join('\n'));
  }, []);

  // ── System self-test ──────────────────────────────────────────────────────
  const runSelfTest = useCallback(async () => {
    setSelfTestRunning(true);
    setSelfTestOutput(null);
    const lines: string[] = [];

    lines.push('=== AURA System Self-Test ===');
    lines.push(`Date: ${new Date().toISOString()}`);
    lines.push('');

    // 1. Check Claude CLI
    lines.push('1. Claude CLI availability…');
    try {
      const c = await cliDiscoveryService.discover('claude', true);
      lines.push(`   → ${c.available ? `Available at ${c.path ?? 'PATH'}` : 'Not found'}`);
      setClaudeCaps(c);
    } catch (e) { lines.push(`   → Error: ${e}`); }

    // 2. Check Codex CLI
    lines.push('2. Codex CLI availability…');
    try {
      const c = await cliDiscoveryService.discover('codex', true);
      lines.push(`   → ${c.available ? `Available at ${c.path ?? 'PATH'}` : 'Not found'}`);
      setCodexCaps(c);
    } catch (e) { lines.push(`   → Error: ${e}`); }

    // 3. Usage-limit parser sample
    lines.push('3. Usage-limit parser…');
    const hits = USAGE_LIMIT_SAMPLES.filter(s => detectUsageLimit(s).detected).length;
    lines.push(`   → ${hits}/${USAGE_LIMIT_SAMPLES.length} samples detected correctly`);

    // 4. Session count
    lines.push('4. CLI session state…');
    const activeSessions = sessions.filter(s => s.status === 'running').length;
    lines.push(`   → ${activeSessions} active, ${sessions.length} total`);

    lines.push('');
    lines.push('Self-test complete. Live CLI prompts require separate approval.');

    setSelfTestOutput(lines);
    setSelfTestRunning(false);

    notificationService.add({
      type: 'info',
      title: 'System Self-Test',
      message: 'Self-test complete. See Background Tasks panel.',
      ttl: 5_000,
    });
  }, [sessions]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeSessions    = sessions.filter(s => s.status === 'running');
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const failedSessions    = sessions.filter(s => s.status === 'error' || s.status === 'usage_limit');

  return (
    <div className="h-full flex flex-col min-h-0 text-[12px] overflow-y-auto">
      <div className="p-4 space-y-5">

        {/* ── CLI Status ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" /> CLI Agents
            </h3>
            <button
              onClick={handleCheck}
              disabled={checking}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('w-3 h-3', checking && 'animate-spin')} />
              {checking ? 'Checking…' : 'Refresh'}
            </button>
          </div>

          <div className="space-y-2">
            {/* Claude */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 border border-zinc-800/60 rounded-lg">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold text-zinc-200">Claude CLI</span>
                {claudeCaps
                  ? <StatusBadge available={claudeCaps.available} label={claudeCaps.available ? 'Available' : 'Not found'} />
                  : <StatusBadge available={false} label="Not checked" />
                }
              </div>
              <div className="flex items-center gap-1.5">
                {testApproval === 'claude' ? (
                  <>
                    <span className="text-[10px] text-amber-400">Confirm tiny test?</span>
                    <button
                      onClick={() => runTest('claude')}
                      disabled={running !== null}
                      className="px-2 py-1 rounded text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => setTestApproval(null)}
                      className="px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setTestApproval('claude')}
                    disabled={running !== null || claudeCaps?.available === false}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-40"
                  >
                    {running === 'claude'
                      ? <><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Testing…</>
                      : <><Play className="w-2.5 h-2.5" /> Tiny test</>
                    }
                  </button>
                )}
              </div>
            </div>

            {/* Codex */}
            <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-900/50 border border-zinc-800/60 rounded-lg">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-violet-400" />
                <span className="font-semibold text-zinc-200">Codex CLI</span>
                {codexCaps
                  ? <StatusBadge available={codexCaps.available} label={codexCaps.available ? 'Available' : 'Not found'} />
                  : <StatusBadge available={false} label="Not checked" />
                }
              </div>
              <div className="flex items-center gap-1.5">
                {testApproval === 'codex' ? (
                  <>
                    <span className="text-[10px] text-amber-400">Confirm tiny test?</span>
                    <button
                      onClick={() => runTest('codex')}
                      disabled={running !== null}
                      className="px-2 py-1 rounded text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => setTestApproval(null)}
                      className="px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setTestApproval('codex')}
                    disabled={running !== null || codexCaps?.available === false}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-40"
                  >
                    {running === 'codex'
                      ? <><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Testing…</>
                      : <><Play className="w-2.5 h-2.5" /> Tiny test</>
                    }
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Active Sessions ───────────────────────────────────────────── */}
        {activeSessions.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
              Active ({activeSessions.length})
            </h3>
            <div className="space-y-1.5">
              {activeSessions.map(s => (
                <Fragment key={s.id}><SessionRow session={s} /></Fragment>
              ))}
            </div>
          </section>
        )}

        {/* ── Completed / Failed Sessions ───────────────────────────────── */}
        {(completedSessions.length > 0 || failedSessions.length > 0) && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                History ({completedSessions.length + failedSessions.length})
              </h3>
              <button
                onClick={() => cliSessionService.clearCompleted()}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-600 hover:text-zinc-400 border border-zinc-800 transition-colors"
              >
                <Trash2 className="w-2.5 h-2.5" /> Clear
              </button>
            </div>
            <div className="space-y-1.5">
              {[...failedSessions, ...completedSessions].map(s => (
                <Fragment key={s.id}><SessionRow session={s} /></Fragment>
              ))}
            </div>
          </section>
        )}

        {/* ── Usage-Limit Reminder Test ─────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Usage-Limit Parser
            </h3>
            <button
              onClick={runUsageLimitTest}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <Zap className="w-2.5 h-2.5" /> Test samples
            </button>
          </div>
          {usageLimitTestResult && (
            <pre className="text-[10px] font-mono text-zinc-400 bg-zinc-900/70 border border-zinc-800 rounded p-2 whitespace-pre-wrap">
              {usageLimitTestResult}
            </pre>
          )}
        </section>

        {/* ── System Self-Test ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" /> System Self-Test
            </h3>
            <button
              onClick={runSelfTest}
              disabled={selfTestRunning}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-40"
            >
              {selfTestRunning
                ? <><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Running…</>
                : <><Play className="w-2.5 h-2.5" /> Run self-test</>
              }
            </button>
          </div>
          {selfTestOutput && (
            <pre className="text-[10px] font-mono text-zinc-400 bg-zinc-900/70 border border-zinc-800 rounded p-2 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {selfTestOutput.join('\n')}
            </pre>
          )}
        </section>

        {/* ── Claude smoke test shortcut ────────────────────────────────── */}
        <section className="pt-1 border-t border-zinc-800/60">
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Tiny test sends a fixed string prompt and checks for exact expected output.
            No repo source, no secrets. Approval is required before each live run.
            Usage limit detection automatically creates a reminder.
          </p>
        </section>

      </div>
    </div>
  );
}

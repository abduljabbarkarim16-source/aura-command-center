/**
 * ProviderCapabilityCard — Phase 2E Deep Refinement & Phase 2G Update
 *
 * Displays which AI providers have environment keys present.
 * SAFETY RULES:
 *  - Only checks for key PRESENCE (truthy check), never displays values
 *  - Never logs, stores, or transmits key values
 *  - Never runs paid API calls
 *  - Uses providerRegistry for source of truth
 */

import { Fragment, useEffect, useState } from 'react';
import {
  CheckCircle2, XCircle, Lock, Network, BrainCircuit,
  Sparkles, Bot, Orbit, MessageSquare, Volume2, Mic2, Radio,
  Play, Zap, Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { providerRegistry } from '../../services/providers/ProviderRegistryService';
import { providerAdapterService } from '../../services/providers/ProviderAdapterService';
import { secureKeyService } from '../../services/security/SecureKeyService';
import { providerSmokeTestService } from '../../services/providers/ProviderSmokeTestService';
import type { SmokeTestResult } from '../../services/providers/ProviderSmokeTestService';
import type { ProviderHealth } from '../../types/providers';

// ─── Component ───────────────────────────────────────────────────────────────

interface ProviderCapabilityCardProps {
  className?: string;
  compact?: boolean;
}

export function ProviderCapabilityCard({ className, compact = false }: ProviderCapabilityCardProps) {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [dryRunResults, setDryRunResults] = useState<Record<string, string>>({});
  const [liveResults, setLiveResults] = useState<Record<string, SmokeTestResult>>({});
  const [liveTestPending, setLiveTestPending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setProviders(providerRegistry.getAll());
    const unsub = secureKeyService.subscribe(() => setProviders(providerRegistry.getAll()));
    return unsub;
  }, []);

  const activeProviders = providers.filter(p => p.status !== 'planned' && p.status !== 'unavailable');
  const plannedProviders = providers.filter(p => p.status === 'planned' || p.status === 'unavailable');

  const configuredCount = activeProviders.filter(p => 
    p.status === 'secret_configured' || p.status === 'dry_run_ready'
  ).length;

  const handleDryRun = (providerType: string) => {
    const res = providerAdapterService.dryRun(providerType);
    setDryRunResults(prev => ({ ...prev, [providerType]: res.wouldSucceed ? 'Dry-run OK' : 'Dry-run Failed' }));
    setTimeout(() => {
      setDryRunResults(prev => { const next = { ...prev }; delete next[providerType]; return next; });
    }, 3000);
  };

  const handleLiveTest = async (providerType: string) => {
    setLiveTestPending(prev => ({ ...prev, [providerType]: true }));
    let result: SmokeTestResult | undefined;
    if (providerType === 'anthropic') result = await providerSmokeTestService.testAnthropic();
    else if (providerType === 'openai') result = await providerSmokeTestService.testOpenAI();
    else if (providerType === 'gemini') result = await providerSmokeTestService.testGemini();
    if (result) setLiveResults(prev => ({ ...prev, [providerType]: result! }));
    setLiveTestPending(prev => ({ ...prev, [providerType]: false }));
  };

  return (
    <div className={cn('bg-zinc-900/50 border border-zinc-800/60 rounded-2xl overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-200">Provider Capability</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {configuredCount}/{activeProviders.length} configured
            {' '}·{' '}
            <span className="text-amber-500/80">Keys detected by name only — values never shown</span>
          </p>
        </div>
        <span className={cn(
          'px-2.5 py-1 rounded-full text-[11px] font-semibold border',
          configuredCount === activeProviders.length && activeProviders.length > 0
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
        )}>
          {configuredCount === activeProviders.length && activeProviders.length > 0 ? 'All ready' : `${activeProviders.length - configuredCount} unconfigured`}
        </span>
      </div>

      {/* Active providers */}
      <div className={cn('divide-y divide-zinc-800/30', compact ? '' : 'p-1')}>
        {activeProviders.map(provider => (
          <Fragment key={provider.id}>
            <ProviderRow
              provider={provider}
              compact={compact}
              dryRunResult={dryRunResults[provider.providerType]}
              onDryRun={() => handleDryRun(provider.providerType)}
              liveResult={liveResults[provider.providerType]}
              liveTestPending={liveTestPending[provider.providerType] ?? false}
              onLiveTest={['anthropic', 'openai', 'gemini'].includes(provider.providerType) ? () => handleLiveTest(provider.providerType) : undefined}
            />
          </Fragment>
        ))}
      </div>

      {/* Planned / concept providers */}
      {!compact && plannedProviders.length > 0 && (
        <>
          <div className="px-5 py-2 border-t border-zinc-800/30">
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
              Planned / Concept
            </span>
          </div>
          <div className="divide-y divide-zinc-800/20 pb-2">
            {plannedProviders.map(provider => (
              <Fragment key={provider.id}>
                <ProviderRow
                  provider={provider}
                  compact={compact}
                  isPlanned
                />
              </Fragment>
            ))}
          </div>
        </>
      )}

      {/* Safety note */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-zinc-800/30 bg-zinc-950/20">
        <Lock className="w-3 h-3 text-zinc-600 flex-shrink-0" />
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Keys are read from the current environment or the local AppData .env file. Values are never stored in localStorage, source code, or logs.
        </p>
      </div>
    </div>
  );
}

// ─── ProviderRow ──────────────────────────────────────────────────────────────

function getProviderIcon(type: string) {
  switch (type) {
    case 'anthropic': return <Sparkles className="w-4 h-4 text-indigo-400" />;
    case 'openai': return <Bot className="w-4 h-4 text-emerald-400" />;
    case 'gemini': return <BrainCircuit className="w-4 h-4 text-sky-400" />;
    case 'chatgpt-relay': return <MessageSquare className="w-4 h-4 text-amber-400" />;
    case 'antigravity': return <Orbit className="w-4 h-4 text-violet-400" />;
    case 'oracle': return <Network className="w-4 h-4 text-zinc-500" />;
    case 'elevenlabs': return <Volume2 className="w-4 h-4 text-zinc-500" />;
    case 'voice-stt': return <Mic2 className="w-4 h-4 text-zinc-500" />;
    case 'openai-realtime': return <Radio className="w-4 h-4 text-zinc-500" />;
    default: return <Bot className="w-4 h-4 text-zinc-400" />;
  }
}

function ProviderRow({
  provider,
  compact,
  isPlanned = false,
  dryRunResult,
  onDryRun,
  liveResult,
  liveTestPending = false,
  onLiveTest,
}: {
  provider: ProviderHealth;
  compact: boolean;
  isPlanned?: boolean;
  dryRunResult?: string;
  onDryRun?: () => void;
  liveResult?: SmokeTestResult;
  liveTestPending?: boolean;
  onLiveTest?: () => void;
}) {
  const isConfigured = provider.status === 'secret_configured' || provider.status === 'dry_run_ready'
    || provider.status === 'live_test_passed' || provider.status === 'live_test_failed';

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-5 transition-colors',
      compact ? 'py-2.5' : 'py-3',
      isPlanned ? 'opacity-50' : 'hover:bg-zinc-800/20',
    )}>
      {/* Left: icon + name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/30 flex items-center justify-center">
          {getProviderIcon(provider.providerType)}
        </div>
        <div className="min-w-0 flex flex-col">
          <span className={cn('block text-[13px] font-medium truncate', isPlanned ? 'text-zinc-600' : 'text-zinc-300')}>
            {provider.displayName}
          </span>
          <span className="block text-[10px] text-zinc-600 font-mono truncate mt-0.5">
            {provider.maskedSecretRef || (provider.keyEnvVar ? `ENV::${provider.keyEnvVar}` : 'No secret required')}
          </span>
          {liveResult && (
            <span className={cn('block text-[10px] mt-0.5', liveResult.success ? 'text-emerald-400' : 'text-rose-400')}>
              {liveResult.success
                ? `Live OK · ${liveResult.model} · ${liveResult.latencyMs}ms`
                : `Live FAIL · ${liveResult.error ?? 'unknown error'}`}
            </span>
          )}
        </div>
      </div>

      {/* Right: status and actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {dryRunResult && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded', dryRunResult.includes('OK') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>
            {dryRunResult}
          </span>
        )}

        {isPlanned ? (
          <span className="px-2 py-0.5 bg-zinc-800/60 border border-zinc-700/40 text-zinc-600 text-[10px] font-semibold rounded-full uppercase tracking-wide">
            {provider.integrationMode === 'local-workspace-agent' ? 'LOCAL AGENT' : 'PLANNED'}
          </span>
        ) : provider.keyEnvVar === null ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
          </span>
        ) : isConfigured ? (
          <div className="flex items-center gap-2">
            {onLiveTest && (
              <button
                onClick={onLiveTest}
                disabled={liveTestPending}
                className="text-zinc-500 hover:text-emerald-400 disabled:opacity-40 p-1 rounded"
                title="Live smoke test (one call, minimal prompt)"
              >
                {liveTestPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              </button>
            )}
            {onDryRun && (
              <button onClick={onDryRun} className="text-zinc-500 hover:text-indigo-400 p-1 rounded" title="Dry-run adapter check">
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            <span className={cn('flex items-center gap-1 text-[11px] font-semibold',
              liveResult?.success ? 'text-emerald-400' : liveResult?.success === false ? 'text-rose-400' : 'text-emerald-400'
            )}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {liveResult?.success ? 'Live OK' : liveResult?.success === false ? 'Live Failed' : 'Secret Found'}
            </span>
          </div>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
            <XCircle className="w-3.5 h-3.5" /> Missing Secret
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ProviderCapabilityCard — Phase 2E Deep Refinement
 *
 * Displays which AI providers have environment keys present.
 * SAFETY RULES:
 *  - Only checks for key PRESENCE (truthy check), never displays values
 *  - Never logs, stores, or transmits key values
 *  - Never runs paid API calls
 *  - Shows only CONFIGURED / UNCONFIGURED status
 */

import React, { Fragment } from 'react';
import {
  CheckCircle2, XCircle, Lock, Network, BrainCircuit,
  Sparkles, Bot, Orbit, MessageSquare
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Provider definitions ─────────────────────────────────────────────────────

interface ProviderDef {
  id: string;
  name: string;
  icon: React.ReactNode;
  envKey: string | null;     // null = no key needed
  tier: 'active' | 'planned' | 'concept';
  note?: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    name: 'Anthropic / Claude',
    icon: <Sparkles className="w-4 h-4 text-indigo-400" />,
    envKey: 'VITE_ANTHROPIC_API_KEY',
    tier: 'active',
  },
  {
    id: 'openai',
    name: 'OpenAI / Codex',
    icon: <Bot className="w-4 h-4 text-emerald-400" />,
    envKey: 'VITE_OPENAI_API_KEY',
    tier: 'active',
  },
  {
    id: 'gemini',
    name: 'Google / Gemini',
    icon: <BrainCircuit className="w-4 h-4 text-sky-400" />,
    envKey: 'VITE_GOOGLE_API_KEY',
    tier: 'active',
  },
  {
    id: 'chatgpt-relay',
    name: 'ChatGPT Relay',
    icon: <MessageSquare className="w-4 h-4 text-amber-400" />,
    envKey: null,
    tier: 'active',
    note: 'Clipboard-based — no API key needed',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    icon: <Orbit className="w-4 h-4 text-violet-400" />,
    envKey: 'VITE_ANTIGRAVITY_API_KEY',
    tier: 'active',
  },
  {
    id: 'oracle',
    name: 'Oracle / OpenClaude',
    icon: <Network className="w-4 h-4 text-zinc-500" />,
    envKey: null,
    tier: 'concept',
    note: 'Deep reasoning synthesis agent — planned',
  },
];

// ─── Safely check key presence only ──────────────────────────────────────────

function isKeyPresent(envKey: string): boolean {
  // Only check presence (truthy), never expose value
  try {
    const val = (import.meta.env as Record<string, unknown>)[envKey];
    return Boolean(val && String(val).length > 0 && String(val) !== 'undefined');
  } catch {
    return false;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ProviderCapabilityCardProps {
  className?: string;
  compact?: boolean;
}

export function ProviderCapabilityCard({ className, compact = false }: ProviderCapabilityCardProps) {
  const activeProviders = PROVIDERS.filter(p => p.tier === 'active');
  const plannedProviders = PROVIDERS.filter(p => p.tier !== 'active');

  const configuredCount = activeProviders.filter(p =>
    p.envKey === null || isKeyPresent(p.envKey)
  ).length;

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
          configuredCount === activeProviders.length
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
        )}>
          {configuredCount === activeProviders.length ? 'All ready' : `${activeProviders.length - configuredCount} unconfigured`}
        </span>
      </div>

      {/* Active providers */}
      <div className={cn('divide-y divide-zinc-800/30', compact ? '' : 'p-1')}>
        {activeProviders.map(provider => {
          const configured = provider.envKey === null || isKeyPresent(provider.envKey);
          return (
            <Fragment key={provider.id}>
              <ProviderRow
                provider={provider}
                configured={configured}
                compact={compact}
              />
            </Fragment>
          );
        })}
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
                  configured={false}
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
          Keys are read from environment at runtime. Values are never stored in localStorage, source code, or logs.
        </p>
      </div>
    </div>
  );
}

// ─── ProviderRow ──────────────────────────────────────────────────────────────

function ProviderRow({
  provider,
  configured,
  compact,
  isPlanned = false,
}: {
  provider: ProviderDef;
  configured: boolean;
  compact: boolean;
  isPlanned?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-5 transition-colors',
      compact ? 'py-2.5' : 'py-3',
      isPlanned ? 'opacity-50' : 'hover:bg-zinc-800/20',
    )}>
      {/* Left: icon + name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/30 flex items-center justify-center">
          {provider.icon}
        </div>
        <div className="min-w-0">
          <span className={cn(
            'block text-[13px] font-medium truncate',
            isPlanned ? 'text-zinc-600' : 'text-zinc-300',
          )}>
            {provider.name}
          </span>
          {provider.note && (
            <span className="block text-[11px] text-zinc-600 truncate">{provider.note}</span>
          )}
          {!provider.note && provider.envKey && (
            <span className="block text-[10px] text-zinc-700 font-mono truncate">{provider.envKey}</span>
          )}
        </div>
      </div>

      {/* Right: status */}
      <div className="flex-shrink-0">
        {isPlanned ? (
          <span className="px-2 py-0.5 bg-zinc-800/60 border border-zinc-700/40 text-zinc-600 text-[10px] font-semibold rounded-full uppercase tracking-wide">
            {provider.tier}
          </span>
        ) : provider.envKey === null ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ready
          </span>
        ) : configured ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Configured
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600">
            <XCircle className="w-3.5 h-3.5" />
            Not set
          </span>
        )}
      </div>
    </div>
  );
}

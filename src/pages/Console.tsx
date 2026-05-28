/**
 * Console — Phase 2E Voice Core
 *
 * Voice Core is now the default post-launch mode.
 * Chat console is an optional layer — opened from Voice Core or via mode toggle.
 *
 * Modes:
 *   voiceCore    → AuraVoiceCore (default)
 *   chatConsole  → Legacy chat stream + composer
 *   adminPanel is an overlay on top of either mode, toggled from Voice Core
 */

import React, { useState, useMemo, Fragment } from 'react';
import { Settings2, ArrowLeft } from 'lucide-react';
import { mockMessages } from '../store/mockData';

import { AuraLaunchScreen }    from '../components/operator/AuraLaunchScreen';
import { AuraVoiceCore }       from '../components/operator/AuraVoiceCore';
import { AdminPanelOverlay }   from '../components/operator/AdminPanelOverlay';
import { AuraComposer }        from '../components/operator/AuraComposer';
import { OperatorRail }        from '../components/operator/OperatorRail';
import { TechnicalDrawer }     from '../components/operator/TechnicalDrawer';
import { AssistantMessage }    from '../components/operator/AssistantMessage';
import { SessionDivider }      from '../components/operator/SystemEventCard';
import { AuraPresenceDot }     from '../components/operator/AuraVoiceVisualizer';
import { cn }                  from '../lib/utils';

import type {
  AuraMessage, SystemMessage, AgentHandoffMessage, ToolStatusMessage,
} from '../components/operator/AssistantMessage';
import type { VisualizerState } from '../components/operator/AuraVoiceVisualizer';

// ─── Mode type ────────────────────────────────────────────────────────────────

type ConsoleMode = 'voiceCore' | 'chatConsole';

// ─── Map legacy mockMessages → typed AuraMessage array ───────────────────────

function toLegacyMessages(): AuraMessage[] {
  return mockMessages.map(msg => {
    if (msg.role === 'user') {
      return { id: msg.id, type: 'user' as const, content: msg.content, timestamp: msg.timestamp };
    }

    if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const tc = msg.toolCalls[0];
        return {
          id: msg.id,
          type: 'approval-request' as const,
          timestamp: msg.timestamp,
          agentId: msg.agentId,
          title: `Tool Request — ${tc.name}`,
          summary: `${msg.agentId ?? 'Agent'} is requesting permission to run ${tc.name} with args: ${tc.args}`,
          riskLevel: 'medium' as const,
          requestedAction: tc.name,
          sourceAgent: msg.agentId ?? 'Agent',
          targetAgent: 'local-shell',
        };
      }
      return {
        id: msg.id,
        type: 'assistant' as const,
        content: msg.content,
        timestamp: msg.timestamp,
        agentId: msg.agentId,
        agentName: msg.agentId ?? 'AURA',
      };
    }

    const content = msg.content;
    const agentId = msg.agentId ?? '';

    if (agentId.includes('Handoff') || content.toLowerCase().includes('handoff')) {
      return {
        id: msg.id,
        type: 'agent-handoff' as const,
        timestamp: msg.timestamp,
        sourceAgent: 'Claude Architect',
        targetAgent: 'Codex Dev',
        objective: content,
        status: 'pending' as const,
      } satisfies AgentHandoffMessage;
    }

    if (agentId.includes('Runner') || content.toLowerCase().includes('dev server')) {
      return {
        id: msg.id,
        type: 'tool-status' as const,
        timestamp: msg.timestamp,
        toolName: 'Dev Server',
        status: 'completed' as const,
        detail: 'localhost:5173 ready',
      } satisfies ToolStatusMessage;
    }

    if (agentId.includes('Browser') || content.toLowerCase().includes('warning')) {
      return {
        id: msg.id,
        type: 'tool-status' as const,
        timestamp: msg.timestamp,
        toolName: 'Browser Agent',
        status: 'running' as const,
        detail: 'DOM warning corrected',
      } satisfies ToolStatusMessage;
    }

    return {
      id: msg.id,
      type: 'system' as const,
      timestamp: msg.timestamp,
      title: agentId || 'System',
      summary: content,
      expandable: content.length > 60,
      detail: content,
    } satisfies SystemMessage;
  });
}

// ─── Console ──────────────────────────────────────────────────────────────────

export function Console() {
  const [hasInitiated,    setHasInitiated]    = useState(false);
  const [mode,            setMode]            = useState<ConsoleMode>('voiceCore');
  const [isDrawerOpen,    setIsDrawerOpen]    = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(true);
  const [isAdminOpen,     setIsAdminOpen]     = useState(false);
  const [auraState] = useState<VisualizerState>('idle');

  const messages = useMemo(() => toLegacyMessages(), []);

  // ── Launch screen (pre-initiation) ──────────────────────────────
  if (!hasInitiated) {
    return <AuraLaunchScreen onInitiate={() => setHasInitiated(true)} />;
  }

  // ── Voice Core mode (default) ────────────────────────────────────
  if (mode === 'voiceCore') {
    return (
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-zinc-950">
        <AuraVoiceCore
          auraState={auraState}
          onOpenConsole={() => setMode('chatConsole')}
          onOpenAdminPanel={() => setIsAdminOpen(true)}
          onOpenTechnicalDrawer={() => {
            setIsAdminOpen(false);
            setIsDrawerOpen(true);
          }}
        />

        {/* Admin Panel Overlay (over Voice Core) */}
        <AdminPanelOverlay
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          onOpenTechnicalDrawer={() => {
            setIsAdminOpen(false);
            setIsDrawerOpen(true);
          }}
        />

        {/* Technical Drawer (over everything) */}
        <TechnicalDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </div>
    );
  }

  // ── Chat Console mode (optional layer) ──────────────────────────
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-zinc-950/20">

      {/* Center Console */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">

        {/* Top Nav */}
        <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-zinc-950 via-zinc-950/85 to-transparent z-10 flex items-center justify-between px-6 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            {/* Return to Voice Core button */}
            <button
              onClick={() => setMode('voiceCore')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5',
                'bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25',
                'text-indigo-400 hover:text-indigo-300 rounded-lg text-[12px] font-medium',
                'transition-colors',
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voice Core
            </button>

            {/* Presence dot */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <AuraPresenceDot state={auraState} />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold tracking-wide text-zinc-200">AURA</span>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Console Mode
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setIsAdminOpen(true)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5',
                'bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/80',
                'text-zinc-400 hover:text-zinc-200 rounded-lg text-[13px] font-medium',
                'transition backdrop-blur-md',
              )}
            >
              Admin Panel
            </button>
            <button
              onClick={() => setIsDrawerOpen(true)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5',
                'bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/80',
                'text-zinc-400 hover:text-zinc-200 rounded-lg text-[13px] font-medium',
                'transition backdrop-blur-md',
              )}
            >
              <Settings2 className="w-4 h-4" />
              Technical Details
            </button>
          </div>
        </div>

        {/* Message stream */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pt-20 pb-4">
          <div className="max-w-4xl mx-auto w-full px-4 flex flex-col gap-4">
            <SessionDivider label="Session Started" />
            {messages.map(msg => (
              <Fragment key={msg.id}>
                <AssistantMessage msg={msg} />
              </Fragment>
            ))}
            <div className="h-4" />
          </div>
        </div>

        {/* Pinned Composer */}
        <div className="shrink-0 pt-2 pb-6 px-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
          <div className="max-w-4xl mx-auto w-full">
            <AuraComposer />
          </div>
        </div>
      </div>

      {/* Collapsible Right Rail */}
      <OperatorRail
        isCollapsed={isRailCollapsed}
        onToggle={() => setIsRailCollapsed(prev => !prev)}
      />

      {/* Admin Panel Overlay */}
      <AdminPanelOverlay
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onOpenTechnicalDrawer={() => {
          setIsAdminOpen(false);
          setIsDrawerOpen(true);
        }}
      />

      {/* Technical Drawer */}
      <TechnicalDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}

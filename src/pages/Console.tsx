/**
 * Console — Phase 2E Voice Core
 *
 * AURA opens directly into Voice Core — no launch gate or initiation step.
 * Voice Core is the immediate default experience.
 *
 * Modes:
 *   voiceCore    → AuraVoiceCore (default, shown immediately on load)
 *   chatConsole  → Chat stream + composer (opened from Voice Core)
 */

import React, { useState, useMemo } from 'react';
import { mockMessages } from '../store/mockData';

import { AuraVoiceCore }        from '../components/operator/AuraVoiceCore';
import { AdminPanelOverlay }    from '../components/operator/AdminPanelOverlay';
import { TechnicalDrawer }      from '../components/operator/TechnicalDrawer';
import { AuraCommandConsole }   from '../components/operator/AuraCommandConsole';

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
          summary: `${msg.agentId ?? 'Agent'} requests permission to run ${tc.name}`,
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
  // AURA opens directly into Voice Core — no initiation gate
  const [mode,            setMode]            = useState<ConsoleMode>('voiceCore');
  const [isDrawerOpen,    setIsDrawerOpen]    = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_auraState] = useState<VisualizerState>('idle');

  const messages = useMemo(() => toLegacyMessages(), []);

  // ── Voice Core mode (default, immediate) ────────────────────────
  if (mode === 'voiceCore') {
    return (
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-zinc-950">
        <AuraVoiceCore
          auraState={_auraState}
          onOpenConsole={() => setMode('chatConsole')}
          onOpenAdminPanel={() => setIsAdminOpen(true)}
          onOpenTechnicalDrawer={() => {
            setIsAdminOpen(false);
            setIsDrawerOpen(true);
          }}
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

  // ── Chat Console mode ────────────────────────────────────────────
  // Chat console mode — Claude Code-style clean layout
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-zinc-950">
      <AuraCommandConsole
        messages={messages}
        onBack={() => setMode('voiceCore')}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenDetails={() => { setIsAdminOpen(false); setIsDrawerOpen(true); }}
      />
      <AdminPanelOverlay
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onOpenTechnicalDrawer={() => { setIsAdminOpen(false); setIsDrawerOpen(true); }}
      />
      <TechnicalDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}

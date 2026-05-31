/**
 * Console — AURA Phase 3G
 *
 * AURA opens directly into Voice Core. From there the operator can switch to
 * the Console — a live, testable command surface (no mock data).
 *
 * Modes:
 *   voiceCore    → AuraVoiceCore (default, shown immediately on load)
 *   chatConsole  → AuraCommandConsole (live tool dispatch + right panel)
 */

import { useState } from 'react';

import { AuraVoiceCore }        from '../components/operator/AuraVoiceCore';
import { AdminPanelOverlay }    from '../components/operator/AdminPanelOverlay';
import { TechnicalDrawer }      from '../components/operator/TechnicalDrawer';
import { AuraCommandConsole }   from '../components/operator/AuraCommandConsole';

import type { VisualizerState } from '../components/operator/AuraVoiceVisualizer';

type ConsoleMode = 'voiceCore' | 'chatConsole';

export function Console() {
  const [mode,         setMode]         = useState<ConsoleMode>('voiceCore');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAdminOpen,  setIsAdminOpen]  = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_auraState] = useState<VisualizerState>('idle');

  if (mode === 'voiceCore') {
    return (
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-zinc-950">
        <AuraVoiceCore
          auraState={_auraState}
          onOpenConsole={() => setMode('chatConsole')}
          onOpenAdminPanel={() => setIsAdminOpen(true)}
          onOpenTechnicalDrawer={() => { setIsAdminOpen(false); setIsDrawerOpen(true); }}
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

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-zinc-950">
      <AuraCommandConsole
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

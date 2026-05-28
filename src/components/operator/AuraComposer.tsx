/**
 * AuraComposer — Phase 2E Deep Refinement
 *
 * Premium voice-first composer for the AURA console.
 * No real audio capture. Mic/voice buttons are placeholders for future integration.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Send, Paperclip, Square, ChevronDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AuraVoiceVisualizer, type VisualizerState } from './AuraVoiceVisualizer';

// ─── Status text config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<VisualizerState, { text: string; textColor: string }> = {
  idle:                  { text: 'Idle — ready',             textColor: 'text-zinc-600' },
  listening:             { text: 'Listening...',              textColor: 'text-indigo-400' },
  thinking:              { text: 'Thinking...',               textColor: 'text-violet-400' },
  speaking:              { text: 'Speaking...',               textColor: 'text-emerald-400' },
  waiting_for_approval:  { text: 'Waiting for approval',      textColor: 'text-amber-400' },
  executing:             { text: 'Executing...',              textColor: 'text-orange-400' },
  error:                 { text: 'Error — check console',     textColor: 'text-rose-400' },
};

// ─── Quick chips ──────────────────────────────────────────────────────────────

const QUICK_CHIPS = [
  'Continue task',
  'Review status',
  'Show approvals',
  'Create relay',
  'Open project',
  'Show details',
];

// ─── Component ───────────────────────────────────────────────────────────────

interface AuraComposerProps {
  /** Inject a voice state from a parent controller */
  voiceState?: VisualizerState;
  /** Optional amplitude (0–1) for real audio hookup later */
  amplitude?: number;
  /** Called when user submits text */
  onSend?: (text: string) => void;
  /** Called when voice mode is toggled */
  onVoiceToggle?: (active: boolean) => void;
}

export function AuraComposer({
  voiceState: externalVoiceState,
  amplitude = 0.5,
  onSend,
  onVoiceToggle,
}: AuraComposerProps) {
  const [text, setText]             = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [internalState, setInternalState] = useState<VisualizerState>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // External state takes priority
  const state: VisualizerState = externalVoiceState ?? internalState;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 192)}px`; // max 12rem
  }, [text]);

  function toggleVoice() {
    const next = !voiceActive;
    setVoiceActive(next);
    setInternalState(next ? 'listening' : 'idle');
    onVoiceToggle?.(next);
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText('');
    setInternalState('thinking');
    // Reset to idle after mock delay
    setTimeout(() => setInternalState('idle'), 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChip(chip: string) {
    setText(prev => prev ? `${prev} ${chip}` : chip);
    textareaRef.current?.focus();
  }

  const statusCfg = STATUS_CONFIG[state];
  const canSend   = text.trim().length > 0;

  return (
    <div className="w-full flex flex-col items-center gap-3">

      {/* ── Quick chips ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-1 w-full max-w-4xl">
        {QUICK_CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => handleChip(chip)}
            className="px-3 py-1.5 bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-full text-[12px] font-medium transition-all duration-200"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* ── Main composer box ──────────────────────────────────────── */}
      <div className={cn(
        'w-full max-w-4xl bg-zinc-900/80 backdrop-blur-md border rounded-2xl transition-all duration-300 shadow-xl overflow-hidden group',
        voiceActive
          ? 'border-indigo-500/50 ring-2 ring-indigo-500/15 shadow-indigo-500/10'
          : 'border-zinc-800/80 hover:border-zinc-700/80 focus-within:border-zinc-600/80 focus-within:ring-1 focus-within:ring-zinc-600/30',
      )}>

        {/* ── Voice visualizer row (shown when voice active) ──────── */}
        {voiceActive && (
          <div className="flex items-center justify-center gap-4 px-5 pt-5 pb-2">
            <AuraVoiceVisualizer
              state={state}
              amplitude={amplitude}
              size="sm"
              showLabel={false}
            />
            <div className="flex flex-col">
              <span className={cn('text-[13px] font-semibold transition-colors', statusCfg.textColor)}>
                {statusCfg.text}
              </span>
              <span className="text-[11px] text-zinc-600">Shift+Enter for newline · Enter to send</span>
            </div>
          </div>
        )}

        {/* ── Text input area ────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-2">

          {/* Compact presence orb (always visible) */}
          <div className="flex-shrink-0 mt-1">
            <AuraVoiceVisualizer
              state={state}
              amplitude={amplitude}
              size="sm"
              showLabel={false}
              className={voiceActive ? 'opacity-0 w-0 overflow-hidden' : ''}
            />
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voiceActive ? 'Listening — or type to override…' : 'Talk to AURA or type a command…'}
            rows={1}
            className={cn(
              'flex-1 bg-transparent border-none focus:outline-none resize-none text-[15px] leading-relaxed',
              'max-h-48 min-h-[44px] py-1 custom-scrollbar transition-colors',
              voiceActive ? 'text-indigo-100 placeholder:text-indigo-300/40' : 'text-zinc-200 placeholder:text-zinc-600',
            )}
          />
        </div>

        {/* ── Bottom control bar ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/40 bg-zinc-950/20">

          {/* Left: attachment + status */}
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 rounded-lg transition-colors"
              title="Attach file (future)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-zinc-800/60" />

            <span className={cn(
              'text-[11px] font-semibold uppercase tracking-widest ml-1 transition-colors duration-300 flex items-center gap-1.5',
              statusCfg.textColor,
            )}>
              {state !== 'idle' && (
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  state === 'listening'            ? 'bg-indigo-400 animate-pulse'
                  : state === 'thinking'           ? 'bg-violet-400 animate-pulse'
                  : state === 'speaking'           ? 'bg-emerald-400 animate-pulse'
                  : state === 'waiting_for_approval' ? 'bg-amber-400 animate-pulse'
                  : state === 'executing'          ? 'bg-orange-400 animate-pulse'
                  : 'bg-rose-400',
                )} />
              )}
              {statusCfg.text}
            </span>
          </div>

          {/* Right: voice toggle + send */}
          <div className="flex items-center gap-2">

            {/* Voice toggle */}
            <button
              onClick={toggleVoice}
              title={voiceActive ? 'Stop voice mode' : 'Start voice mode (placeholder)'}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all duration-300',
                voiceActive
                  ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-transparent',
              )}
            >
              {voiceActive ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  Voice
                </>
              )}
            </button>

            {/* Mute placeholder */}
            {voiceActive && (
              <button
                className="p-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors border border-transparent"
                title="Mute (placeholder)"
              >
                <MicOff className="w-4 h-4" />
              </button>
            )}

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              title="Send (Enter)"
              className={cn(
                'p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center',
                canSend
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'
                  : 'bg-zinc-800/60 text-zinc-600 cursor-not-allowed',
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Keyboard hint ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-700">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono">Enter</kbd>
          to send
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono">Shift+Enter</kbd>
          new line
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono">Ctrl+K</kbd>
          commands
        </span>
      </div>
    </div>
  );
}

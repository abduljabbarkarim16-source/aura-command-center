import React, { useEffect, useState } from 'react';
import { Mic2, CheckCircle2, XCircle, AlertCircle, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { voiceSessionService } from '../../services/voice/VoiceSessionService';
import type { VoiceReadinessSnapshot } from '../../types/voice-session';

export function VoiceReadinessCard() {
  const [snap, setSnap] = useState<VoiceReadinessSnapshot>(
    voiceSessionService.getReadinessSnapshot()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSnap(voiceSessionService.getReadinessSnapshot());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  type Row = { label: string; status: 'ok' | 'warn' | 'missing' | 'locked'; detail: string };

  const rows: Row[] = [
    {
      label: 'OpenAI API Key',
      status: snap.openaiKeyPresent ? 'ok' : 'missing',
      detail: snap.openaiKeyPresent ? 'Present — enables STT (Whisper) + TTS' : 'Not configured — STT/TTS will use browser fallback',
    },
    {
      label: 'STT Provider',
      status: snap.sttReady ? 'ok' : 'warn',
      detail: `${snap.sttProvider} · ${snap.sttReady ? 'Ready' : 'Browser fallback'}`,
    },
    {
      label: 'TTS Provider',
      status: snap.ttsReady ? 'ok' : 'warn',
      detail: `${snap.ttsProvider} · ${snap.ttsReady ? 'Ready' : 'Browser fallback'}`,
    },
    {
      label: 'ElevenLabs (optional)',
      status: snap.elevenLabsKeyPresent ? 'ok' : 'warn',
      detail: snap.elevenLabsKeyPresent ? 'Key present — premium TTS available' : 'Key not configured — optional, not required',
    },
    {
      label: 'Realtime Voice',
      status: snap.realtimeReady ? 'ok' : 'warn',
      detail: 'Planned — requires Tauri backend bridge for ephemeral token minting',
    },
    {
      label: 'Microphone Permission',
      status: snap.microphonePermission === 'granted' ? 'ok' : snap.microphonePermission === 'denied' ? 'missing' : 'warn',
      detail: snap.microphonePermission === 'not_requested'
        ? 'Not requested yet — will be requested when live voice is unlocked'
        : snap.microphonePermission,
    },
    {
      label: 'Live Voice',
      status: 'locked',
      detail: 'Locked until explicit approval gate passes — no microphone opened',
    },
  ];

  const modeColor = {
    mock: 'text-zinc-400 bg-zinc-800',
    request_based: 'text-indigo-400 bg-indigo-500/10',
    realtime: 'text-emerald-400 bg-emerald-500/10',
    locked: 'text-amber-400 bg-amber-500/10',
  }[snap.mode];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mic2 className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-[14px] font-semibold text-zinc-200">Voice Readiness</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Phase 3B foundation — STT/TTS architecture ready, live voice locked
            </p>
          </div>
        </div>
        <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold', modeColor)}>
          {snap.mode}
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-zinc-800/30 p-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/20 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {row.status === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : row.status === 'locked' ? (
                  <Lock className="w-4 h-4 text-amber-400" />
                ) : row.status === 'missing' ? (
                  <XCircle className="w-4 h-4 text-rose-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div>
                <p className="text-[12px] font-medium text-zinc-300">{row.label}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{row.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      {snap.notes.length > 0 && (
        <div className="px-5 py-3 border-t border-zinc-800/30 space-y-1">
          {snap.notes.map((n, i) => (
            <p key={i} className="text-[10px] text-zinc-600">{n}</p>
          ))}
        </div>
      )}
    </div>
  );
}

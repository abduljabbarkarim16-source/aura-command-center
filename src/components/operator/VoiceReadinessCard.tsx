import React, { useEffect, useState } from 'react';
import { Mic2, CheckCircle2, XCircle, AlertCircle, Lock, Radio } from 'lucide-react';
import { cn } from '../../lib/utils';
import { voiceSessionService } from '../../services/voice/VoiceSessionService';
import type { VoiceReadinessSnapshot, VoiceConversationSettings } from '../../types/voice-session';
import { DEFAULT_VOICE_SETTINGS } from '../../types/voice-session';

export function VoiceReadinessCard() {
  const [snap, setSnap] = useState<VoiceReadinessSnapshot>(
    voiceSessionService.getReadinessSnapshot()
  );
  const [settings, setSettings] = useState<VoiceConversationSettings>(() => {
    try {
      const stored = localStorage.getItem('voice.conversation.settings');
      return stored ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(stored) } : DEFAULT_VOICE_SETTINGS;
    } catch { return DEFAULT_VOICE_SETTINGS; }
  });

  useEffect(() => {
    const interval = setInterval(() => setSnap(voiceSessionService.getReadinessSnapshot()), 2000);
    return () => clearInterval(interval);
  }, []);

  function updateSettings(patch: Partial<VoiceConversationSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try { localStorage.setItem('voice.conversation.settings', JSON.stringify(next)); } catch { /* ignore */ }
  }

  type Row = { label: string; status: 'ok' | 'warn' | 'missing' | 'locked'; detail: string };

  const rows: Row[] = [
    {
      label: 'OpenAI API Key',
      status: snap.openaiKeyPresent ? 'ok' : 'missing',
      detail: snap.openaiKeyPresent
        ? 'Present — STT (Whisper) + Chat + TTS enabled via Tauri backend'
        : 'Not configured — add VITE_OPENAI_API_KEY to .env',
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
      label: 'Chat Provider',
      status: snap.openaiKeyPresent ? 'ok' : 'missing',
      detail: snap.openaiKeyPresent ? 'OpenAI gpt-4o-mini · max 150 tokens · via Tauri' : 'Requires OpenAI key',
    },
    {
      label: 'ElevenLabs (optional)',
      status: snap.elevenLabsKeyPresent ? 'ok' : 'warn',
      detail: snap.elevenLabsKeyPresent ? 'Key present — premium TTS available' : 'Not configured — optional',
    },
    {
      label: 'Realtime Voice',
      status: 'warn',
      detail: 'Planned — requires Tauri backend bridge for ephemeral token minting',
    },
    {
      label: 'Microphone',
      status: snap.microphonePermission === 'granted' ? 'ok'
        : snap.microphonePermission === 'denied' ? 'missing' : 'warn',
      detail: snap.microphonePermission === 'not_requested'
        ? 'Not requested — will ask when user clicks Speak'
        : snap.microphonePermission === 'granted' ? 'Permission granted'
        : snap.microphonePermission === 'denied' ? 'Denied — allow in browser/system settings'
        : snap.microphonePermission,
    },
    {
      label: 'Live Voice',
      status: settings.enabled ? 'ok' : 'locked',
      detail: settings.enabled
        ? 'Enabled — Speak button activates real recording → STT → Chat → TTS'
        : 'Disabled — toggle below to enable',
    },
  ];

  const displayMode = settings.enabled && snap.openaiKeyPresent ? 'request_based' : snap.mode;
  const modeColors: Record<string, string> = {
    mock: 'text-zinc-400 bg-zinc-800',
    request_based: 'text-indigo-400 bg-indigo-500/10',
    realtime: 'text-emerald-400 bg-emerald-500/10',
    locked: 'text-amber-400 bg-amber-500/10',
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mic2 className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-[14px] font-semibold text-zinc-200">Voice Readiness</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Phase 3C — request-based STT + Chat + TTS via Tauri backend
            </p>
          </div>
        </div>
        <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold', modeColors[displayMode] ?? modeColors.locked)}>
          {displayMode}
        </span>
      </div>

      {/* Enable voice toggle */}
      <div className="px-5 py-3 border-b border-zinc-800/30 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-zinc-200">Enable Voice Conversation</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Activates real mic recording and AI responses in Voice Core</p>
        </div>
        <label className="relative flex items-center cursor-pointer ml-4">
          <input type="checkbox" className="sr-only peer" checked={settings.enabled}
            onChange={e => updateSettings({ enabled: e.target.checked })} />
          <div className="w-9 h-5 rounded-full border border-zinc-700 bg-zinc-950 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-zinc-500 peer-checked:bg-white peer-checked:translate-x-4 transition-all" />
        </label>
      </div>

      {/* TTS Voice selector */}
      {settings.enabled && (
        <div className="px-5 py-3 border-b border-zinc-800/30 flex items-center justify-between">
          <p className="text-[12px] text-zinc-400">TTS Voice</p>
          <select value={settings.ttsVoice}
            onChange={e => updateSettings({ ttsVoice: e.target.value as VoiceConversationSettings['ttsVoice'] })}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[12px] text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            {(['alloy','echo','fable','onyx','nova','shimmer'] as const).map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      )}

      {/* Rows */}
      <div className="divide-y divide-zinc-800/30 p-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {row.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
               : row.status === 'locked' ? <Lock className="w-4 h-4 text-amber-400" />
               : row.status === 'missing' ? <XCircle className="w-4 h-4 text-rose-400" />
               : <AlertCircle className="w-4 h-4 text-amber-400" />}
            </div>
            <div>
              <p className="text-[12px] font-medium text-zinc-300">{row.label}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{row.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      {snap.notes.length > 0 && (
        <div className="px-5 py-3 border-t border-zinc-800/30 space-y-1">
          {snap.notes.map((n, i) => (
            <p key={i} className="text-[10px] text-zinc-600 flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 shrink-0" />{n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

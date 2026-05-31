/**
 * VoiceReadinessCard — Phase 3D
 *
 * Settings panel for voice configuration.
 * Phase 3D additions:
 *  - Auto-stop on silence toggle + threshold selector
 *  - Max recording duration selector
 *  - Interrupt while speaking toggle
 *  - Wake phrase toggle (experimental, with amber warning)
 *  - Response style selector (Brief / Normal / Detailed)
 */
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Mic2, CheckCircle2, XCircle, AlertCircle, Lock, Radio, AlertTriangle } from 'lucide-react';
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
    let cancelled = false;
    const refresh = async () => {
      let savedOpenAIKey: boolean | undefined;
      try {
        savedOpenAIKey = await invoke<boolean>('openai_key_is_configured');
      } catch {
        savedOpenAIKey = undefined;
      }
      if (!cancelled) {
        setSnap(voiceSessionService.getReadinessSnapshot(savedOpenAIKey));
      }
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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
        : 'Not configured - save an OpenAI key in Settings or add VITE_OPENAI_API_KEY to .env',
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
      detail: snap.openaiKeyPresent
        ? 'OpenAI gpt-4o-mini · max 300 tokens · via Tauri · response style: ' + settings.responseStyle
        : 'Requires OpenAI key',
    },
    {
      label: 'ElevenLabs (optional)',
      status: snap.elevenLabsKeyPresent ? 'ok' : 'warn',
      detail: snap.elevenLabsKeyPresent ? 'Key present — premium TTS available' : 'Not configured — optional',
    },
    {
      label: 'Realtime Voice',
      status: 'warn',
      detail: 'Planned Phase 3E+ — requires Tauri backend bridge for ephemeral token minting',
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

  // ── Toggle row helper ──────────────────────────────────────────────────────
  function ToggleRow({ label, detail, checked, onChange }: {
    label: string;
    detail: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) {
    return (
      <div className="px-5 py-3 border-b border-zinc-800/30 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-zinc-200">{label}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{detail}</p>
        </div>
        <label className="relative flex items-center cursor-pointer ml-4 flex-shrink-0">
          <input type="checkbox" className="sr-only peer" checked={checked}
            onChange={e => onChange(e.target.checked)} />
          <div className="w-9 h-5 rounded-full border border-zinc-700 bg-zinc-950 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-zinc-500 peer-checked:bg-white peer-checked:translate-x-4 transition-all" />
        </label>
      </div>
    );
  }

  // ── Select row helper ──────────────────────────────────────────────────────
  function SelectRow<T extends string>({ label, value, options, onChange }: {
    label: string;
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (v: T) => void;
  }) {
    return (
      <div className="px-5 py-3 border-b border-zinc-800/30 flex items-center justify-between">
        <p className="text-[12px] text-zinc-400">{label}</p>
        <select
          value={value}
          onChange={e => onChange(e.target.value as T)}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[12px] text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mic2 className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-[14px] font-semibold text-zinc-200">Voice Readiness</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Phase 3D — VAD-lite, barge-in, wake phrase, response style
            </p>
          </div>
        </div>
        <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold', modeColors[displayMode] ?? modeColors.locked)}>
          {displayMode}
        </span>
      </div>

      {/* Enable voice toggle */}
      <ToggleRow
        label="Enable Voice Conversation"
        detail="Activates real mic recording and AI responses in Voice Core"
        checked={settings.enabled}
        onChange={v => updateSettings({ enabled: v })}
      />

      {settings.enabled && (
        <>
          {/* TTS Voice selector */}
          <SelectRow
            label="TTS Voice"
            value={settings.ttsVoice}
            options={(['alloy','echo','fable','onyx','nova','shimmer'] as const).map(v => ({ value: v, label: v }))}
            onChange={v => updateSettings({ ttsVoice: v })}
          />

          {/* Response Style */}
          <SelectRow
            label="Response Style"
            value={settings.responseStyle ?? 'normal'}
            options={[
              { value: 'brief',    label: 'Brief (1 sentence)' },
              { value: 'normal',   label: 'Normal (2-3 sentences)' },
              { value: 'detailed', label: 'Detailed (up to 5 sentences)' },
            ]}
            onChange={v => updateSettings({ responseStyle: v })}
          />

          <ToggleRow
            label="Auto-save memory"
            detail="Extract and save long-term facts after voice turns. Off by default."
            checked={settings.autoMemoryEnabled ?? false}
            onChange={v => updateSettings({ autoMemoryEnabled: v })}
          />

          {/* Auto-stop on silence */}
          <ToggleRow
            label="Auto-stop on silence"
            detail="AURA automatically detects when you stop speaking and processes the audio"
            checked={settings.autoStopEnabled ?? true}
            onChange={v => updateSettings({ autoStopEnabled: v })}
          />

          {/* Silence threshold — only shown when auto-stop is on */}
          {(settings.autoStopEnabled ?? true) && (
            <SelectRow
              label="Silence threshold"
              value={String(settings.silenceThresholdMs ?? 1200) as '900' | '1200' | '1500' | '2000'}
              options={[
                { value: '900',  label: '0.9s (quick)' },
                { value: '1200', label: '1.2s (default)' },
                { value: '1500', label: '1.5s (relaxed)' },
                { value: '2000', label: '2.0s (deliberate)' },
              ]}
              onChange={v => updateSettings({ silenceThresholdMs: Number(v) })}
            />
          )}

          {/* Max recording duration */}
          <SelectRow
            label="Max recording duration"
            value={String(settings.maxRecordingDurationMs ?? 30000) as '15000' | '30000' | '45000'}
            options={[
              { value: '15000', label: '15 seconds' },
              { value: '30000', label: '30 seconds (default)' },
              { value: '45000', label: '45 seconds' },
            ]}
            onChange={v => updateSettings({ maxRecordingDurationMs: Number(v) })}
          />

          {/* Interrupt while speaking */}
          <ToggleRow
            label="Interrupt while speaking"
            detail="Click Speak while AURA is talking to stop it and start listening immediately"
            checked={settings.interruptEnabled ?? true}
            onChange={v => updateSettings({ interruptEnabled: v })}
          />

          {/* Wake phrase — with amber warning */}
          <div className="px-5 py-3 border-b border-zinc-800/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-zinc-200">
                  Wake phrase
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">experimental</span>
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Say "Hey AURA" to start listening without clicking</p>
              </div>
              <label className="relative flex items-center cursor-pointer ml-4 flex-shrink-0">
                <input type="checkbox" className="sr-only peer" checked={settings.wakePhrase ?? false}
                  onChange={e => updateSettings({ wakePhrase: e.target.checked })} />
                <div className="w-9 h-5 rounded-full border border-zinc-700 bg-zinc-950 peer-checked:bg-amber-600 peer-checked:border-amber-600 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-zinc-500 peer-checked:bg-white peer-checked:translate-x-4 transition-all" />
              </label>
            </div>
            {(settings.wakePhrase ?? false) && (
              <div className="mt-2 flex items-start gap-1.5 px-2.5 py-1.5 bg-amber-500/8 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-amber-400/80">
                  Microphone remains active while wake phrase is listening. May not work in all Tauri/WebView2 environments.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Readiness rows */}
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

/**
 * SecureKeysCard — AURA Settings
 *
 * Lets the user enter their OpenAI API key once.
 * The key is saved to %APPDATA%\com.aura.commandcenter\.env via the Rust
 * backend and hot-loaded into the running process — no restart needed.
 *
 * Security:
 * - The key is sent to Rust via invoke() and written server-side.
 * - The key is never echoed back or stored in React state after saving.
 * - The input is type="password" so it is masked on screen.
 * - This is local AppData .env storage, not OS keychain/Stronghold storage.
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  KeyRound, CheckCircle2, XCircle, Eye, EyeOff, Save, Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function SecureKeysCard() {
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);
  const [inputValue,    setInputValue]    = useState('');
  const [showInput,     setShowInput]     = useState(false);
  const [showValue,     setShowValue]     = useState(false);
  const [status,        setStatus]        = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg,      setErrorMsg]      = useState('');

  // Check on mount whether the key is already set in the Rust process
  useEffect(() => {
    invoke<boolean>('openai_key_is_configured')
      .then(ok => setKeyConfigured(ok))
      .catch(() => setKeyConfigured(false));
  }, []);

  const handleSave = async () => {
    if (!inputValue.trim()) return;
    setStatus('saving');
    setErrorMsg('');
    try {
      await invoke('save_openai_key', { key: inputValue.trim() });
      setKeyConfigured(true);
      setStatus('saved');
      setInputValue('');
      setShowInput(false);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e) {
      setStatus('error');
      setErrorMsg(String(e));
    }
  };

  const handleDelete = async () => {
    try {
      await invoke('delete_openai_key');
      setKeyConfigured(false);
      setStatus('idle');
      setShowInput(false);
      setInputValue('');
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-[14px] font-semibold text-zinc-200">OpenAI API Key</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Required for voice (Whisper STT + GPT-4o-mini + TTS). Saved locally in user AppData as an .env file.
            </p>
          </div>
        </div>

        {keyConfigured === null ? (
          <span className="text-[11px] text-zinc-600">Checking…</span>
        ) : keyConfigured ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400 font-semibold">Configured</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/25 rounded-full">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[11px] text-rose-400 font-semibold">Not set</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">

        {/* Status messages */}
        {status === 'saved' && (
          <div className="flex items-center gap-2 text-[12px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Key saved to local AppData and active — voice should work immediately. No restart needed.
          </div>
        )}
        {status === 'error' && (
          <div className="text-[12px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
            {errorMsg || 'Failed to save key. Check that AURA has write access to AppData.'}
          </div>
        )}

        {/* Key input row */}
        {!showInput ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowInput(true); setStatus('idle'); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-[12px] font-semibold transition-all',
                keyConfigured
                  ? 'bg-zinc-800/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  : 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30',
              )}
            >
              <KeyRound className="w-3.5 h-3.5" />
              {keyConfigured ? 'Replace Key' : 'Enter OpenAI Key'}
            </button>

            {keyConfigured && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium bg-zinc-800/40 border-zinc-700/40 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showValue ? 'text' : 'password'}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setShowInput(false); setInputValue(''); } }}
                  placeholder="sk-proj-..."
                  autoFocus
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-[13px] text-zinc-200 font-mono focus:outline-none focus:border-indigo-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowValue(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={status === 'saving' || !inputValue.trim()}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0',
                  status === 'saving' || !inputValue.trim()
                    ? 'bg-indigo-600/30 text-white/40 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white',
                )}
              >
                <Save className="w-3.5 h-3.5" />
                {status === 'saving' ? 'Saving…' : 'Save'}
              </button>

              <button
                onClick={() => { setShowInput(false); setInputValue(''); setStatus('idle'); }}
                className="px-3 py-2 rounded-xl text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-[10px] text-zinc-600">
              Get your key at <span className="text-zinc-400">platform.openai.com/api-keys</span>.
              It starts with <span className="font-mono text-zinc-400">sk-</span>.
              Saved locally to <span className="font-mono text-zinc-500">%APPDATA%\com.aura.commandcenter\.env</span>. This is not OS keychain storage.
            </p>
          </div>
        )}

        {/* Info note */}
        {!showInput && !keyConfigured && (
          <p className="text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/15 px-3 py-2 rounded-xl">
            ⚠ Voice is disabled until a key is saved. Click "Enter OpenAI Key" above and paste your key.
          </p>
        )}
      </div>
    </div>
  );
}

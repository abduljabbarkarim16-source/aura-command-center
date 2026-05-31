/**
 * AuraPersonalityPanel — AURA Phase 3G
 *
 * Configure AURA's personality, tone, and dialect.
 * Preset selector + free-text override + name settings.
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { auraPersonalityService } from '../../services/personality/AuraPersonalityService';
import type { PersonalityConfig, PersonalityPreset } from '../../types/aura-personality';
import { PRESET_DESCRIPTIONS } from '../../types/aura-personality';

const PRESET_LABELS: Record<PersonalityPreset, { label: string; emoji: string; hint: string }> = {
  direct:    { label: 'Direct',    emoji: '⚡', hint: 'Minimal words, straight to it' },
  warm:      { label: 'Warm',      emoji: '☀️', hint: 'Friendly and natural' },
  technical: { label: 'Technical', emoji: '🔬', hint: 'Precise and thorough' },
  casual:    { label: 'Casual',    emoji: '💬', hint: 'Relaxed, like a smart friend' },
  builder:   { label: 'Builder',   emoji: '🔧', hint: 'Dev-focused, action-oriented' },
};

export function AuraPersonalityPanel() {
  const [config, setConfig] = useState<PersonalityConfig>(auraPersonalityService.getConfig());
  const [customDraft, setCustomDraft] = useState(config.customPrompt);
  const [nameDraft,   setNameDraft]   = useState(config.userName);
  const [saved, setSaved] = useState(false);

  useEffect(() => auraPersonalityService.subscribe(cfg => {
    setConfig(cfg);
    setCustomDraft(cfg.customPrompt);
    setNameDraft(cfg.userName);
  }), []);

  const save = () => {
    auraPersonalityService.update({ customPrompt: customDraft.trim(), userName: nameDraft.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-y-auto">
      <div className="p-4 space-y-5">

        {/* Preset selector */}
        <section>
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Personality Preset
          </h3>
          <div className="grid grid-cols-1 gap-1.5">
            {(Object.keys(PRESET_LABELS) as PersonalityPreset[]).map(preset => {
              const { label, emoji, hint } = PRESET_LABELS[preset];
              const active = config.preset === preset && !config.customPrompt.trim();
              return (
                <button
                  key={preset}
                  onClick={() => auraPersonalityService.setPreset(preset)}
                  className={cn(
                    'flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors',
                    active
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-zinc-200'
                      : 'border-zinc-800/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300',
                  )}
                >
                  <span className="text-base leading-none mt-0.5 shrink-0">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold">{label}</span>
                      {active && <Check className="w-3 h-3 text-indigo-400" />}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Custom prompt override */}
        <section>
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Custom Personality
          </h3>
          <p className="text-[10px] text-zinc-600 mb-2">
            Write AURA's personality in your own words. Overrides the preset above when not empty.
          </p>
          <textarea
            value={customDraft}
            onChange={e => setCustomDraft(e.target.value)}
            placeholder="e.g. Be sharp and direct. Treat me like a founder who knows what they're doing. Skip the explanations unless I ask. Always suggest the fastest path."
            rows={4}
            className="w-full text-[11px] bg-zinc-900/70 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 resize-none leading-relaxed"
          />
          {customDraft.trim() && (
            <p className="text-[10px] text-indigo-400 mt-1 flex items-center gap-1">
              <Check className="w-3 h-3" /> Custom personality active — preset ignored
            </p>
          )}
        </section>

        {/* User name */}
        <section>
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Your Name
          </h3>
          <input
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            placeholder="e.g. Karim"
            className="w-full text-[11px] bg-zinc-900/70 border border-zinc-700/60 rounded-xl px-3 py-2 text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50"
          />
          <p className="text-[10px] text-zinc-600 mt-1">AURA will use your name naturally in conversation.</p>
        </section>

        {/* Memory injection toggles */}
        <section>
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Memory in Context
          </h3>
          <div className="space-y-2">
            {([
              { key: 'injectPersonal', label: 'Personal memories', hint: 'Your name, preferences, background' },
              { key: 'injectTask',     label: 'Task memories',     hint: 'Project decisions, technical context' },
            ] as const).map(item => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => auraPersonalityService.update({ [item.key]: !config[item.key] })}
                  className={cn(
                    'w-8 h-4 rounded-full transition-colors relative shrink-0',
                    config[item.key] ? 'bg-indigo-600' : 'bg-zinc-700',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
                    config[item.key] ? 'left-4' : 'left-0.5',
                  )} />
                </div>
                <div>
                  <p className="text-[11px] text-zinc-300">{item.label}</p>
                  <p className="text-[10px] text-zinc-600">{item.hint}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Preview */}
        <section>
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Prompt Preview
          </h3>
          <pre className="text-[10px] font-mono text-zinc-500 bg-zinc-950/70 border border-zinc-800 rounded-xl p-3 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
            {auraPersonalityService.buildSystemPrompt({ skipMemory: true })}
          </pre>
        </section>

        {/* Save + reset */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : 'Save'}
          </button>
          <button
            onClick={() => auraPersonalityService.reset()}
            className="px-3 py-2 rounded-xl text-[11px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 transition-colors"
          >
            Reset to defaults
          </button>
        </div>

      </div>
    </div>
  );
}

/**
 * useVoiceHotkey — AURA Phase 3E
 *
 * Local keyboard shortcut for voice activation inside AURA.
 * Does NOT install a global OS-level shortcut unless explicitly enabled.
 *
 * Default hotkeys:
 *  - Ctrl+Shift+Space: start/stop voice from anywhere inside AURA (when not typing)
 *  - Space or V in Voice Core focus: start/stop (when no text input has focus)
 *
 * Security:
 *  - Does NOT silently install OS-level global hooks
 *  - Does NOT trigger while a text input, textarea, or contenteditable has focus
 *  - User can enable/disable in Settings
 *  - Hotkey is persisted in voiceSettings.hotkey field
 */

import { useEffect, useCallback, useRef } from 'react';

export interface VoiceHotkeyConfig {
  /** Whether the hotkey is active */
  enabled: boolean;
  /** Called when hotkey fires and voice is idle */
  onActivate: () => void;
  /** Called when hotkey fires and voice is recording */
  onDeactivate: () => void;
  /** Whether voice is currently recording (prevents double-fire) */
  isRecording: boolean;
  /** Whether voice is processing (block activation during processing) */
  isProcessing: boolean;
}

/** Returns true if a text entry element is currently focused (hotkey should not fire) */
function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useVoiceHotkey(config: VoiceHotkeyConfig): void {
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const c = configRef.current;
    if (!c.enabled) return;

    // Block if a text field has focus
    if (isTypingTarget(document.activeElement)) return;

    // Ctrl+Shift+Space — primary hotkey
    const isPrimary = e.ctrlKey && e.shiftKey && e.code === 'Space';
    // Space or V in non-text context — secondary
    const isSecondary = !e.ctrlKey && !e.altKey && !e.metaKey && (e.code === 'Space' || e.code === 'KeyV');

    if (!isPrimary && !isSecondary) return;

    e.preventDefault();
    e.stopPropagation();

    if (c.isRecording) {
      c.onDeactivate();
    } else if (!c.isProcessing) {
      c.onActivate();
    }
  }, []);

  useEffect(() => {
    if (!config.enabled) return;
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [config.enabled, handleKeyDown]);
}

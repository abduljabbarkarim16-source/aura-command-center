/**
 * useConsoleConversation — AURA Phase 3G (Milestone 5/10), Phase 3J QA voice fix
 *
 * Text-mode conversation for the AURA console. This is what lets AURA be
 * tested through its OWN interface when voice can't be used: type a prompt,
 * AURA decides whether to call a tool, runs it through the real registry, and
 * prints a natural-language answer.
 *
 * It shares the SAME dispatch brain as voice (auraToolDispatchService.
 * chatWithTools) AND the same NameCaptureService, so console and voice capture
 * names identically. Turns are recorded to the active session thread.
 *
 * Security: execution still routes through ToolRegistryService → the
 * allowlisted Rust layer. The console only exposes auto-approved tools to the
 * model; medium/high-risk tools are triggered explicitly elsewhere.
 */

import { useState, useRef, useCallback } from 'react';
import { auraToolDispatchService } from '../services/tools/AuraToolDispatchService';
import { auraPersonalityService } from '../services/personality/AuraPersonalityService';
import { sessionThreadService } from '../services/session/SessionThreadService';
import { toolRegistryService } from '../services/tools/ToolRegistryService';
import { userProfileMemoryService } from '../services/memory/UserProfileMemoryService';
import { nameCaptureService, type NameCaptureResult } from '../services/voice/NameCaptureService';
import { voiceDiagnosticsService } from '../services/voice/VoiceDiagnosticsService';

export interface ConsoleMessage {
  id: string;
  role: 'user' | 'aura' | 'system' | 'error';
  text: string;
  at: string;
  toolUsed?: string;
}

function uid(): string { return `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

export function useConsoleConversation() {
  const [messages, setMessages] = useState<ConsoleMessage[]>(() => [{
    id: uid(), role: 'system', at: new Date().toISOString(),
    text: 'Console ready. Type a command — try "Check git status", "What can you do?", or "Remember my name is Karim".',
  }]);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);
  /** A name awaiting yes/no confirmation (e.g. after a heard-only voice-style entry). */
  const pendingNameRef = useRef<string | null>(null);

  const push = useCallback((m: Omit<ConsoleMessage, 'id' | 'at'>) => {
    setMessages(prev => [...prev, { ...m, id: uid(), at: new Date().toISOString() }]);
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busyLabel) return;

    push({ role: 'user', text });
    sessionThreadService.ensureActive();

    const recordTurn = (u: string, a: string) => {
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: u },
        { role: 'assistant', content: a },
      ].slice(-16);
      sessionThreadService.recordTurn(u, a);
    };

    /** Run the real memory.setUserName tool so the save is logged + visible. */
    const commitName = async (name: string, result?: NameCaptureResult) => {
      setBusyLabel('Running memory.setUserName…');
      try {
        const exec = await toolRegistryService.execute('memory.setUserName', { name }, { approved: true });
        const toolText = [exec.stdout, exec.stderr].filter(Boolean).join('\n').trim();
        const auraText = result?.prompt || toolText || `Saved — your name is ${name}.`;
        push({ role: 'aura', text: auraText, toolUsed: 'memory.setUserName' });
        recordTurn(text, auraText);
        voiceDiagnosticsService.record({
          source: 'typed', rawText: text, cleanedText: text, intent: 'name.committed',
          spellingMode: result?.spelled ?? false, savedValue: name, confidence: result?.confidence,
          note: result?.spelled ? 'spelled (authoritative)' : 'typed (trusted)',
        });
      } catch (err) {
        push({ role: 'error', text: friendlyError(err) });
      } finally {
        setBusyLabel(null);
      }
    };

    const knownName = userProfileMemoryService.get().name;

    // ── Resolve a pending name confirmation first ──────────────────────────────
    if (pendingNameRef.current) {
      const pending = pendingNameRef.current;
      // A fresh spelling/name in the reply supersedes the pending guess.
      const reAnalyze = nameCaptureService.analyze(text, { source: 'typed', knownName });
      if (reAnalyze.kind === 'save' && reAnalyze.name) {
        pendingNameRef.current = null;
        await commitName(reAnalyze.name, reAnalyze);
        return;
      }
      if (nameCaptureService.isAffirmation(text)) {
        pendingNameRef.current = null;
        await commitName(pending, { kind: 'save', name: pending, spelled: false, confidence: 'high' });
        return;
      }
      if (nameCaptureService.isNegation(text)) {
        pendingNameRef.current = null;
        const ask = 'No problem — what is your name? You can spell it, like "K A R I M".';
        push({ role: 'aura', text: ask });
        recordTurn(text, ask);
        voiceDiagnosticsService.record({ source: 'typed', rawText: text, cleanedText: text, intent: 'name.confirm', spellingMode: false, note: 'user rejected pending name' });
        return;
      }
      // Not a yes/no/respell — drop the pending guess and treat normally.
      pendingNameRef.current = null;
    }

    // ── Deterministic name capture (shared with voice) ─────────────────────────
    const nameResult = nameCaptureService.analyze(text, { source: 'typed', knownName });

    if (nameResult.kind === 'query') {
      setBusyLabel('Running memory.getUserProfile…');
      try {
        const exec = await toolRegistryService.execute('memory.getUserProfile', {}, { approved: true });
        const auraText = [exec.stdout, exec.stderr].filter(Boolean).join('\n').trim() || '(done)';
        push({ role: 'aura', text: auraText, toolUsed: 'memory.getUserProfile' });
        recordTurn(text, auraText);
        voiceDiagnosticsService.record({ source: 'typed', rawText: text, cleanedText: text, intent: 'name.query', spellingMode: false, savedValue: knownName });
      } catch (err) {
        push({ role: 'error', text: friendlyError(err) });
      } finally {
        setBusyLabel(null);
      }
      return;
    }

    if (nameResult.kind === 'save' && nameResult.name) {
      await commitName(nameResult.name, nameResult);
      return;
    }

    if (nameResult.kind === 'confirm') {
      pendingNameRef.current = nameResult.name ?? null;
      const ask = nameResult.prompt ?? 'Could you confirm your name?';
      push({ role: 'aura', text: ask });
      recordTurn(text, ask);
      voiceDiagnosticsService.record({
        source: 'typed', rawText: text, cleanedText: text, intent: 'name.confirm',
        spellingMode: nameResult.spelled, savedValue: nameResult.name, confidence: nameResult.confidence,
      });
      return;
    }

    // ── Everything else goes through the model + tool dispatch ─────────────────
    setBusyLabel('Thinking…');

    const systemPrompt = auraPersonalityService.buildSystemPrompt({
      responseStyle: 'normal', includeToolAwareness: true,
    });

    try {
      const result = await auraToolDispatchService.chatWithTools({
        transcript: text,
        history: historyRef.current.slice(-8),
        systemPrompt,
        onToolDispatched: (toolId) => setBusyLabel(`Running ${toolId}…`),
      });

      const auraText = result.text?.trim() || '(no response)';
      push({ role: 'aura', text: auraText, toolUsed: result.toolUsed });
      recordTurn(text, auraText);
      voiceDiagnosticsService.record({
        source: 'typed', rawText: text, cleanedText: text,
        intent: result.toolUsed ? 'tool' : 'chat', spellingMode: false, note: result.toolUsed,
      });
    } catch (err) {
      push({ role: 'error', text: friendlyError(err) });
    } finally {
      setBusyLabel(null);
    }
  }, [busyLabel, push]);

  const clear = useCallback(() => {
    historyRef.current = [];
    pendingNameRef.current = null;
    setMessages([{
      id: uid(), role: 'system', at: new Date().toISOString(),
      text: 'Console cleared.',
    }]);
  }, []);

  return { messages, busyLabel, send, clear };
}

/** Turn raw invoke/network errors into something readable (no secrets). */
function friendlyError(err: unknown): string {
  const s = String(err);
  if (s.includes('key') && (s.includes('configured') || s.includes('OPENAI'))) {
    return 'I need an OpenAI API key to think. Add it in Settings, then try again.';
  }
  if (s.toLowerCase().includes('network') || s.includes('fetch')) {
    return 'I could not reach the model (network). Check your connection and try again.';
  }
  return `Something went wrong: ${s.slice(0, 200)}`;
}

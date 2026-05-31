/**
 * useConsoleConversation — AURA Phase 3G (Milestone 5/10)
 *
 * Text-mode conversation for the AURA console. This is what lets AURA be
 * tested through its OWN interface when voice can't be used: type a prompt,
 * AURA decides whether to call a tool, runs it through the real registry, and
 * prints a natural-language answer.
 *
 * It shares the SAME dispatch brain as voice (auraToolDispatchService.
 * chatWithTools) so console and voice behave identically. Turns are recorded
 * to the active session thread.
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

// ─── Deterministic intent shortcuts ───────────────────────────────────────────
//
// Small models (gpt-4o-mini) are unreliable at choosing memory tools — they tend
// to *say* "saved" without calling the tool. For these canonical, unambiguous
// commands we run the real tool directly so the action actually happens (and is
// logged in the Tools panel). Everything else still goes through the model.

interface MemoryIntent { toolId: string; inputs: Record<string, string>; }

function detectMemoryIntent(text: string): MemoryIntent | null {
  const nameSet = text.match(/\b(?:my name is|call me)\s+([A-Za-z][\w'’-]{0,40})/i);
  if (nameSet) return { toolId: 'memory.setUserName', inputs: { name: nameSet[1] } };
  if (/\b(?:what(?:'?s| is)?\s+my\s+name|who\s+am\s+i)\b/i.test(text)) {
    return { toolId: 'memory.getUserProfile', inputs: {} };
  }
  return null;
}

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

  const push = useCallback((m: Omit<ConsoleMessage, 'id' | 'at'>) => {
    setMessages(prev => [...prev, { ...m, id: uid(), at: new Date().toISOString() }]);
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busyLabel) return;

    push({ role: 'user', text });
    sessionThreadService.ensureActive();

    // Deterministic shortcut for canonical memory commands — run the real tool
    // directly instead of hoping the model calls it.
    const intent = detectMemoryIntent(text);
    if (intent) {
      setBusyLabel(`Running ${intent.toolId}…`);
      try {
        const exec = await toolRegistryService.execute(intent.toolId, intent.inputs, { approved: true });
        const textOutput = [exec.stdout, exec.stderr].filter(Boolean).join('\n').trim();
        const auraText = textOutput || '(done)';
        push({ role: 'aura', text: auraText, toolUsed: intent.toolId });
        historyRef.current = [
          ...historyRef.current,
          { role: 'user', content: text },
          { role: 'assistant', content: auraText },
        ].slice(-16);
        sessionThreadService.recordTurn(text, auraText);
      } catch (err) {
        push({ role: 'error', text: friendlyError(err) });
      } finally {
        setBusyLabel(null);
      }
      return;
    }

    setBusyLabel('Thinking…');

    const style = 'normal';
    const systemPrompt = auraPersonalityService.buildSystemPrompt({
      responseStyle: style, includeToolAwareness: true,
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

      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: text },
        { role: 'assistant', content: auraText },
      ].slice(-16);

      sessionThreadService.recordTurn(text, auraText);
      // If the model used a memory tool, the fact is already saved by the tool.
    } catch (err) {
      push({ role: 'error', text: friendlyError(err) });
    } finally {
      setBusyLabel(null);
    }
  }, [busyLabel, push]);

  const clear = useCallback(() => {
    historyRef.current = [];
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

import { useState } from 'react';
import { ClipboardPaste, Wand2, Trash2 } from 'lucide-react';
import type { RelayPacket } from '../../types/relay';

interface Props {
  packet: RelayPacket;
  onImport: (text: string) => void;
}

export function RelayResponseImporter({ packet, onImport }: Props) {
  const [text, setText] = useState('');

  const charCount = text.trim().length;
  const canParse = charCount > 20;

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-400">
        Paste the ChatGPT (or other assistant) response below, then click{' '}
        <strong className="text-white">Parse Response</strong>.
      </div>

      {/* Packet reminder */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-500">
        <span className="text-zinc-400 font-medium">Packet:</span>{' '}
        {packet.title}{' '}
        <span className="text-indigo-400 ml-2">→ {packet.targetType}</span>
      </div>

      {/* Import area */}
      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste the full ChatGPT response here…

Tip: for best parsing, ChatGPT's response should include clearly labelled sections like:
• KEY FINDINGS / ARCHITECTURAL DECISIONS
• IDENTIFIED RISKS
• RECOMMENDED NEXT ACTIONS
• SUGGESTED AGENT
• HANDOFF SUMMARY

(You can also paste unstructured text — AURA will do its best.)"
          rows={14}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 resize-y"
        />
        {text && (
          <button
            onClick={() => setText('')}
            className="absolute top-3 right-3 p-1.5 text-zinc-600 hover:text-rose-400 transition"
            title="Clear"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">{charCount > 0 ? `${charCount} characters` : 'Waiting for paste…'}</span>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                setText(t);
              } catch {
                // silent — user can paste manually
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md transition"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste from Clipboard
          </button>
          <button
            onClick={() => onImport(text.trim())}
            disabled={!canParse}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition"
          >
            <Wand2 className="w-4 h-4" />
            Parse Response
          </button>
        </div>
      </div>
    </div>
  );
}

import { Copy, CheckCircle2, ShieldCheck, XCircle, Send } from 'lucide-react';
import { useState } from 'react';
import type { RelayPacket } from '../../types/relay';

interface Props {
  packet: RelayPacket;
  formatted: string;
  onApprove: () => void;
  onReject: () => void;
  onMarkSent: () => void;
}

export function RelayPacketPreview({ packet, formatted, onApprove, onReject, onMarkSent }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the pre element text
      const el = document.getElementById('relay-preview-text');
      if (el) {
        const range = document.createRange();
        range.selectNode(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  }

  const isPendingReview = packet.status === 'waiting_for_admin_review';
  const isApproved = packet.status === 'approved_to_send';
  const isSent = packet.status === 'sent_to_chatgpt' || packet.status === 'waiting_for_chatgpt_response';

  const statusLabel: Record<string, string> = {
    waiting_for_admin_review: 'Awaiting your approval',
    approved_to_send: 'Approved — copy and send manually',
    sent_to_chatgpt: 'Marked as sent',
    waiting_for_chatgpt_response: 'Waiting for response',
  };

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="capitalize bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
            {packet.packetType.replace(/_/g, ' ')}
          </span>
          <span className="text-zinc-500">→</span>
          <span className="text-indigo-400 font-medium">{packet.targetType}</span>
        </div>
        <span className="text-zinc-500">{new Date(packet.createdAt).toLocaleTimeString()}</span>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
        isSent
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          : isApproved
          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
      }`}>
        <ShieldCheck className="w-4 h-4 shrink-0" />
        {statusLabel[packet.status] ?? packet.status}
      </div>

      {/* Formatted preview */}
      <div className="relative">
        <pre
          id="relay-preview-text"
          className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-300 font-mono overflow-auto max-h-72 whitespace-pre-wrap"
        >
          {formatted}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md transition"
        >
          {copied
            ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
            : <><Copy className="w-3.5 h-3.5" /> Copy</>
          }
        </button>
      </div>

      {/* Action buttons */}
      {isPendingReview && (
        <div className="flex gap-3">
          <button
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-semibold transition"
          >
            <ShieldCheck className="w-4 h-4" />
            Approve Send
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-rose-400 rounded-md text-sm font-medium transition"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}

      {isApproved && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-semibold transition"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy Packet to Clipboard'}
            </button>
          </div>
          <button
            onClick={onMarkSent}
            className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md text-sm font-medium transition"
          >
            <Send className="w-4 h-4" />
            I've sent it — waiting for response
          </button>
        </div>
      )}
    </div>
  );
}

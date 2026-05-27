import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp, History, GitBranch, BrainCircuit, Route } from 'lucide-react';
import type { RelayExchange, RelayStatus } from '../../types/relay';

interface Props {
  exchanges: RelayExchange[];
  activeId?: string;
  onSelect: (exchange: RelayExchange) => void;
}

const STATUS_STYLE: Record<RelayStatus, string> = {
  drafted:                    'bg-zinc-800 text-zinc-400 border-zinc-700',
  waiting_for_admin_review:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  approved_to_send:           'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  sent_to_chatgpt:            'bg-sky-500/10 text-sky-400 border-sky-500/20',
  waiting_for_chatgpt_response: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  response_imported:          'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  parsed:                     'bg-violet-500/10 text-violet-400 border-violet-500/20',
  waiting_for_route_approval: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  approved_to_route:          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  routed_to_agent:            'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  archived:                   'bg-zinc-800 text-zinc-500 border-zinc-700',
  rejected:                   'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const STATUS_LABEL: Record<RelayStatus, string> = {
  drafted:                    'Draft',
  waiting_for_admin_review:   'Awaiting Review',
  approved_to_send:           'Approved',
  sent_to_chatgpt:            'Sent',
  waiting_for_chatgpt_response: 'Waiting',
  response_imported:          'Imported',
  parsed:                     'Parsed',
  waiting_for_route_approval: 'Route Review',
  approved_to_route:          'Route OK',
  routed_to_agent:            'Routed',
  archived:                   'Archived',
  rejected:                   'Rejected',
};

function AuditTrail({ exchange }: { exchange: RelayExchange }) {
  return (
    <div className="mt-3 border-t border-zinc-800 pt-3 space-y-1.5">
      <p className="text-xs font-medium text-zinc-500 mb-1.5">Audit Trail</p>
      {exchange.packet.auditTrail.map(e => (
        <div key={e.id} className="flex items-start gap-2 text-xs">
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            e.actor === 'admin' ? 'bg-indigo-500/20 text-indigo-300' :
            e.actor === 'aura'  ? 'bg-violet-500/20 text-violet-300' :
                                  'bg-zinc-800 text-zinc-400'
          }`}>{e.actor}</span>
          <span className="text-zinc-400 flex-1">{e.action}</span>
          <span className="text-zinc-600 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  );
}

export function RelayHistoryPanel({ exchanges, activeId, onSelect }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (exchanges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-sm gap-2">
        <History className="w-6 h-6" />
        No relay exchanges yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {exchanges.map(ex => {
        const isExpanded = expandedId === ex.id;
        const isActive = activeId === ex.id;

        return (
          <div
            key={ex.id}
            className={`rounded-lg border transition ${
              isActive
                ? 'border-indigo-500/40 bg-indigo-500/5'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
            }`}
          >
            {/* Header row */}
            <div
              className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => onSelect(ex)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{ex.packet.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-zinc-600" />
                  <span className="text-xs text-zinc-600">
                    {new Date(ex.createdAt).toLocaleDateString()} {new Date(ex.createdAt).toLocaleTimeString()}
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-xs text-zinc-500 capitalize">
                    {ex.packet.packetType.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <span className={`text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap ${STATUS_STYLE[ex.packet.status]}`}>
                {STATUS_LABEL[ex.packet.status]}
              </span>

              <button
                onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : ex.id); }}
                className="p-1 text-zinc-600 hover:text-zinc-300 transition shrink-0"
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Expanded audit trail & details */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-4">
                {(ex.createdHandoffId || ex.createdMemoryEntryId || ex.finalTargetType) && (
                  <div className="pt-2 border-t border-zinc-800">
                    <p className="text-xs font-medium text-zinc-500 mb-1.5">Outcome Details</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {ex.finalTargetType && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-800/80 border border-zinc-700 text-zinc-300">
                          <Route className="w-3 h-3 text-zinc-400" />
                          Routed to: {ex.finalTargetType}
                          {ex.finalTargetAgentId && ` (${ex.finalTargetAgentId})`}
                        </span>
                      )}
                      {ex.createdHandoffId && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                          <GitBranch className="w-3 h-3" />
                          Handoff: {ex.createdHandoffId}
                        </span>
                      )}
                      {ex.createdMemoryEntryId && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300">
                          <BrainCircuit className="w-3 h-3" />
                          Memory: {ex.createdMemoryEntryId}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <AuditTrail exchange={ex} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

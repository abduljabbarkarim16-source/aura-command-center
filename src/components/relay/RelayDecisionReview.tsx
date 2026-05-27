import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Route,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import type { RelayExchange, RelayTargetType } from '../../types/relay';

const TARGET_OPTIONS: { value: RelayTargetType; label: string }[] = [
  { value: 'claude',      label: 'Claude (Anthropic)' },
  { value: 'codex',       label: 'Codex (OpenAI)' },
  { value: 'antigravity', label: 'Antigravity' },
  { value: 'chatgpt',     label: 'ChatGPT' },
  { value: 'gemini',      label: 'Gemini' },
  { value: 'manual',      label: 'Manual / Admin Review' },
];

interface Props {
  exchange: RelayExchange;
  onApproveRoute: (target: RelayTargetType) => void;
  onCreateHandoff: () => void;
}

export function RelayDecisionReview({ exchange, onApproveRoute, onCreateHandoff }: Props) {
  const resp = exchange.response;
  const [selectedTarget, setSelectedTarget] = useState<RelayTargetType>(
    resp?.recommendedTarget ?? 'manual'
  );

  if (!resp) return null;

  const isRouteApproved = exchange.packet.status === 'approved_to_route';
  const isRoutedToAgent = exchange.packet.status === 'routed_to_agent';

  return (
    <div className="space-y-5">
      {/* Parsed summary */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Parsed Summary</h3>
          <span className="ml-auto text-xs text-zinc-600">
            Confidence: {resp.confidence}%
          </span>
        </div>
        <p className="text-sm text-zinc-300">{resp.parsedSummary}</p>
      </div>

      {/* Key decisions */}
      {resp.decisions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
            Key Decisions / Findings ({resp.decisions.length})
          </h4>
          <ul className="space-y-2">
            {resp.decisions.map(d => (
              <li key={d.id} className="flex items-start gap-2 bg-indigo-500/5 border border-indigo-500/15 rounded-lg px-3 py-2.5">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                <span className="text-sm text-zinc-300">{d.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {resp.risks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
            Identified Risks ({resp.risks.length})
          </h4>
          <ul className="space-y-2">
            {resp.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <span className="text-sm text-zinc-300">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next actions */}
      {resp.nextActions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
            Recommended Next Actions ({resp.nextActions.length})
          </h4>
          <ol className="space-y-2">
            {resp.nextActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5">
                <span className="text-xs text-indigo-400 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                <span className="text-sm text-zinc-300">{a}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* No parsed content fallback */}
      {resp.decisions.length === 0 && resp.risks.length === 0 && resp.nextActions.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-sm text-zinc-400">
            Auto-parsing did not detect structured sections. Review the raw response and
            manually assign routing below.
          </p>
          <details className="mt-3">
            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
              Show raw response
            </summary>
            <pre className="mt-2 text-xs text-zinc-400 font-mono whitespace-pre-wrap bg-zinc-950 border border-zinc-800 p-3 rounded max-h-48 overflow-auto">
              {resp.rawText}
            </pre>
          </details>
        </div>
      )}

      {/* Routing */}
      {!isRoutedToAgent && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Route Decision to Agent</h3>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Target Agent
              {resp.recommendedTarget && resp.recommendedTarget !== 'manual' && (
                <span className="ml-2 text-indigo-400">(recommended: {resp.recommendedTarget})</span>
              )}
            </label>
            <select
              value={selectedTarget}
              onChange={e => setSelectedTarget(e.target.value as RelayTargetType)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {TARGET_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {!isRouteApproved ? (
            <button
              onClick={() => onApproveRoute(selectedTarget)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-semibold transition"
            >
              <ShieldCheck className="w-4 h-4" />
              Approve Route to {selectedTarget}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Route approved → <strong>{selectedTarget}</strong>
              </div>
              <button
                onClick={onCreateHandoff}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-semibold transition"
              >
                <GitBranch className="w-4 h-4" />
                Create Handoff (Phase 2D placeholder)
              </button>
            </div>
          )}
        </div>
      )}

      {isRoutedToAgent && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Exchange complete — routed to <strong className="ml-1">{selectedTarget}</strong>
        </div>
      )}
    </div>
  );
}

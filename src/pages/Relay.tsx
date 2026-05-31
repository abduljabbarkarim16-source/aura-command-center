/**
 * Relay page — Phase 2E Deep Refinement
 *
 * Approval-first: pending relays show as approval cards by default.
 * Full form hidden under Advanced Edit.
 */

import { Workflow, ShieldAlert } from 'lucide-react';
import { ReasoningRelayPanel } from '../components/relay/ReasoningRelayPanel';

export function Relay() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6 h-full">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Workflow className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white leading-none">
              Reasoning Relay
            </h1>
            <p className="text-zinc-500 text-[13px] mt-0.5">
              Approval-gated relay between local agents and external providers
            </p>
          </div>
        </div>

        {/* Safety notice chip */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/5 border border-amber-500/15 rounded-xl text-[12px] text-amber-400/80 flex-shrink-0 hidden sm:flex">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
          Manual relay only — no automated dispatch
        </div>
      </div>

      <ReasoningRelayPanel />
    </div>
  );
}

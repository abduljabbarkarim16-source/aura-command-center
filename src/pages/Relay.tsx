import { Workflow } from 'lucide-react';
import { ReasoningRelayPanel } from '../components/relay/ReasoningRelayPanel';

export function Relay() {
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-5 h-full">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <Workflow className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white leading-none">
            Reasoning Relay
          </h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Approval-gated relay between local agents and external reasoning assistants
            <span className="ml-2 text-xs text-zinc-600">Phase 2C · localStorage</span>
          </p>
        </div>
      </div>

      <ReasoningRelayPanel />
    </div>
  );
}

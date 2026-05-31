import { MissionStatusCard } from './MissionStatusCard';
import { ApprovalCard } from './ApprovalCard';
import { Server, Zap } from 'lucide-react';

export function OperatorStack() {
  return (
    <div className="flex flex-col gap-4">
      {/* Mission Status */}
      <MissionStatusCard 
        objective="Convert AURA Command Center from Vite React mock into Tauri desktop app"
        phase="Phase 2E - Desktop visual QA"
        activeAgent="antigravity"
        progress={90}
        lastEvent="Initiated UX redesign workflow"
        nextAction="Launch tauri:dev and verify UI"
      />

      {/* Approvals (mock showing one pending) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-zinc-500 font-medium uppercase tracking-wider">Requires Approval</span>
          <span className="text-indigo-400 font-medium">1 Pending</span>
        </div>
        <ApprovalCard 
          title="Relay Packet Ready"
          summary="AURA has prepared a reasoning relay packet to request architectural review from ChatGPT."
          riskLevel="low"
          requestedAction="Approve dispatch to external provider"
          sourceAgent="AURA"
          targetAgent="ChatGPT"
        />
      </div>

      {/* System Health Compact */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-zinc-500 font-medium uppercase tracking-wider">System Health</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Server className="w-3.5 h-3.5 text-emerald-500" />
            <span>Local Shell Online</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            <span>Memory Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { mockCommands } from '../../mock/commands';
import { Terminal, Check, X, AlertTriangle, AlertOctagon, History, PlayCircle, Archive } from 'lucide-react';
import { QueuedCommand, CommandStatus } from '../../types/commands';
import { cn } from '../../lib/utils';

export function CommandApprovalQueue() {
  const [commands, setCommands] = useState<QueuedCommand[]>(mockCommands);

  const updateStatus = (id: string, newStatus: CommandStatus) => {
    setCommands(cmds => cmds.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  const pending = commands.filter(c => c.status === 'pending');
  const history = commands.filter(c => c.status !== 'pending');

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col max-h-[500px]">
      <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Terminal className="w-4 h-4 text-indigo-400" />
          Command Queue
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium">
            {pending.length} Pending
          </span>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-xs font-medium">
            {history.length} History
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        
        {pending.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-semibold text-zinc-500 tracking-wider">Requires Approval</h4>
            {pending.map(cmd => (
              <CommandItem key={cmd.id} cmd={cmd} onUpdate={updateStatus} />
            ))}
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-3 mt-4 pt-4 border-t border-zinc-800/50">
            <h4 className="text-xs uppercase font-semibold text-zinc-500 tracking-wider">Audit History</h4>
            {history.map(cmd => (
              <CommandItem key={cmd.id} cmd={cmd} onUpdate={updateStatus} isHistory />
            ))}
          </div>
        )}

        {commands.length === 0 && (
          <div className="text-center text-zinc-500 text-sm py-4">
            No commands in queue.
          </div>
        )}
      </div>
    </div>
  );
}

function CommandItem({ cmd, onUpdate, isHistory = false }: { cmd: QueuedCommand, onUpdate: (id: string, s: CommandStatus) => void, isHistory?: boolean, key?: string }) {
  
  const getRiskIcon = () => {
    switch (cmd.riskLevel) {
      case 'critical': return <AlertOctagon className="w-3 h-3" />;
      case 'high': return <AlertTriangle className="w-3 h-3" />;
      default: return null;
    }
  };

  const getRiskColor = () => {
    switch (cmd.riskLevel) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  const getStatusDisplay = () => {
    switch (cmd.status) {
      case 'approved': return <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Approved</span>;
      case 'rejected': return <span className="text-rose-400 flex items-center gap-1"><X className="w-3 h-3" /> Rejected</span>;
      case 'executed': return <span className="text-indigo-400 flex items-center gap-1"><PlayCircle className="w-3 h-3" /> Executed</span>;
      case 'failed': return <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Failed</span>;
      case 'logged': return <span className="text-zinc-500 flex items-center gap-1"><Archive className="w-3 h-3" /> Logged</span>;
      default: return null;
    }
  };

  return (
    <div className={cn("bg-zinc-900 border border-zinc-800 rounded-lg p-3", isHistory && "opacity-75 hover:opacity-100 transition-opacity")}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cmd.riskLevel === 'critical' ? 'bg-red-500 animate-pulse' : cmd.riskLevel === 'high' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-xs font-medium text-zinc-300">Requested by {cmd.requestedByAgentId}</span>
        </div>
        
        <div className="flex gap-2">
          {isHistory && (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-400">
              {getStatusDisplay()}
            </span>
          )}
          {['high', 'critical'].includes(cmd.riskLevel) && (
            <span className={cn("flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border", getRiskColor())}>
              {getRiskIcon()} {cmd.riskLevel} Risk
            </span>
          )}
        </div>
      </div>

      <div className="font-mono text-xs text-zinc-200 bg-zinc-950 p-2 rounded border border-zinc-800 break-all mb-2">
        $ {cmd.command} {cmd.args.join(' ')}
      </div>

      <p className="text-xs text-zinc-500 mb-3">
        <span className="font-medium text-zinc-400">Reason:</span> {cmd.reason}
      </p>

      {cmd.status === 'pending' && (
        <div className="flex gap-2">
          <button 
            onClick={() => onUpdate(cmd.id, 'approved')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition text-xs font-medium border border-emerald-500/20"
          >
            <Check className="w-3.5 h-3.5" /> Approve
          </button>
          <button 
            onClick={() => onUpdate(cmd.id, 'rejected')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded transition text-xs font-medium border border-rose-500/20"
          >
            <X className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      )}

      {cmd.status === 'approved' && (
        <div className="flex gap-2">
          <button 
            onClick={() => onUpdate(cmd.id, 'executed')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded transition text-xs font-medium border border-indigo-500/20"
          >
            <PlayCircle className="w-3.5 h-3.5" /> Mark Executed
          </button>
        </div>
      )}

      {cmd.status === 'executed' && (
        <div className="flex gap-2">
          <button 
            onClick={() => onUpdate(cmd.id, 'logged')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-400 rounded transition text-xs font-medium border border-zinc-500/20"
          >
            <Archive className="w-3.5 h-3.5" /> Move to Logs
          </button>
        </div>
      )}
    </div>
  );
}

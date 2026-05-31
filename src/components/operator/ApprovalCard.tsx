import { ShieldAlert, Check, X, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ApprovalCardProps {
  title: string;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requestedAction: string;
  sourceAgent: string;
  targetAgent: string;
  status?: 'pending' | 'approved' | 'rejected';
  onApprove?: () => void;
  onReject?: () => void;
  onDetails?: () => void;
}

export function ApprovalCard({
  title,
  summary,
  riskLevel,
  requestedAction,
  sourceAgent,
  targetAgent,
  status = 'pending',
  onApprove,
  onReject,
  onDetails
}: ApprovalCardProps) {
  
  const getRiskColor = (level: string) => {
    switch(level) {
      case 'low': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-zinc-400 bg-zinc-800/50 border-zinc-700';
    }
  };

  const getRiskIcon = (level: string) => {
    switch(level) {
      case 'low': return <ShieldCheck className="w-3 h-3" />;
      case 'critical':
      case 'high': return <ShieldAlert className="w-3 h-3" />;
      default: return <AlertTriangle className="w-3 h-3" />;
    }
  };

  return (
    <div className={cn(
      "flex flex-col gap-3 p-4 rounded-xl border transition-colors",
      status === 'pending' ? "bg-zinc-900 border-zinc-800" : 
      status === 'approved' ? "bg-emerald-950/20 border-emerald-900/30" : 
      "bg-red-950/20 border-red-900/30"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-zinc-100">{title}</h3>
            {status === 'pending' && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
            {summary}
          </p>
        </div>
        <div className={cn("flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium uppercase tracking-wider shrink-0", getRiskColor(riskLevel))}>
          {getRiskIcon(riskLevel)}
          {riskLevel} RISK
        </div>
      </div>

      {/* Details Box */}
      <div className="bg-zinc-950/50 rounded-lg p-3 text-xs border border-zinc-800/50 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Action</span>
          <span className="text-zinc-300 font-medium">{requestedAction}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Route</span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">{sourceAgent}</span>
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded text-[10px]">{targetAgent}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {status === 'pending' ? (
        <div className="flex items-center gap-2 mt-1">
          <button 
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded-lg text-xs font-medium transition"
          >
            <Check className="w-3.5 h-3.5" />
            Approve
          </button>
          <button 
            onClick={onReject}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 rounded-lg text-xs font-medium transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {onDetails && (
            <button 
              onClick={onDetails}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition"
            >
              Details
            </button>
          )}
        </div>
      ) : (
        <div className={cn(
          "flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium border",
          status === 'approved' 
            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
            : "text-red-400 bg-red-500/10 border-red-500/20"
        )}>
          {status === 'approved' ? (
            <><Check className="w-3.5 h-3.5" /> Approved</>
          ) : (
            <><X className="w-3.5 h-3.5" /> Rejected</>
          )}
        </div>
      )}
    </div>
  );
}

import { Activity, Zap, Database } from 'lucide-react';
import { mockUsage } from '../../mock/usage';

export function UsageMeter() {
  const { 
    inputTokens, outputTokens, totalTokens, contextWindowPercentage, 
    estimatedCost, activeProvider, activeModel, fallbackProvider 
  } = mockUsage;

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="w-4 h-4 text-emerald-400" />
          Runtime Usage
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-zinc-500 mb-1">Active Model</div>
          <div className="text-sm font-medium text-zinc-200">{activeModel}</div>
          <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">{activeProvider}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-1">Fallback Route</div>
          <div className="text-sm font-medium text-zinc-400">{fallbackProvider}</div>
          <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Ready</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-end">
          <span className="text-xs text-zinc-500">Context Window</span>
          <span className="text-xs font-mono text-zinc-300">{contextWindowPercentage}%</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${contextWindowPercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-zinc-800 rounded-md">
            <Database className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500">Input Tokens</span>
            <span className="text-xs font-mono font-medium">{inputTokens.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-zinc-800 rounded-md">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500">Output Tokens</span>
            <span className="text-xs font-mono font-medium">{outputTokens.toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50 text-xs">
        <span className="text-zinc-500">Total Tokens</span>
        <span className="font-mono text-zinc-300">{totalTokens.toLocaleString()}</span>
      </div>
      
      <div className="flex justify-between items-center text-xs">
        <span className="text-zinc-500">Estimated Cost</span>
        <span className="font-mono text-emerald-400 font-medium">${estimatedCost.toFixed(4)}</span>
      </div>
    </div>
  );
}

import { Network, ArrowRightLeft, ShieldAlert, Cpu } from 'lucide-react';

export function ModelRouterPanel() {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Network className="w-4 h-4 text-pink-500" />
          AURA Model Router
        </div>
        <span className="px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 text-[10px] uppercase font-bold tracking-wider">
          Automatic
        </span>
      </div>

      <div className="p-4 space-y-4">
         <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex flex-col gap-2">
           <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Current Task Classification</div>
           <div className="font-mono text-sm text-zinc-200">Complex UI Implementation</div>
           <div className="text-xs text-pink-400/80 italic border-l-2 border-pink-500/50 pl-2 ml-1">
             Requires strong React capability and tool execution.
           </div>
         </div>

         <div className="relative flex items-center justify-between px-2">
           <div className="w-1/2 pr-4 flex flex-col items-center text-center">
             <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Selected Agent</div>
             <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2">
               <Cpu className="w-5 h-5 text-emerald-400" />
             </div>
             <div className="text-xs font-semibold text-zinc-200">Claude Architect</div>
             <div className="text-[10px] text-emerald-500">claude-3-5-sonnet</div>
           </div>
           
           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-950 p-1.5 rounded-full border border-zinc-800 z-10">
             <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-500" />
           </div>

           <div className="w-1/2 pl-4 flex flex-col items-center text-center opacity-60">
             <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Fallback Route</div>
             <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-2">
               <Cpu className="w-5 h-5 text-zinc-400" />
             </div>
             <div className="text-xs font-semibold text-zinc-400">Codex Dev</div>
             <div className="text-[10px] text-zinc-500">gpt-4o</div>
           </div>
         </div>

         <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs text-amber-400/90 leading-relaxed flex items-start gap-2">
           <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
           <p>
             <strong>Limit Handling:</strong> AURA respects provider limits. If an API limit is reached on Anthropic, AURA will automatically create a handoff snapshot and switch to the OpenAI fallback route.
           </p>
         </div>
      </div>
    </div>
  );
}

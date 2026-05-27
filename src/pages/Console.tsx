import React, { useState } from 'react';
import { Sparkles, Settings2, Bot } from 'lucide-react';
import { mockMessages } from '../store/mockData';

import { AuraLaunchScreen } from '../components/operator/AuraLaunchScreen';
import { AuraComposer } from '../components/operator/AuraComposer';
import { OperatorRail } from '../components/operator/OperatorRail';
import { TechnicalDrawer } from '../components/operator/TechnicalDrawer';
import { cn } from '../lib/utils';

export function Console() {
  const [hasInitiated, setHasInitiated] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(true);

  if (!hasInitiated) {
    return <AuraLaunchScreen onInitiate={() => setHasInitiated(true)} />;
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-zinc-950/20">
      {/* Center Console (Hero) */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Minimalist Top Nav for the Chat Area */}
        <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-transparent z-10 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-zinc-200">AURA</span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active & Monitoring
              </span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 rounded-lg text-[13px] font-medium transition backdrop-blur-md"
          >
            <Settings2 className="w-4 h-4" />
            Technical Details
          </button>
        </div>

        {/* Scrollable Message Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pt-20 pb-4">
          <div className="max-w-4xl mx-auto w-full px-4 flex flex-col gap-6">
            
            {/* System Start Marker */}
            <div className="flex items-center justify-center py-6">
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent w-full max-w-xs" />
              <span className="px-4 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest whitespace-nowrap">Session Started</span>
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent w-full max-w-xs" />
            </div>

            {/* Chat Bubbles */}
            {mockMessages.map(msg => (
              <div key={msg.id} className={cn(
                "flex flex-col",
                msg.role === 'user' ? "items-end" : "items-start"
              )}>
                <div className="flex items-center gap-2 mb-1.5 px-2">
                  {msg.role !== 'user' && <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
                  <span className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
                    {msg.role === 'user' ? 'Operator' : msg.agentId || 'AURA'}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-medium">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className={cn(
                  "p-4 px-5 rounded-3xl max-w-[85%] text-[15px] leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-zinc-800 text-zinc-100 rounded-tr-sm shadow-sm" 
                    : "bg-zinc-900/40 border border-zinc-800/60 text-zinc-300 rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            <div className="h-4" /> {/* Bottom spacer before composer */}
          </div>
        </div>

        {/* Fixed Composer at Bottom */}
        <div className="shrink-0 pt-2 pb-6 px-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
          <div className="max-w-4xl mx-auto w-full">
            <AuraComposer />
          </div>
        </div>
      </div>

      {/* Collapsible Right Panel */}
      <OperatorRail 
        isCollapsed={isRailCollapsed} 
        onToggle={() => setIsRailCollapsed(!isRailCollapsed)} 
      />

      {/* Hidden Developer Drawer */}
      <TechnicalDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}

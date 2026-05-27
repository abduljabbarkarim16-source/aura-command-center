import React, { useState } from 'react';
import { Mic, Send, Paperclip, Orbit, Settings2, Hand, Activity, StopCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function AuraComposer() {
  const [isListening, setIsListening] = useState(false);
  const [text, setText] = useState('');

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-4">
        
        {/* Quick Commands */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <QuickCommand label="Continue current task" />
          <QuickCommand label="Review system status" />
          <QuickCommand label="Create relay" />
          <QuickCommand label="Show approvals" />
          <QuickCommand label="Open technical details" />
        </div>

        {/* Composer Box */}
        <div className={cn(
          "bg-zinc-900/80 backdrop-blur-md border rounded-2xl transition-all duration-300 shadow-xl overflow-hidden group",
          isListening 
            ? "border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-indigo-500/10" 
            : "border-zinc-800/80 hover:border-zinc-700/80 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600"
        )}>
          {/* Main Input Area */}
          <div className="flex items-start gap-3 p-4 pb-2">
            
            {/* Status Orb Indicator */}
            <div className="flex-shrink-0 mt-1 relative">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500",
                isListening 
                  ? "bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.5)] scale-110" 
                  : "bg-zinc-800/80 group-focus-within:bg-indigo-500/20"
              )}>
                <Orbit className={cn(
                  "w-5 h-5 transition-all duration-500",
                  isListening ? "text-white animate-[spin_4s_linear_infinite]" : "text-zinc-500 group-focus-within:text-indigo-400"
                )} />
              </div>
              
              {/* Pulse effect when listening */}
              {isListening && (
                <div className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20" />
              )}
            </div>

            <textarea 
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Talk to AURA or type a command..."
              className={cn(
                "flex-1 bg-transparent border-none focus:outline-none text-[16px] leading-relaxed resize-none max-h-48 min-h-[48px] py-2 custom-scrollbar transition-colors",
                isListening ? "text-indigo-100 placeholder:text-indigo-300/50" : "text-zinc-200 placeholder:text-zinc-600"
              )}
              rows={1}
            />
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/30 border-t border-zinc-800/40">
            <div className="flex items-center gap-1.5">
              <button className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-colors">
                <Paperclip className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-zinc-800 mx-1" />
              
              {/* Status Indicator Text */}
              <span className={cn(
                "text-xs font-medium ml-2 tracking-wide uppercase flex items-center gap-2 transition-colors",
                isListening ? "text-indigo-400" : "text-zinc-500"
              )}>
                {isListening ? (
                  <>
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                    Listening...
                  </>
                ) : (
                  "Idle"
                )}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsListening(!isListening)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                  isListening 
                    ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20" 
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-transparent"
                )}
              >
                {isListening ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isListening ? "Stop" : "Voice"}
              </button>
              
              <button className={cn(
                "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center",
                text.length > 0 
                  ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20" 
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickCommand({ label }: { label: string }) {
  return (
    <button className="px-3.5 py-1.5 bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-full text-[13px] font-medium transition-all duration-200 shadow-sm">
      {label}
    </button>
  );
}

import React, { useState } from 'react';
import { Send, Mic, Sparkles, Orbit, Settings2, Play, ShieldCheck, Lock, HardDrive, BrainCircuit } from 'lucide-react';
import { mockMessages } from '../store/mockData';

import { OperatorStack } from '../components/operator/OperatorStack';
import { TechnicalDrawer } from '../components/operator/TechnicalDrawer';

export function Console() {
  const [hasInitiated, setHasInitiated] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (!hasInitiated) {
    return (
      <div className="h-full flex flex-col items-center justify-center relative overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center max-w-lg w-full px-6 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-2xl flex items-center justify-center mb-6 ring-4 ring-indigo-500/20">
            <Orbit className="w-10 h-10 text-white animate-[spin_10s_linear_infinite]" />
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">AURA Command Center</h1>
          <p className="text-zinc-400 text-lg mb-10">Agentic Unified Routing Assistant</p>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <StatusChip icon={<ShieldCheck className="w-3.5 h-3.5" />} text="Local shell ready" color="emerald" />
            <StatusChip icon={<BrainCircuit className="w-3.5 h-3.5" />} text="Memory online" color="emerald" />
            <StatusChip icon={<HardDrive className="w-3.5 h-3.5" />} text="Relay standby" color="blue" />
            <StatusChip icon={<Lock className="w-3.5 h-3.5" />} text="Tools locked" color="amber" />
          </div>

          <button 
            onClick={() => setHasInitiated(true)}
            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 group"
          >
            <Play className="w-4 h-4 fill-current transition-transform group-hover:translate-x-0.5" />
            Initiate AURA
          </button>
          
          <button 
            onClick={() => {
              setHasInitiated(true);
              setIsDrawerOpen(true);
            }}
            className="mt-4 px-6 py-2.5 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition"
          >
            Open in Safe Monitor Mode
          </button>
          
          <p className="mt-8 text-xs text-zinc-600">No external tools run without explicit admin approval.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6">
      {/* Left Chat Console */}
      <div className="flex-1 flex flex-col min-w-0 flex-shrink h-full">
        {/* Top Mission Header */}
        <div className="mb-4 shrink-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Console</h1>
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-xs font-medium border border-indigo-500/20">
                gpt-5.5-thinking
              </span>
            </div>
            <p className="text-zinc-400 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Monitoring active task
            </p>
          </div>
          
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg text-sm transition"
          >
            <Settings2 className="w-4 h-4" />
            Technical Drawer
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-zinc-950 border border-zinc-800/80 rounded-2xl flex flex-col min-h-0 overflow-hidden shadow-sm relative">
          <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0 custom-scrollbar">
            {mockMessages.map(msg => (
              <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  {msg.role !== 'user' && <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
                  <span className="text-xs font-medium text-zinc-400 tracking-wide uppercase">
                    {msg.role === 'user' ? 'Admin' : msg.agentId || 'AURA'}
                  </span>
                  <span className="text-[10px] text-zinc-600">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-zinc-900 border border-zinc-800/80 text-zinc-200 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="p-4 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800/80 shrink-0">
            <div className="flex flex-wrap gap-2 mb-3">
              <QuickActionChip text="Review status" />
              <QuickActionChip text="Continue task" />
              <QuickActionChip text="Create handoff" />
              <QuickActionChip text="Ask ChatGPT relay" />
            </div>
            
            <div className="flex items-end gap-2 bg-zinc-900/80 border border-zinc-800 rounded-xl p-2 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
              <button className="p-2.5 flex-shrink-0 text-zinc-500 hover:text-indigo-400 transition">
                <Mic className="w-5 h-5" />
              </button>
              <textarea 
                placeholder="Talk to AURA or assign a task..."
                className="flex-1 bg-transparent border-none focus:outline-none text-zinc-200 text-[15px] resize-none max-h-32 min-h-[44px] py-2.5 leading-relaxed placeholder:text-zinc-600 custom-scrollbar"
                rows={1}
              />
              <button className="p-2.5 flex-shrink-0 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-md transition">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Operator Stack */}
      <div className="w-[340px] xl:w-[380px] flex-shrink-0 flex flex-col h-full min-h-0 pt-[4.5rem]">
        <OperatorStack />
      </div>

      {/* Technical Drawer */}
      <TechnicalDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}

function StatusChip({ icon, text, color }: { icon: React.ReactNode, text: string, color: 'emerald' | 'amber' | 'blue' }) {
  const colorMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${colorMap[color]}`}>
      {icon}
      {text}
    </div>
  );
}

function QuickActionChip({ text }: { text: string }) {
  return (
    <button className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-medium transition cursor-pointer">
      {text}
    </button>
  );
}

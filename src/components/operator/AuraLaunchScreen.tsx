import React from 'react';
import { Orbit, Shield, Power, Activity } from 'lucide-react';

interface AuraLaunchScreenProps {
  onInitiate: () => void;
}

export function AuraLaunchScreen({ onInitiate }: AuraLaunchScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-full bg-gradient-to-b from-zinc-950 via-zinc-950 to-indigo-950/20">
      
      <div className="flex flex-col items-center max-w-lg w-full px-6 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Glowing Orb */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[0_0_40px_rgba(79,70,229,0.4)] flex items-center justify-center relative z-10">
            <Orbit className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Branding */}
        <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
          AURA Command Center
        </h1>
        <p className="text-lg text-zinc-400 font-medium tracking-wide mb-10">
          Agentic Unified Routing Assistant
        </p>

        {/* Status Chips */}
        <div className="flex items-center gap-4 mb-12">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Activity className="w-3.5 h-3.5" />
            Core Online
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Shield className="w-3.5 h-3.5" />
            Tools Secured
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-4">
          <button 
            onClick={onInitiate}
            className="w-full flex items-center justify-center gap-3 bg-white text-zinc-950 hover:bg-zinc-200 py-4 px-6 rounded-2xl font-semibold text-lg transition-all shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5"
          >
            <Power className="w-5 h-5" />
            Initiate AURA
          </button>
          
          <button 
            onClick={onInitiate}
            className="w-full flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 py-4 px-6 rounded-2xl font-medium transition-colors"
          >
            Safe Monitor Mode
          </button>
        </div>

        {/* Trust Note */}
        <p className="mt-8 text-sm text-zinc-500 flex items-center justify-center gap-2">
          <Shield className="w-4 h-4 opacity-50" />
          External tools remain locked until approved.
        </p>
      </div>

    </div>
  );
}

import React from 'react';
import { Target, Clock, Bot, ArrowRight, History } from 'lucide-react';

export interface MissionStatusCardProps {
  objective: string;
  phase: string;
  activeAgent: string;
  progress: number;
  nextAction: string;
  lastEvent: string;
  onViewTimeline?: () => void;
}

export function MissionStatusCard({
  objective,
  phase,
  activeAgent,
  progress,
  nextAction,
  lastEvent,
  onViewTimeline
}: MissionStatusCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-indigo-400" />
          <h3 className="font-medium text-zinc-100 text-sm">Active Mission</h3>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          {objective}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-zinc-950 w-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Phase
            </span>
            <span className="text-zinc-300 font-medium">{phase}</span>
          </div>
          <div className="space-y-1">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Bot className="w-3 h-3" /> Active Agent
            </span>
            <span className="text-indigo-400 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              {activeAgent}
            </span>
          </div>
        </div>

        {/* Action items */}
        <div className="bg-zinc-950/50 rounded-lg p-3 text-xs border border-zinc-800/50 space-y-3">
          <div>
            <div className="text-zinc-500 mb-1">Last Event</div>
            <div className="text-zinc-400">{lastEvent}</div>
          </div>
          <div>
            <div className="text-zinc-500 mb-1">Next Action prepared</div>
            <div className="flex items-start gap-1.5 text-zinc-300">
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <span>{nextAction}</span>
            </div>
          </div>
        </div>

        <button 
          onClick={onViewTimeline}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2"
        >
          <History className="w-3.5 h-3.5" />
          View Timeline
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { PanelRightClose, PanelRight, Activity, Workflow, CheckCircle2, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { OperatorStack } from './OperatorStack';

interface OperatorRailProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function OperatorRail({ isCollapsed, onToggle }: OperatorRailProps) {
  return (
    <div className={cn(
      "flex flex-col h-full bg-zinc-950/40 border-l border-zinc-800/60 transition-all duration-300 ease-in-out shrink-0",
      isCollapsed ? "w-[4.25rem]" : "w-[340px] xl:w-[380px]"
    )}>
      {/* Header */}
      <div className={cn(
        "h-[4.25rem] flex items-center border-b border-zinc-800/60 shrink-0 transition-all",
        isCollapsed ? "justify-center px-0" : "px-5 justify-between"
      )}>
        {!isCollapsed && (
          <span className="font-semibold text-zinc-100 text-sm tracking-wide">Operator Stack</span>
        )}
        
        <button 
          onClick={onToggle} 
          title={isCollapsed ? "Expand Operator Panel" : "Collapse Operator Panel"}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors"
        >
          {isCollapsed ? <PanelRight className="w-5 h-5" /> : <PanelRightClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isCollapsed ? (
          <div className="py-6 flex flex-col items-center gap-4">
            <RailItem icon={<Activity className="w-5 h-5 text-indigo-400" />} active tooltip="Active Mission" />
            <RailItem icon={<Workflow className="w-5 h-5 text-amber-400" />} badge={1} tooltip="Requires Approval" />
            <div className="w-8 h-px bg-zinc-800/60 my-2" />
            <RailItem icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />} tooltip="System Healthy" />
            <RailItem icon={<CheckCircle2 className="w-5 h-5 text-zinc-500" />} tooltip="All Systems Go" />
          </div>
        ) : (
          <div className="p-5">
            <OperatorStack />
          </div>
        )}
      </div>
    </div>
  );
}

function RailItem({ icon, badge, active, tooltip }: { icon: React.ReactNode, badge?: number, active?: boolean, tooltip: string }) {
  return (
    <div 
      className={cn(
        "relative p-3 rounded-xl transition-all cursor-pointer group",
        active ? "bg-zinc-900/80 border border-zinc-800" : "hover:bg-zinc-900/40 border border-transparent"
      )}
      title={tooltip}
    >
      {icon}
      {badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white ring-2 ring-zinc-950">
          {badge}
        </span>
      )}
    </div>
  );
}

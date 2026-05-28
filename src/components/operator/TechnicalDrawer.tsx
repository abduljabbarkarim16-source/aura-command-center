import React, { useState } from 'react';
import { Settings2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

// Import the existing technical panels
import { LocalhostPreviewPanel } from '../workspace/LocalhostPreviewPanel';
import { WorkspaceSafetyPanel } from '../workspace/WorkspaceSafetyPanel';
import { CommandApprovalQueue } from '../workspace/CommandApprovalQueue';
import { GitWorkspacePanel } from '../workspace/GitWorkspacePanel';
import { ArtifactPanel } from '../workspace/ArtifactPanel';
import { ModelRouterPanel } from '../workspace/ModelRouterPanel';
import { UsageMeter } from '../runtime/UsageMeter';
import { BackgroundTasksPanel } from '../runtime/BackgroundTasksPanel';
import { VoiceControlPanel } from '../voice/VoiceControlPanel';

interface TechnicalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TechnicalDrawer({ isOpen, onClose }: TechnicalDrawerProps) {
  const [activeTab, setActiveTab] = useState<'workspace' | 'artifacts' | 'runtime' | 'voice' | 'gitcmds'>('workspace');

  return (
    <div className={cn(
      "fixed inset-y-0 right-0 w-[420px] bg-zinc-950 border-l border-zinc-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col",
      isOpen ? "translate-x-0" : "translate-x-full"
    )}>
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800 shrink-0 bg-zinc-950">
        <div className="flex items-center gap-2 text-zinc-100">
          <Settings2 className="w-5 h-5 text-zinc-400" />
          <h2 className="font-medium tracking-tight">Technical details</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 p-4">
        {/* Tab Navigation */}
        <div className="flex gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-lg shrink-0 mb-4 overflow-x-auto no-scrollbar whitespace-nowrap">
          {[
            { id: 'workspace', label: 'Workspace' },
            { id: 'artifacts', label: 'Artifacts' },
            { id: 'runtime', label: 'Runtime' },
            { id: 'voice', label: 'Voice' },
            { id: 'gitcmds', label: 'Git / Cmds' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition",
                activeTab === tab.id 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto w-full pb-4 pr-1 space-y-4 no-scrollbar">
          {activeTab === 'workspace' && (
            <>
              <LocalhostPreviewPanel />
              <WorkspaceSafetyPanel />
            </>
          )}
          
          {activeTab === 'artifacts' && (
            <ArtifactPanel />
          )}
          
          {activeTab === 'runtime' && (
            <>
              <ModelRouterPanel />
              <UsageMeter />
              <BackgroundTasksPanel />
            </>
          )}

          {activeTab === 'voice' && (
            <VoiceControlPanel />
          )}

          {activeTab === 'gitcmds' && (
            <>
              <CommandApprovalQueue />
              <GitWorkspacePanel />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

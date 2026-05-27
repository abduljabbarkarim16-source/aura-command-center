import { useState } from 'react';
import { Send, Terminal, Image as ImageIcon, Paperclip } from 'lucide-react';
import { mockMessages } from '../store/mockData';

// Workspace components
import { LocalhostPreviewPanel } from '../components/workspace/LocalhostPreviewPanel';
import { WorkspaceSafetyPanel } from '../components/workspace/WorkspaceSafetyPanel';
import { CommandApprovalQueue } from '../components/workspace/CommandApprovalQueue';
import { GitWorkspacePanel } from '../components/workspace/GitWorkspacePanel';
import { ArtifactPanel } from '../components/workspace/ArtifactPanel';
import { ModelRouterPanel } from '../components/workspace/ModelRouterPanel';

// Runtime components
import { UsageMeter } from '../components/runtime/UsageMeter';
import { BackgroundTasksPanel } from '../components/runtime/BackgroundTasksPanel';

// Voice component
import { VoiceControlPanel } from '../components/voice/VoiceControlPanel';

export function Console() {
  const [activeTab, setActiveTab] = useState<'workspace' | 'artifacts' | 'runtime' | 'voice' | 'gitcmds'>('workspace');

  return (
    <div className="flex h-full gap-4">
      {/* Left Chat Console */}
      <div className="flex-1 flex flex-col min-w-0 flex-shrink h-full">
        <div className="mb-4 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">AURA Console</h1>
          <p className="text-zinc-400 text-sm">Active execution and inter-agent coordination</p>
        </div>

        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
            {mockMessages.map(msg => (
              <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-xs font-medium text-zinc-500">{msg.role === 'user' ? 'You' : msg.agentId || 'AURA'}</span>
                  <span className="text-[10px] text-zinc-600">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className={`p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mt-2 space-y-2 w-full">
                    {msg.toolCalls.map((tc, idx) => (
                      <div key={idx} className="bg-zinc-950 border border-zinc-800 p-2 rounded-lg font-mono text-xs w-full max-w-full overflow-hidden">
                        <div className="flex items-center gap-2 text-indigo-400 mb-1">
                          <Terminal className="w-3 h-3" />
                          {tc.name}
                        </div>
                        <div className="text-zinc-500 break-all">{tc.args}</div>
                        {tc.result && (
                          <div className="mt-2 pt-2 border-t border-zinc-900 text-zinc-400 break-all">
                            {tc.result}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-950 rounded-b-xl shrink-0">
            <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2 focus-within:border-indigo-500 transition">
              <button className="p-2 flex-shrink-0 text-zinc-400 hover:text-zinc-200 transition">
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea 
                placeholder="Assign a task to the active agent..."
                className="flex-1 bg-transparent border-none focus:outline-none text-zinc-200 text-sm resize-none max-h-32 min-h-[40px] py-2"
                rows={1}
              />
              <button className="p-2 flex-shrink-0 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition">
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-4 mt-2 px-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1 cursor-pointer hover:text-zinc-300 transition">
                <ImageIcon className="w-3 h-3" /> Include Context
              </span>
              <span>Press Enter to send, Shift+Enter for new line</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Grouped Panels */}
      <div className="w-[420px] flex-shrink-0 flex flex-col h-full min-h-0 bg-zinc-950 pt-[3.25rem]">
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
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === tab.id 
                  ? 'bg-zinc-800 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
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

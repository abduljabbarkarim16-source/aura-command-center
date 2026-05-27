import { useState } from 'react';
import { FileCode2, Copy, Maximize2, Send, Clock, UserSquare2 } from 'lucide-react';
import { mockArtifacts } from '../../mock/artifacts';

export function ArtifactPanel() {
  const [selectedId, setSelectedId] = useState<string | null>(mockArtifacts[0]?.id || null);

  const selectedArtifact = mockArtifacts.find(a => a.id === selectedId);

  return (
    <div className="flex flex-col h-[500px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <FileCode2 className="w-4 h-4 text-cyan-500" />
          Workspace Artifacts
        </div>
        <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
          {mockArtifacts.length} items
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/3 border-r border-zinc-800 overflow-y-auto bg-zinc-900/50 p-2 space-y-1">
          {mockArtifacts.map(artifact => (
            <div 
              key={artifact.id}
              onClick={() => setSelectedId(artifact.id)}
              className={`p-2 rounded cursor-pointer transition flex flex-col gap-1 ${
                selectedId === artifact.id 
                  ? 'bg-zinc-800 border-l-2 border-cyan-500' 
                  : 'hover:bg-zinc-800/50 border-l-2 border-transparent'
              }`}
            >
              <div className="text-xs font-medium text-zinc-200 truncate">{artifact.title}</div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500 font-mono uppercase tracking-wider">{artifact.type}</span>
                <span className="text-cyan-500/70 font-mono">v{artifact.version || 1}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="w-2/3 flex flex-col bg-zinc-950">
          {selectedArtifact ? (
            <>
              <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-zinc-200">{selectedArtifact.title}</span>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1">
                    <span className="flex items-center gap-1"><UserSquare2 className="w-3 h-3" /> {selectedArtifact.agentId}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> v{selectedArtifact.version || 1}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition" title="Copy Content">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition" title="Expand Fullscreen">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 hover:bg-indigo-500/20 hover:text-indigo-400 text-zinc-400 rounded transition" title="Send to Agent Context">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto text-sm text-zinc-300 font-mono whitespace-pre-wrap">
                {selectedArtifact.content || '(Mock Rendering Placeholder)'}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
              Select an artifact to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

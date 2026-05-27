import { RefreshCw, ExternalLink, Square, Play, Image as ImageIcon, Code2, RefreshCcw, SearchCode } from 'lucide-react';
import { useWorkspaceRunner } from '../../hooks/useWorkspaceRunner';

export function LocalhostPreviewPanel() {
  const runner = useWorkspaceRunner();

  return (
    <div className="flex flex-col h-[400px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${runner.status === 'running' ? 'bg-emerald-500 animate-pulse' : runner.status === 'starting' ? 'bg-amber-500 animate-pulse' : runner.status === 'failed' ? 'bg-red-500' : 'bg-zinc-600'}`} />
          <h3 className="font-medium text-sm text-white">Localhost Preview</h3>
          <span className="text-xs text-zinc-500 font-mono px-2 py-0.5 bg-zinc-950 rounded border border-zinc-800">{runner.framework}</span>
        </div>
        <div className="flex items-center gap-1">
          {runner.status === 'running' ? (
            <button onClick={runner.stopDevServer} className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition" title="Stop Server">
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={runner.startDevServer} className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition" title="Start Server">
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={runner.restartDevServer} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition" title="Restart">
            <RefreshCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={runner.refreshPreview} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition" title="Refresh Preview">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <a href="#" onClick={(e) => { e.preventDefault(); }} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition" title="Open in Browser (Mock)">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="flex-1 bg-zinc-900 flex items-center justify-center relative overflow-hidden">
        {runner.status === 'running' ? (
          <div className="w-full h-full p-4 flex flex-col items-center justify-center gap-4 text-center">
             <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
               <Code2 className="w-8 h-8 text-indigo-400" />
             </div>
             <div>
               <p className="text-zinc-300 font-medium mb-1">Preview Running (Mock)</p>
               <p className="text-zinc-500 text-xs font-mono">{runner.previewUrl}</p>
             </div>
             
             <div className="flex gap-2 mt-4">
                <button onClick={runner.captureScreenshot} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition">
                  <ImageIcon className="w-3.5 h-3.5" /> Capture Screenshot
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition">
                  <SearchCode className="w-3.5 h-3.5" /> Inspect Element
                </button>
             </div>
          </div>
        ) : (
          <div className="text-zinc-500 text-sm flex flex-col items-center justify-center gap-2">
            Status: <span className="uppercase font-semibold tracking-wider text-xs">{runner.status}</span>
          </div>
        )}
      </div>

      <div className="h-28 bg-zinc-950 border-t border-zinc-800 p-3 overflow-y-auto font-mono text-xs flex flex-col-reverse">
        <div className="flex flex-col gap-1">
          {runner.logs.map((log, i) => (
            <div key={i} className="text-amber-400/80 leading-relaxed">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

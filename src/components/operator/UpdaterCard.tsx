import { useEffect, useState } from 'react';
import { DownloadCloud, CheckCircle2, AlertCircle, RefreshCw, Loader2, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { updaterService, type UpdaterState } from '../../services/updater/UpdaterService';

export function UpdaterCard() {
  const [state, setState] = useState<UpdaterState>({
    status: 'idle',
    currentVersion: null,
    newVersion: null,
    releaseNotes: null,
    progress: 0,
    errorMsg: null,
  });

  useEffect(() => {
    return updaterService.subscribe(setState);
  }, []);

  const handleCheck = () => {
    updaterService.checkForUpdate();
  };

  const handleInstall = () => {
    updaterService.downloadAndInstall();
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl overflow-hidden mt-4">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DownloadCloud className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-[14px] font-semibold text-zinc-200">System Updates</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Tauri Live Updater
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {state.status === 'idle' || state.status === 'error' || state.status === 'up-to-date' ? (
            <button
              onClick={handleCheck}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium rounded transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check for Update
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Status display */}
        {state.status === 'checking' && (
          <div className="flex items-center gap-2 text-zinc-400 text-[12px]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking GitHub Releases...
          </div>
        )}

        {state.status === 'up-to-date' && (
          <div className="flex items-center gap-2 text-emerald-400 text-[12px]">
            <CheckCircle2 className="w-4 h-4" />
            AURA is up to date. {state.currentVersion && `(v${state.currentVersion})`}
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex items-start gap-2 text-rose-400 text-[12px] bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Update check failed</p>
              <p className="text-rose-400/80 mt-1">{state.errorMsg}</p>
            </div>
          </div>
        )}

        {(state.status === 'available' || state.status === 'downloading' || state.status === 'installing') && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-indigo-300 text-[13px] font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Update Available
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Version {state.newVersion} is ready to install (Current: v{state.currentVersion || '?'})
                </p>
              </div>
              {state.status === 'available' && (
                <button
                  onClick={handleInstall}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-medium rounded-lg shadow-lg shadow-indigo-900/20 transition-all"
                >
                  Download & Install
                </button>
              )}
            </div>

            {state.releaseNotes && (
              <div className="mt-3 bg-zinc-950/50 rounded-lg p-3 border border-zinc-800/50">
                <p className="text-[10px] text-zinc-500 font-semibold mb-1 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3 h-3" /> Release Notes
                </p>
                <div className="text-[11px] text-zinc-300 whitespace-pre-wrap font-mono">
                  {state.releaseNotes}
                </div>
              </div>
            )}

            {(state.status === 'downloading' || state.status === 'installing') && (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-indigo-300 font-medium mb-1.5">
                  <span>{state.status === 'downloading' ? 'Downloading...' : 'Installing update...'}</span>
                  <span>{state.progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full bg-indigo-500 transition-all duration-300 ease-out",
                      state.status === 'installing' ? 'w-full animate-pulse' : ''
                    )}
                    style={{ width: state.status === 'installing' ? '100%' : `${state.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

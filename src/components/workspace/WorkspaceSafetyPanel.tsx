import { useState } from 'react';
import { mockSafetyConfig } from '../../mock/workspaces';
import { ShieldAlert, ShieldCheck, Lock, Unlock, FileWarning } from 'lucide-react';

export function WorkspaceSafetyPanel() {
  const [config] = useState(mockSafetyConfig);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Workspace Safety
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
          Strict Mode
        </span>
      </div>

      <div className="p-4 space-y-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Destructive Commands</span>
            {config.destructiveCommandsLocked ? (
              <span className="flex items-center gap-1 text-emerald-400"><Lock className="w-3 h-3" /> Locked</span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400"><Unlock className="w-3 h-3" /> Unlocked</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">External Network</span>
            {config.externalNetworkAllowed ? (
              <span className="flex items-center gap-1 text-rose-400"><Unlock className="w-3 h-3" /> Allowed</span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400"><Lock className="w-3 h-3" /> Blocked</span>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800/50">
           <h4 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Approval Required</h4>
           <div className="grid grid-cols-2 gap-2">
             {[
               { label: 'Package Installs', val: config.packageInstallsRequireApproval },
               { label: 'Git Push', val: config.gitPushRequiresApproval },
               { label: 'Deletions', val: config.deleteOperationsRequireApproval }
             ].map(item => (
               <div key={item.label} className="flex items-center gap-2 text-zinc-300 bg-zinc-900 p-2 rounded border border-zinc-800/50">
                 {item.val ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> : <FileWarning className="w-3.5 h-3.5 text-amber-500" />}
                 <span className="text-xs">{item.label}</span>
               </div>
             ))}
           </div>
        </div>

        <div className="pt-4 border-t border-zinc-800/50">
           <h4 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">File Scope</h4>
           <div className="flex flex-wrap gap-1.5">
             {config.allowedFileScope.map(path => (
               <span key={path} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                 +{path}
               </span>
             ))}
             {config.blockedPaths.map(path => (
               <span key={path} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono">
                 -{path}
               </span>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}

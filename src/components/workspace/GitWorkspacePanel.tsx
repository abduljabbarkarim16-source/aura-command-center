import { useState } from 'react';
import { GitBranch, GitCommit, Folders, Plus, Trash2, FolderTree, History } from 'lucide-react';

export function GitWorkspacePanel() {
  const [git] = useState({
    repository: 'owner/aura-command-center',
    currentBranch: 'main',
    suggestedBranch: 'aura-agent-worktree-1',
    worktreePath: '/User/dev/aura-command-center/.worktrees/aura-agent-worktree-1',
    worktreeStatus: 'isolated',
    uncommittedChangesCount: 3,
    changedFiles: ['src/App.tsx', 'src/components/Console.tsx', 'package.json'],
    lastCommit: 'ab12cd3 - Initial commit',
    proposedCommitMessage: 'feat: apply architecture correction pass'
  });

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <GitBranch className="w-4 h-4 text-emerald-500" />
          Git Workspace
        </div>
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-xs font-medium font-mono">
          {git.repository}
        </span>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
         <div className="flex flex-col gap-3">
           <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
             <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Current Branch</div>
             <div className="font-mono text-sm text-zinc-300 flex items-center justify-between">
               <span className="flex items-center gap-2"><GitBranch className="w-3.5 h-3.5 text-zinc-500" /> {git.currentBranch}</span>
               <button className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition border border-zinc-700 flex items-center gap-1">
                 <Plus className="w-3 h-3" /> Branch
               </button>
             </div>
           </div>
           
           <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-lg">
             <div className="flex justify-between items-start mb-2">
               <div className="text-xs text-emerald-500/70 uppercase tracking-wider font-semibold">Agent Worktree</div>
               <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase">{git.worktreeStatus}</span>
             </div>
             <div className="font-mono text-sm text-emerald-400 flex flex-col gap-1 mb-3">
               <span className="flex items-center gap-2"><FolderTree className="w-3.5 h-3.5" /> {git.suggestedBranch}</span>
               <span className="text-[10px] text-zinc-500 truncate" title={git.worktreePath}>{git.worktreePath}</span>
             </div>
             <div className="flex gap-2">
               <button className="flex-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-1.5 rounded transition border border-emerald-500/20 flex items-center justify-center gap-1">
                 <FolderTree className="w-3 h-3" /> Create Worktree
               </button>
               <button className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3 rounded transition border border-rose-500/20 flex items-center justify-center">
                 <Trash2 className="w-3 h-3" />
               </button>
             </div>
           </div>
         </div>

         <div className="grid grid-cols-2 gap-3 text-sm">
           <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
             <div className="text-zinc-500 text-xs mb-1">Uncommitted</div>
             <div className="text-amber-400 font-medium text-lg">{git.uncommittedChangesCount} files</div>
           </div>
           <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex flex-col justify-center gap-2">
             <button className="flex items-center justify-center gap-2 w-full py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition rounded text-xs font-medium border border-indigo-500/20">
               <GitCommit className="w-3.5 h-3.5" /> Commit
             </button>
           </div>
         </div>

         <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
           <div className="text-zinc-500 text-xs mb-1 flex items-center gap-1"><History className="w-3 h-3" /> Last Commit</div>
           <div className="text-zinc-300 text-xs font-mono">{git.lastCommit}</div>
           <div className="text-zinc-500 text-xs mt-3 mb-1">Proposed Message</div>
           <div className="text-indigo-300/80 text-xs italic bg-zinc-950 p-2 rounded border border-zinc-800/50">"{git.proposedCommitMessage}"</div>
         </div>

         <div>
           <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2">
             <Folders className="w-3.5 h-3.5" /> Changed Files
           </div>
           <div className="space-y-1">
             {git.changedFiles.map(file => (
               <div key={file} className="text-xs font-mono text-zinc-300 bg-zinc-900 px-2 py-1.5 rounded border border-zinc-800/50 flex">
                 <span className="text-amber-500 mr-2">M</span> {file}
               </div>
             ))}
           </div>
         </div>
      </div>
    </div>
  );
}

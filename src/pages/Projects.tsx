import { mockProjects } from '../store/mockData';
import { FolderGit2, Plus } from 'lucide-react';

export function Projects() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Projects</h1>
          <p className="text-zinc-400 text-sm">Manage workspaces and connected repositories</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition">
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockProjects.map(proj => (
          <div key={proj.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition cursor-pointer flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                <FolderGit2 className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">{proj.name}</h3>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{proj.summary}</p>
              </div>
            </div>
            
            <div className="mt-auto space-y-3 pt-4 border-t border-zinc-800/50">
              <div className="text-xs font-mono text-zinc-500 truncate" title={proj.localPath}>
                {proj.localPath}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 bg-zinc-950 px-2 py-1 border border-zinc-800 rounded">
                  {proj.environmentNotes}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

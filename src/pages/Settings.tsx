import { KeyRound, ShieldAlert, Database, FolderCog } from 'lucide-react';

export function Settings() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Settings</h1>
        <p className="text-zinc-400 text-sm">Global configuration for AURA Command Center</p>
      </div>

      <div className="space-y-6">
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-medium text-white">Provider Credentials</h2>
          </div>
          <div className="p-5 space-y-4">
            {['OpenAI API Key', 'Anthropic API Key', 'Gemini API Key'].map(label => (
              <div key={label}>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">{label}</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    placeholder="sk-..." 
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    disabled
                  />
                  <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm font-medium transition disabled:opacity-50">
                    Save
                  </button>
                </div>
              </div>
            ))}
            <p className="text-xs text-amber-500/80 mt-2">
              Note: In this web MVP, API keys are strictly simulated or disabled for safety.
            </p>
          </div>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-medium text-white">Security & Permissions</h2>
          </div>
          <div className="p-5 space-y-4">
            {[
              { id: 'req-confirm', label: 'Require confirmation for filesystem writes' },
              { id: 'req-term', label: 'Require confirmation for terminal execution' },
              { id: 'iso-mem', label: 'Isolate agent memory per project' },
            ].map(setting => (
              <label key={setting.id} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center w-5 h-5">
                  <input type="checkbox" defaultChecked className="peer sr-only" />
                  <div className="w-5 h-5 bg-zinc-950 border border-zinc-700 rounded peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition"></div>
                </div>
                <span className="text-sm text-zinc-300 group-hover:text-white transition">{setting.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
            <Database className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-medium text-white">Local Storage</h2>
          </div>
          <div className="p-5 space-y-4 text-sm text-zinc-400">
            <div>
              <label className="block font-medium mb-1.5">Database Location</label>
              <div className="font-mono text-xs bg-zinc-950 border border-zinc-800 p-2 rounded">
                ~/.config/aura-command-center/app.db (simulated SQLite)
              </div>
            </div>
            <div>
              <label className="block font-medium mb-1.5">Memory Logs Directory</label>
              <div className="flex gap-2">
                 <input 
                    type="text" 
                    defaultValue="~/.config/aura-command-center/memory" 
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    disabled
                  />
                  <button className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition disabled:opacity-50">
                    <FolderCog className="w-4 h-4" />
                  </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

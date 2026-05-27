import { mockAgents, mockTasks, mockProjects } from '../store/mockData';
import { Activity, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export function Dashboard() {
  const activeProj = mockProjects[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">AURA Dashboard</h1>
        <p className="text-zinc-400 text-sm">System status and overview for {activeProj.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Agents', value: mockAgents.filter(a => a.status === 'working').length, icon: Activity, color: 'text-amber-400' },
          { label: 'Completed Tasks', value: mockTasks.filter(t => t.status === 'completed').length, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Pending Tasks', value: mockTasks.filter(t => t.status === 'pending').length, icon: Clock, color: 'text-zinc-400' },
          { label: 'Open Issues', value: 1, icon: AlertCircle, color: 'text-rose-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-zinc-400 text-sm font-medium">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <span className="text-3xl font-bold text-white mt-4">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4">Agent Status</h2>
          <div className="space-y-3">
            {mockAgents.map(agent => (
              <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800/50">
                <div>
                  <div className="font-medium text-zinc-200 text-sm">{agent.name}</div>
                  <div className="text-xs text-zinc-500">{agent.provider} | {agent.model}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${agent.status === 'working' ? 'bg-amber-400 animate-pulse' : agent.status === 'idle' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                  <span className="text-xs text-zinc-400 capitalize">{agent.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4">Recent Tasks</h2>
          <div className="space-y-3">
            {mockTasks.slice(0, 4).map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800/50">
                <div>
                  <div className="font-medium text-zinc-200 text-sm">{task.title}</div>
                  <div className="text-xs text-zinc-500">Updated {new Date(task.updatedAt).toLocaleTimeString()}</div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                  task.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-zinc-800 text-zinc-400'
                }`}>
                  {task.status.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

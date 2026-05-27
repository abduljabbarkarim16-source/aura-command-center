import { mockAgents, mockTasks, mockProjects } from '../store/mockData';
import { Activity, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { FuturePlaceholderCards } from '../components/operator/FuturePlaceholderCards';

export function Dashboard() {
  const activeProj = mockProjects[0];

  const stats = [
    { label: 'Active Agents',   value: mockAgents.filter(a => a.status === 'working').length, icon: Activity,     color: 'text-amber-400' },
    { label: 'Completed Tasks', value: mockTasks.filter(t => t.status === 'completed').length, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Pending Tasks',   value: mockTasks.filter(t => t.status === 'pending').length,   icon: Clock,        color: 'text-zinc-400' },
    { label: 'Open Issues',     value: 1,                                                       icon: AlertCircle,  color: 'text-rose-400' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Dashboard</h1>
        <p className="text-zinc-400 text-sm">System overview for <span className="text-zinc-300">{activeProj.name}</span></p>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700/80 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-zinc-500 text-[13px] font-medium">{stat.label}</span>
              <stat.icon className={`w-4.5 h-4.5 ${stat.color} flex-shrink-0`} />
            </div>
            <span className="text-3xl font-bold text-white mt-4">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* ── Agent status + Tasks ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Agent Status */}
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
          <h2 className="text-[15px] font-semibold text-zinc-200 mb-4">Agent Status</h2>
          <div className="space-y-2.5">
            {mockAgents.map(agent => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/40 hover:border-zinc-700/60 transition-colors"
              >
                <div>
                  <div className="font-medium text-zinc-200 text-[14px]">{agent.name}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{agent.provider} · {agent.model}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    agent.status === 'working' ? 'bg-amber-400 animate-pulse'
                    : agent.status === 'idle'  ? 'bg-emerald-400'
                    : 'bg-rose-400'
                  }`} />
                  <span className="text-[12px] text-zinc-400 capitalize">{agent.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
          <h2 className="text-[15px] font-semibold text-zinc-200 mb-4">Recent Tasks</h2>
          <div className="space-y-2.5">
            {mockTasks.slice(0, 4).map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/40 hover:border-zinc-700/60 transition-colors"
              >
                <div className="min-w-0 pr-3">
                  <div className="font-medium text-zinc-200 text-[14px] truncate">{task.title}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Updated {new Date(task.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  task.status === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : task.status === 'in_progress'
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                  : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-500'
                }`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Roadmap (future placeholders) ──────────────────────────── */}
      <FuturePlaceholderCards />

    </div>
  );
}

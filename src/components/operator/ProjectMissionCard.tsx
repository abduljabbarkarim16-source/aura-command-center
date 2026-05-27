import React from 'react';
import {
  Activity, Bot, ChevronRight, CheckCircle2,
  AlertTriangle, Clock, PauseCircle, Circle
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'blocked' | 'draft';

export interface ProjectMission {
  id: string;
  name: string;
  status: ProjectStatus;
  mission: string;
  activeAgent?: string;
  progress: number; // 0–100
  lastAction?: string;
  nextAction?: string;
  openApprovals?: number;
  lastUpdated?: string;
  tags?: string[];
}

interface ProjectMissionCardProps {
  project: ProjectMission;
  isActive?: boolean;
  onClick?: () => void;
}

const statusConfig: Record<ProjectStatus, {
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
  progressClass: string;
}> = {
  active:    {
    label: 'Active',
    icon: <Activity className="w-3 h-3" />,
    badgeClass: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
    progressClass: 'bg-indigo-500',
  },
  paused:    {
    label: 'Paused',
    icon: <PauseCircle className="w-3 h-3" />,
    badgeClass: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
    progressClass: 'bg-amber-500',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle2 className="w-3 h-3" />,
    badgeClass: 'bg-zinc-700/40 border-zinc-700/60 text-zinc-400',
    progressClass: 'bg-emerald-500',
  },
  blocked:   {
    label: 'Blocked',
    icon: <AlertTriangle className="w-3 h-3" />,
    badgeClass: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
    progressClass: 'bg-rose-500',
  },
  draft:     {
    label: 'Draft',
    icon: <Circle className="w-3 h-3" />,
    badgeClass: 'bg-zinc-800/60 border-zinc-700/40 text-zinc-500',
    progressClass: 'bg-zinc-600',
  },
};

export function ProjectMissionCard({ project, isActive = false, onClick }: ProjectMissionCardProps) {
  const cfg = statusConfig[project.status];

  const formattedTime = project.lastUpdated
    ? new Date(project.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left group bg-zinc-900/50 border rounded-2xl p-5 transition-all duration-200 hover:border-zinc-700/80 hover:bg-zinc-900/70 hover:shadow-xl',
        isActive
          ? 'border-indigo-500/30 ring-1 ring-indigo-500/15 shadow-lg shadow-indigo-500/5'
          : 'border-zinc-800/60',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
              cfg.badgeClass
            )}>
              {cfg.icon}
              {cfg.label}
            </span>
            {project.openApprovals != null && project.openApprovals > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 border border-amber-500/25 text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {project.openApprovals} pending
              </span>
            )}
          </div>
          <h3 className={cn(
            'text-[15px] font-semibold leading-tight truncate',
            isActive ? 'text-zinc-100' : 'text-zinc-200'
          )}>
            {project.name}
          </h3>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0 mt-1" />
      </div>

      {/* Mission */}
      <p className="text-[13px] text-zinc-400 leading-relaxed mb-4 line-clamp-2">
        {project.mission}
      </p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-zinc-500 font-medium">Progress</span>
          <span className="text-[11px] font-semibold text-zinc-400">{project.progress}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', cfg.progressClass)}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Active agent */}
        <div className="flex items-center gap-2 bg-zinc-800/30 rounded-xl px-3 py-2">
          <Bot className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold">Agent</p>
            <p className="text-[13px] text-zinc-300 font-medium truncate">
              {project.activeAgent ?? 'Unassigned'}
            </p>
          </div>
        </div>

        {/* Last updated */}
        <div className="flex items-center gap-2 bg-zinc-800/30 rounded-xl px-3 py-2">
          <Clock className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold">Updated</p>
            <p className="text-[13px] text-zinc-300 font-medium truncate">
              {formattedTime ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Last / next action */}
      {(project.lastAction || project.nextAction) && (
        <div className="space-y-1.5 border-t border-zinc-800/40 pt-3">
          {project.lastAction && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold flex-shrink-0 pt-0.5 w-10">Last</span>
              <span className="text-[12px] text-zinc-500 leading-relaxed line-clamp-1">{project.lastAction}</span>
            </div>
          )}
          {project.nextAction && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-indigo-500 uppercase tracking-wide font-semibold flex-shrink-0 pt-0.5 w-10">Next</span>
              <span className="text-[12px] text-zinc-400 leading-relaxed line-clamp-1">{project.nextAction}</span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-800/30">
          {project.tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-zinc-800/60 text-zinc-500 text-[11px] rounded-full border border-zinc-700/40"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── New Project CTA card ──────────────────────────────────────────────────────

export function NewProjectCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left group bg-zinc-900/20 border border-dashed border-zinc-800/60 hover:border-indigo-500/30 hover:bg-indigo-500/5 rounded-2xl p-5 transition-all duration-200 flex flex-col items-center justify-center gap-3 min-h-[140px]"
    >
      <div className="w-10 h-10 rounded-xl bg-zinc-800/60 group-hover:bg-indigo-500/10 border border-zinc-700/40 group-hover:border-indigo-500/25 flex items-center justify-center transition-all duration-200">
        <span className="text-zinc-500 group-hover:text-indigo-400 text-xl font-light transition-colors">+</span>
      </div>
      <span className="text-[13px] text-zinc-600 group-hover:text-zinc-400 font-medium transition-colors">
        New Project
      </span>
    </button>
  );
}

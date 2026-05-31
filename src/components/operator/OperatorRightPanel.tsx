import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  ListTodo,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ScrollText,
  Settings2,
  ShieldCheck,
  Terminal,
  Trash2,
  Wrench,
  X,
  XCircle,
  Loader2,
} from 'lucide-react';
import { TerminalPanel } from './TerminalPanel';
import { RuntimeTaskHistoryPanel } from './RuntimeTaskHistoryPanel';
import { CapabilitiesPanel } from './CapabilitiesPanel';
import { MemoryPanel } from './MemoryPanel';
import { RecipePanel } from './RecipePanel';
import { AgentBridgesPanel } from './AgentBridgesPanel';
import { SelfTestPanel } from './SelfTestPanel';
import { cn } from '../../lib/utils';
import { notificationService } from '../../services/notifications/NotificationService';
import { voiceTranscriptLogService } from '../../services/voice/VoiceTranscriptLogService';
import { runtimeTaskService } from '../../services/runtime/RuntimeTaskService';
import { toolRegistryService } from '../../services/tools/ToolRegistryService';
import { incidentService, type Incident } from '../../services/testing/IncidentService';
import type { AuraNotification } from '../../types/notifications';
import { NOTIFICATION_DISPLAY } from '../../types/notifications';
import type { TranscriptLogEntry } from '../../types/transcript-log';
import type { RuntimeTask } from '../../types/runtime-task';
import type { ToolExecution } from '../../types/tools';

type TabId =
  | 'activity'
  | 'tasks'
  | 'terminal'
  | 'logs'
  | 'memory'
  | 'capabilities'
  | 'recipes'
  | 'notifications'
  | 'details';

const TABS: { id: TabId; label: string; icon: ReactNode; badge?: boolean }[] = [
  { id: 'activity',      label: 'Activity',      icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'tasks',         label: 'Tasks',         icon: <ListTodo className="w-3.5 h-3.5" /> },
  { id: 'terminal',      label: 'Terminal',      icon: <Terminal className="w-3.5 h-3.5" /> },
  { id: 'logs',          label: 'Logs',          icon: <ScrollText className="w-3.5 h-3.5" /> },
  { id: 'memory',        label: 'Memory',        icon: <Brain className="w-3.5 h-3.5" /> },
  { id: 'capabilities',  label: 'Capabilities',  icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { id: 'recipes',       label: 'Recipes',       icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-3.5 h-3.5" />, badge: true },
  { id: 'details',       label: 'Details',       icon: <Settings2 className="w-3.5 h-3.5" /> },
];

interface OperatorRightPanelProps {
  width?: number;
  defaultOpen?: boolean;
}

function formatElapsed(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function statusTone(status: RuntimeTask['status']): string {
  switch (status) {
    case 'running': return 'text-indigo-300 bg-indigo-500/10 border-indigo-500/25';
    case 'completed': return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
    case 'failed': return 'text-rose-300 bg-rose-500/10 border-rose-500/25';
    case 'blocked': return 'text-amber-300 bg-amber-500/10 border-amber-500/25';
    case 'cancelled': return 'text-zinc-400 bg-zinc-800/70 border-zinc-700/60';
    default: return 'text-zinc-400 bg-zinc-800/70 border-zinc-700/60';
  }
}

function taskIcon(task: RuntimeTask) {
  if (task.status === 'running') return <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />;
  if (task.status === 'completed') return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
  if (task.status === 'failed') return <XCircle className="w-3 h-3 text-rose-400" />;
  if (task.status === 'blocked') return <AlertTriangle className="w-3 h-3 text-amber-400" />;
  return <Clock className="w-3 h-3 text-zinc-500" />;
}

function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-28 px-5 text-center">
      <div className="text-zinc-700 mb-2">{icon}</div>
      <p className="text-[11px] font-medium text-zinc-500">{title}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-700">{detail}</p>
    </div>
  );
}

function RuntimeTaskMiniCard({ task }: { task: RuntimeTask }) {
  const lastLog = task.logs[task.logs.length - 1];
  const summary = task.summary || task.error || lastLog?.message;

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/45 px-2.5 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {taskIcon(task)}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-200">{task.title}</span>
        <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold', statusTone(task.status))}>
          {task.status}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[9px] text-zinc-600">
        <span className="font-mono">{task.type}</span>
        <span>{task.source}</span>
        {task.elapsedMs != null && <span className="ml-auto font-mono">{formatElapsed(task.elapsedMs)}</span>}
      </div>
      {summary && (
        <p className={cn(
          'mt-1 line-clamp-2 text-[10px] leading-snug',
          task.status === 'failed' ? 'text-rose-300/85' : 'text-zinc-500',
        )}>
          {summary}
        </p>
      )}
    </div>
  );
}

function ToolExecutionMiniCard({ execution }: { execution: ToolExecution }) {
  const icon = execution.status === 'completed'
    ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
    : execution.status === 'error'
      ? <XCircle className="w-3 h-3 text-rose-400" />
      : execution.status === 'running'
        ? <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
        : <Wrench className="w-3 h-3 text-zinc-500" />;

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/45 px-2.5 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-300">{execution.toolId}</span>
        <span className="rounded border border-zinc-700/60 bg-zinc-800/60 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500">
          {execution.status}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[9px] text-zinc-600">
        <span>{execution.approvedBy ?? 'auto'}</span>
        {execution.durationMs != null && <span className="font-mono">{formatElapsed(execution.durationMs)}</span>}
        {execution.exitCode != null && <span className="ml-auto font-mono">exit {execution.exitCode}</span>}
      </div>
      {(execution.output || execution.errorSummary) && (
        <p className={cn(
          'mt-1 line-clamp-2 whitespace-pre-wrap text-[10px] leading-snug',
          execution.errorSummary ? 'text-rose-300/85' : 'text-zinc-500',
        )}>
          {(execution.errorSummary || execution.output || '').slice(0, 220)}
        </p>
      )}
    </div>
  );
}

function useRuntimeTasks() {
  const [tasks, setTasks] = useState<RuntimeTask[]>(() => runtimeTaskService.listRecent());
  useEffect(() => runtimeTaskService.subscribe(() => setTasks(runtimeTaskService.listRecent())), []);
  return tasks;
}

function useToolExecutions() {
  const [executions, setExecutions] = useState<ToolExecution[]>(() => toolRegistryService.getExecutions());
  useEffect(() => toolRegistryService.subscribe(setExecutions), []);
  return executions;
}

function ActivityPanel() {
  const tasks = useRuntimeTasks();
  const executions = useToolExecutions();
  const activeTasks = tasks.filter(t => t.status === 'queued' || t.status === 'running' || t.status === 'blocked');
  const recentTasks = tasks.filter(t => !activeTasks.some(a => a.id === t.id)).slice(0, 5);

  return (
    <div className="h-full overflow-y-auto p-2 space-y-3">
      <section>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Active runtime</h3>
          {activeTasks.length > 0 && <span className="text-[9px] text-indigo-400">{activeTasks.length} active</span>}
        </div>
        <div className="space-y-1.5">
          {activeTasks.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-5 h-5" />}
              title="No active task"
              detail="Console, voice, terminal, memory, and capability work will appear here when it starts."
            />
          ) : activeTasks.map(task => <RuntimeTaskMiniCard key={task.id} task={task} />)}
        </div>
      </section>

      <section>
        <div className="mb-1.5 px-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Recent tasks</h3>
        </div>
        <div className="space-y-1.5">
          {recentTasks.length === 0 ? (
            <p className="px-2 py-2 text-[10px] text-zinc-700">No completed task history yet.</p>
          ) : recentTasks.map(task => <RuntimeTaskMiniCard key={task.id} task={task} />)}
        </div>
      </section>

      <section>
        <div className="mb-1.5 px-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Tool activity</h3>
        </div>
        <div className="space-y-1.5">
          {executions.length === 0 ? (
            <p className="px-2 py-2 text-[10px] text-zinc-700">No tool calls yet. Try "Check git status" from Console.</p>
          ) : executions.slice(0, 8).map(execution => <ToolExecutionMiniCard key={execution.id} execution={execution} />)}
        </div>
      </section>
    </div>
  );
}

function TerminalResultsPanel() {
  const tasks = useRuntimeTasks();
  const terminalTasks = tasks.filter(t => t.type === 'terminal' || t.type === 'cli').slice(0, 6);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="max-h-56 shrink-0 overflow-y-auto border-b border-zinc-800/60 p-2">
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <Terminal className="w-3 h-3" />
          Terminal tool results
        </div>
        {terminalTasks.length === 0 ? (
          <p className="px-2 py-2 text-[10px] text-zinc-700">No terminal or CLI RuntimeTasks yet.</p>
        ) : (
          <div className="space-y-1.5">
            {terminalTasks.map(task => <RuntimeTaskMiniCard key={task.id} task={task} />)}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <TerminalPanel />
      </div>
    </div>
  );
}

function LogsPanel() {
  const executions = useToolExecutions();
  const [incidents, setIncidents] = useState<Incident[]>(() => incidentService.getIncidents());

  useEffect(() => {
    const unsubscribe = incidentService.subscribe(setIncidents);
    return () => { unsubscribe(); };
  }, []);

  return (
    <div className="h-full overflow-y-auto p-2 space-y-3">
      <section>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Incidents</h3>
          {incidents.length > 0 && (
            <button
              onClick={() => incidentService.clear()}
              className="text-[10px] text-zinc-600 hover:text-rose-400"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {incidents.length === 0 ? (
            <p className="px-2 py-2 text-[10px] text-zinc-700">No tool-dispatch incidents recorded in this session.</p>
          ) : incidents.map(incident => (
            <div key={incident.id} className="rounded-lg border border-zinc-800/60 bg-zinc-900/45 px-2.5 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn('w-3 h-3', incident.severity === 'error' ? 'text-rose-400' : 'text-amber-400')} />
                <span className="flex-1 truncate text-[11px] font-medium text-zinc-200">{incident.type}</span>
                <span className="text-[9px] text-zinc-600">{new Date(incident.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-zinc-500">{incident.message}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1.5 px-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Tool execution log</h3>
        </div>
        <div className="space-y-1.5">
          {executions.length === 0 ? (
            <p className="px-2 py-2 text-[10px] text-zinc-700">No tool executions recorded in this session.</p>
          ) : executions.slice(0, 20).map(execution => <ToolExecutionMiniCard key={execution.id} execution={execution} />)}
        </div>
      </section>
    </div>
  );
}

function NotificationItem({ n, onDismiss }: { n: AuraNotification; onDismiss: (id: string) => void }) {
  const cfg = NOTIFICATION_DISPLAY[n.type] ?? NOTIFICATION_DISPLAY.info;
  return (
    <div className={cn('relative flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-opacity', cfg.bg, cfg.border, n.dismissed && 'opacity-40')}>
      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', cfg.dot)} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[11px] font-semibold leading-tight', cfg.titleColor)}>{n.title}</p>
        {n.message && <p className={cn('mt-0.5 line-clamp-2 text-[10px] leading-relaxed', cfg.messageColor)}>{n.message}</p>}
        <p className="mt-1 text-[9px] text-zinc-600">{new Date(n.timestamp).toLocaleTimeString()}</p>
      </div>
      {!n.dismissed && (
        <button
          onClick={() => onDismiss(n.id)}
          className="mt-0.5 shrink-0 text-zinc-700 transition-colors hover:text-zinc-400"
          title="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function TranscriptItem({ entry }: { entry: TranscriptLogEntry }) {
  const statusColor = entry.status === 'success' ? 'text-emerald-400'
    : entry.status === 'error' ? 'text-rose-400'
      : entry.status === 'no_speech' ? 'text-amber-400'
        : 'text-zinc-500';

  return (
    <div className="space-y-1 rounded-lg border border-zinc-800/50 bg-zinc-900/60 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className={cn('text-[9px] font-semibold uppercase', statusColor)}>{entry.status}</span>
        <span className="text-[9px] text-zinc-600">{new Date(entry.timestamp).toLocaleTimeString()}</span>
      </div>
      {entry.userText && (
        <p className="text-[10px] leading-relaxed text-zinc-300">
          <span className="font-semibold text-sky-400">You </span>
          {entry.userText.slice(0, 120)}{entry.userText.length > 120 ? '...' : ''}
        </p>
      )}
      {entry.auraText && (
        <p className="text-[10px] leading-relaxed text-zinc-400">
          <span className="font-semibold text-indigo-400">AURA </span>
          {entry.auraText.slice(0, 120)}{entry.auraText.length > 120 ? '...' : ''}
        </p>
      )}
      {entry.errorSummary && <p className="text-[10px] text-rose-400">{entry.errorSummary}</p>}
    </div>
  );
}

function NotificationsPanel({
  notifications,
  onDismiss,
}: {
  notifications: AuraNotification[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-2 space-y-1.5">
      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-5 h-5" />}
          title="No notifications"
          detail="Voice, runtime, and tool events will appear here."
        />
      ) : notifications.map(n => (
        <Fragment key={n.id}>
          <NotificationItem n={n} onDismiss={onDismiss} />
        </Fragment>
      ))}
    </div>
  );
}

function DetailsPanel({
  transcriptEntries,
  onClearTranscripts,
  onExportTranscripts,
}: {
  transcriptEntries: TranscriptLogEntry[];
  onClearTranscripts: () => void;
  onExportTranscripts: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-2 space-y-3">
      <section>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <MessageSquare className="w-3 h-3" />
            Transcript
          </h3>
          {transcriptEntries.length > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={onExportTranscripts} title="Export JSON" className="p-1 text-zinc-700 hover:text-emerald-400">
                <Download className="w-3 h-3" />
              </button>
              <button onClick={onClearTranscripts} title="Clear history" className="p-1 text-zinc-700 hover:text-rose-400">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          {transcriptEntries.length === 0 ? (
            <p className="px-2 py-2 text-[10px] text-zinc-700">No transcript history. Enable transcript persistence in Settings to store entries.</p>
          ) : transcriptEntries.slice(0, 8).map(entry => (
            <Fragment key={entry.id}>
              <TranscriptItem entry={entry} />
            </Fragment>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <Bot className="w-3 h-3" />
          CLI bridges
        </div>
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-950/30">
          <AgentBridgesPanel />
        </div>
      </section>

      <section>
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          <Cpu className="w-3 h-3" />
          Self-test
        </div>
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-950/30">
          <SelfTestPanel />
        </div>
      </section>
    </div>
  );
}

export function OperatorRightPanel({ width = 320, defaultOpen = false }: OperatorRightPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<TabId>('activity');
  const [notifications, setNotifications] = useState<AuraNotification[]>([]);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptLogEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsub = notificationService.subscribe((all) => {
      setNotifications(all);
      setUnreadCount(all.filter(n => !n.dismissed).length);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = voiceTranscriptLogService.subscribe((store) => {
      setTranscriptEntries(store.entries.slice(0, 50));
    });
    return unsub;
  }, []);

  const handleDismiss = useCallback((id: string) => {
    notificationService.dismiss(id);
  }, []);

  const handleClearNotifications = useCallback(() => {
    notificationService.clear();
  }, []);

  const handleClearTranscripts = useCallback(() => {
    voiceTranscriptLogService.clear();
  }, []);

  const handleExportTranscripts = useCallback(() => {
    const json = voiceTranscriptLogService.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-transcript-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const activeTabDef = TABS.find(t => t.id === activeTab);

  return (
    <div className="flex h-full min-h-0">
      <div className={cn(
        'flex shrink-0 flex-col items-center border-l border-zinc-800/70 bg-zinc-950/95 transition-all',
        isOpen ? 'w-9' : 'w-11',
      )}>
        <button
          onClick={() => setIsOpen(p => !p)}
          className="flex w-full items-center justify-center border-b border-zinc-800/50 py-3 text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-200"
          title={isOpen ? 'Collapse operator panel' : 'Expand operator panel'}
        >
          {isOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
        </button>

        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (!isOpen) setIsOpen(true); }}
            title={tab.label}
            className={cn(
              'relative flex w-full items-center justify-center py-2.5 text-zinc-600 transition-colors hover:bg-zinc-800/40 hover:text-zinc-300',
              activeTab === tab.id && 'bg-zinc-800/60 text-zinc-200',
            )}
          >
            {tab.icon}
            {tab.id === 'notifications' && unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-rose-500 text-[7px] text-white">
                {unreadCount > 9 ? '!' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        className={cn(
          'flex h-full flex-col border-l border-zinc-800/40 bg-zinc-950/95 transition-all duration-200',
          isOpen ? 'min-w-0' : 'w-0 overflow-hidden',
        )}
        style={{ width: isOpen ? width : 0 }}
      >
        {isOpen && (
          <>
            <div className="shrink-0 border-b border-zinc-800/70 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
                  {activeTabDef?.icon}
                  <span className="truncate">{activeTabDef?.label}</span>
                </span>
                <div className="flex items-center gap-1">
                  {activeTab === 'notifications' && notifications.length > 0 && (
                    <button onClick={handleClearNotifications} title="Clear all" className="p-1 text-zinc-700 transition-colors hover:text-rose-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'relative flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-colors',
                      activeTab === tab.id
                        ? 'bg-zinc-800/80 text-zinc-200'
                        : 'text-zinc-600 hover:bg-zinc-900 hover:text-zinc-400',
                    )}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge && unreadCount > 0 && tab.id === 'notifications' && (
                      <span className="ml-0.5 rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {activeTab === 'activity' && <ActivityPanel />}
              {activeTab === 'tasks' && <RuntimeTaskHistoryPanel />}
              {activeTab === 'terminal' && <TerminalResultsPanel />}
              {activeTab === 'logs' && <LogsPanel />}
              {activeTab === 'memory' && <MemoryPanel />}
              {activeTab === 'capabilities' && <CapabilitiesPanel />}
              {activeTab === 'recipes' && <RecipePanel />}
              {activeTab === 'notifications' && <NotificationsPanel notifications={notifications} onDismiss={handleDismiss} />}
              {activeTab === 'details' && (
                <DetailsPanel
                  transcriptEntries={transcriptEntries}
                  onClearTranscripts={handleClearTranscripts}
                  onExportTranscripts={handleExportTranscripts}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

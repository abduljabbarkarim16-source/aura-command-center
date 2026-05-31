/**
 * OperatorRightPanel — AURA Phase 3E
 *
 * Claude/Codex-style right-side panel with collapsible tabs.
 * Tabs: Notifications · Tasks · Transcript · Planning · Terminal · Diff · Files · Logs
 *
 * Notifications and Transcript tabs are wired to live services.
 * Other tabs are clean placeholders ready for future wiring.
 */

import { Fragment, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  Bell, ListTodo, MessageSquare, Map, Terminal, GitMerge,
  FolderOpen, ScrollText, Trash2, Download,
  X, PanelRightOpen, PanelRightClose,
} from 'lucide-react';
import { TerminalPanel } from './TerminalPanel';
import { cn } from '../../lib/utils';
import { notificationService } from '../../services/notifications/NotificationService';
import { voiceTranscriptLogService } from '../../services/voice/VoiceTranscriptLogService';
import type { AuraNotification } from '../../types/notifications';
import type { TranscriptLogEntry } from '../../types/transcript-log';
import { NOTIFICATION_DISPLAY } from '../../types/notifications';

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'notifications' | 'tasks' | 'transcript' | 'planning' | 'terminal' | 'diff' | 'files' | 'logs';

const TABS: { id: TabId; label: string; icon: ReactNode; badge?: boolean }[] = [
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-3.5 h-3.5" />, badge: true },
  { id: 'tasks',         label: 'Tasks',         icon: <ListTodo className="w-3.5 h-3.5" /> },
  { id: 'transcript',    label: 'Transcript',    icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: 'planning',      label: 'Planning',      icon: <Map className="w-3.5 h-3.5" /> },
  { id: 'terminal',      label: 'Terminal',      icon: <Terminal className="w-3.5 h-3.5" /> },
  { id: 'diff',          label: 'Diff',          icon: <GitMerge className="w-3.5 h-3.5" /> },
  { id: 'files',         label: 'Files',         icon: <FolderOpen className="w-3.5 h-3.5" /> },
  { id: 'logs',          label: 'Logs',          icon: <ScrollText className="w-3.5 h-3.5" /> },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface OperatorRightPanelProps {
  width?: number;
  /** Panel is open by default */
  defaultOpen?: boolean;
}

// ─── Notification item ────────────────────────────────────────────────────────

function NotificationItem({ n, onDismiss }: { n: AuraNotification; onDismiss: (id: string) => void }) {
  const cfg = NOTIFICATION_DISPLAY[n.type] ?? NOTIFICATION_DISPLAY.info;
  return (
    <div className={cn('relative flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-opacity', cfg.bg, cfg.border, n.dismissed && 'opacity-40')}>
      <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', cfg.dot)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-[11px] font-semibold leading-tight truncate', cfg.titleColor)}>{n.title}</p>
        {n.message && <p className={cn('text-[10px] mt-0.5 leading-relaxed line-clamp-2', cfg.messageColor)}>{n.message}</p>}
        <p className="text-[9px] text-zinc-600 mt-1">{new Date(n.timestamp).toLocaleTimeString()}</p>
      </div>
      {!n.dismissed && (
        <button
          onClick={() => onDismiss(n.id)}
          className="shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors mt-0.5"
          title="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Transcript item ──────────────────────────────────────────────────────────

function TranscriptItem({ entry }: { entry: TranscriptLogEntry }) {
  const statusColor = entry.status === 'success' ? 'text-emerald-400'
    : entry.status === 'error'    ? 'text-rose-400'
    : entry.status === 'no_speech'? 'text-amber-400'
    : 'text-zinc-500';

  return (
    <div className="px-3 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50 space-y-1">
      <div className="flex items-center justify-between">
        <span className={cn('text-[9px] font-semibold uppercase', statusColor)}>{entry.status}</span>
        <span className="text-[9px] text-zinc-600">{new Date(entry.timestamp).toLocaleTimeString()}</span>
      </div>
      {entry.userText && (
        <p className="text-[10px] text-zinc-300 leading-relaxed">
          <span className="text-sky-400 font-semibold">You </span>
          {entry.userText.slice(0, 120)}{entry.userText.length > 120 ? '…' : ''}
        </p>
      )}
      {entry.auraText && (
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          <span className="text-indigo-400 font-semibold">AURA </span>
          {entry.auraText.slice(0, 120)}{entry.auraText.length > 120 ? '…' : ''}
        </p>
      )}
      {entry.errorSummary && (
        <p className="text-[10px] text-rose-400">{entry.errorSummary}</p>
      )}
    </div>
  );
}

// ─── Placeholder tab ──────────────────────────────────────────────────────────

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-center px-4">
      <span className="text-[11px] text-zinc-600">{label}</span>
      <span className="text-[10px] text-zinc-700 mt-1">Coming in a future phase</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OperatorRightPanel({ width = 300, defaultOpen = false }: OperatorRightPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<TabId>('notifications');
  const [notifications, setNotifications] = useState<AuraNotification[]>([]);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptLogEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Subscribe to notification service ─────────────────────────────────────
  useEffect(() => {
    const unsub = notificationService.subscribe((all) => {
      setNotifications(all);
      setUnreadCount(all.filter(n => !n.dismissed).length);
    });
    return unsub;
  }, []);

  // ── Subscribe to transcript log service ───────────────────────────────────
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
    <div className="flex h-full">
      {/* ── Collapsed icon rail — always visible ── */}
      <div className={cn(
        'flex flex-col items-center border-l border-zinc-800/70 bg-zinc-950/95 transition-all',
        isOpen ? 'w-8 shrink-0' : 'w-10 shrink-0',
      )}>
        {/* Expand/collapse toggle */}
        <button
          onClick={() => setIsOpen(p => !p)}
          className="w-full py-3 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50"
          title={isOpen ? 'Collapse panel' : 'Expand operator panel'}
        >
          {isOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
        </button>

        {/* Tab icons in collapsed state */}
        {!isOpen && TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setIsOpen(true); }}
            title={tab.label}
            className={cn(
              'relative w-full py-2.5 flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors',
              activeTab === tab.id && isOpen && 'text-zinc-200 bg-zinc-800/60',
            )}
          >
            {tab.icon}
            {tab.id === 'notifications' && unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 text-[7px] text-white flex items-center justify-center">
                {unreadCount > 9 ? '!' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Open panel content ── */}
      <div
        className={cn(
          'flex flex-col h-full bg-zinc-950/95 border-l border-zinc-800/40 transition-all duration-200',
          isOpen ? 'min-w-0' : 'w-0 overflow-hidden',
        )}
        style={{ width: isOpen ? width : 0 }}
      >

      {isOpen && (
        <>
          {/* Tab bar */}
          <div className="shrink-0 flex items-center gap-0.5 px-1.5 pt-2 pb-1 border-b border-zinc-800/70 overflow-x-auto scrollbar-none">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors',
                  activeTab === tab.id
                    ? 'bg-zinc-800/80 text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900',
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge && unreadCount > 0 && tab.id === 'notifications' && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-[8px] text-white flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab header */}
          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-800/50">
            <span className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1.5">
              {activeTabDef?.icon}
              {activeTabDef?.label}
            </span>
            <div className="flex items-center gap-1.5">
              {activeTab === 'notifications' && notifications.length > 0 && (
                <button onClick={handleClearNotifications} title="Clear all" className="p-1 text-zinc-700 hover:text-rose-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              {activeTab === 'transcript' && transcriptEntries.length > 0 && (
                <>
                  <button onClick={handleExportTranscripts} title="Export JSON" className="p-1 text-zinc-700 hover:text-emerald-400 transition-colors">
                    <Download className="w-3 h-3" />
                  </button>
                  <button onClick={handleClearTranscripts} title="Clear history" className="p-1 text-zinc-700 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === 'notifications' && (
              <div className="p-2 space-y-1.5">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-center">
                    <Bell className="w-5 h-5 text-zinc-700 mb-2" />
                    <span className="text-[11px] text-zinc-600">No notifications</span>
                  </div>
                ) : (
                  notifications.map(n => (
                    <Fragment key={n.id}>
                      <NotificationItem n={n} onDismiss={handleDismiss} />
                    </Fragment>
                  ))
                )}
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="p-3">
                <div className="flex flex-col items-center justify-center h-24 text-center">
                  <ListTodo className="w-5 h-5 text-zinc-700 mb-2" />
                  <span className="text-[11px] text-zinc-600">No active tasks</span>
                  <span className="text-[10px] text-zinc-700 mt-1">Agent tasks will appear here</span>
                </div>
              </div>
            )}

            {activeTab === 'transcript' && (
              <div className="p-2 space-y-1.5">
                {transcriptEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-center">
                    <MessageSquare className="w-5 h-5 text-zinc-700 mb-2" />
                    <span className="text-[11px] text-zinc-600">No transcript history</span>
                    <span className="text-[10px] text-zinc-700 mt-1">Enable persist transcripts in settings</span>
                  </div>
                ) : (
                  transcriptEntries.map(entry => (
                    <Fragment key={entry.id}>
                      <TranscriptItem entry={entry} />
                    </Fragment>
                  ))
                )}
              </div>
            )}

            {activeTab === 'terminal'  && <TerminalPanel />}
            {activeTab === 'planning'  && <PlaceholderTab label="Planning panel" />}
            {activeTab === 'diff'      && <PlaceholderTab label="Diff viewer" />}
            {activeTab === 'files'     && <PlaceholderTab label="File explorer" />}
            {activeTab === 'logs'      && <PlaceholderTab label="System logs" />}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import {
  Sparkles, User, AlertTriangle, GitBranch,
  ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock,
  AlertOctagon, ShieldAlert, Info, Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MessageType =
  | 'user'
  | 'assistant'
  | 'system'
  | 'agent-handoff'
  | 'approval-request'
  | 'tool-status'
  | 'typing';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ToolStatusState = 'running' | 'completed' | 'failed' | 'pending';

export interface BaseMessage {
  id: string;
  timestamp: string;
  agentId?: string;
}

export interface UserMessage extends BaseMessage {
  type: 'user';
  content: string;
}

export interface AssistantMsg extends BaseMessage {
  type: 'assistant';
  content: string;
  agentName?: string;
}

export interface SystemMessage extends BaseMessage {
  type: 'system';
  icon?: ReactNode;
  title: string;
  summary?: string;
  expandable?: boolean;
  detail?: string;
}

export interface AgentHandoffMessage extends BaseMessage {
  type: 'agent-handoff';
  sourceAgent: string;
  targetAgent: string;
  objective: string;
  handoffId?: string;
  status?: 'pending' | 'accepted' | 'completed';
}

export interface ApprovalRequestMessage extends BaseMessage {
  type: 'approval-request';
  title: string;
  summary: string;
  riskLevel: RiskLevel;
  requestedAction: string;
  sourceAgent: string;
  targetAgent?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

export interface ToolStatusMessage extends BaseMessage {
  type: 'tool-status';
  toolName: string;
  status: ToolStatusState;
  detail?: string;
  durationMs?: number;
}

export interface TypingMessage extends BaseMessage {
  type: 'typing';
  agentName?: string;
}

export type AuraMessage =
  | UserMessage
  | AssistantMsg
  | SystemMessage
  | AgentHandoffMessage
  | ApprovalRequestMessage
  | ToolStatusMessage
  | TypingMessage;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const riskConfig: Record<RiskLevel, { label: string; color: string; border: string; icon: ReactNode }> = {
  low:      { label: 'Low Risk',      color: 'text-zinc-400',   border: 'border-l-zinc-600',  icon: <Info className="w-3.5 h-3.5" /> },
  medium:   { label: 'Medium Risk',   color: 'text-amber-400',  border: 'border-l-amber-500', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  high:     { label: 'High Risk',     color: 'text-orange-400', border: 'border-l-orange-500', icon: <AlertOctagon className="w-3.5 h-3.5" /> },
  critical: { label: 'Critical Risk', color: 'text-rose-400',   border: 'border-l-rose-500',  icon: <ShieldAlert className="w-3.5 h-3.5" /> },
};

const toolStatusConfig: Record<ToolStatusState, { label: string; icon: ReactNode; color: string }> = {
  running:   { label: 'Running',   icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,     color: 'text-indigo-400' },
  completed: { label: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5" />,              color: 'text-emerald-400' },
  failed:    { label: 'Failed',    icon: <XCircle className="w-3.5 h-3.5" />,                   color: 'text-rose-400' },
  pending:   { label: 'Pending',   icon: <Clock className="w-3.5 h-3.5" />,                     color: 'text-zinc-500' },
};

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function UserBubble({ msg }: { msg: UserMessage }) {
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2 mb-1.5 px-2">
        <span className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">Operator</span>
        <span className="text-[10px] text-zinc-600 font-medium">{formatTime(msg.timestamp)}</span>
        <User className="w-3.5 h-3.5 text-zinc-600" />
      </div>
      <div className="p-4 px-5 rounded-3xl rounded-tr-sm max-w-[85%] text-[15px] leading-relaxed bg-zinc-800 text-zinc-100 shadow-sm">
        {msg.content}
      </div>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: AssistantMsg }) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 mb-1.5 px-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
          {msg.agentName || 'AURA'}
        </span>
        <span className="text-[10px] text-zinc-600 font-medium">{formatTime(msg.timestamp)}</span>
      </div>
      <div className="p-4 px-5 rounded-3xl rounded-tl-sm max-w-[85%] text-[15px] leading-relaxed bg-zinc-900/40 border border-zinc-800/60 text-zinc-300">
        {msg.content}
      </div>
    </div>
  );
}

function TypingBubble({ msg }: { msg: TypingMessage }) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 mb-1.5 px-2">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
          {msg.agentName || 'AURA'}
        </span>
      </div>
      <div className="px-5 py-4 rounded-3xl rounded-tl-sm bg-zinc-900/40 border border-zinc-800/60 flex items-center gap-1.5">
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-500 inline-block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-500 inline-block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-500 inline-block" />
      </div>
    </div>
  );
}

function SystemCard({ msg }: { msg: SystemMessage }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex justify-center my-1">
      <div className="max-w-lg w-full bg-zinc-900/30 border border-zinc-800/40 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-zinc-500 flex-shrink-0">{msg.icon ?? <Info className="w-3.5 h-3.5" />}</span>
            <span className="text-[13px] text-zinc-400 font-medium">{msg.title}</span>
            {msg.summary && !expanded && (
              <span className="text-[12px] text-zinc-600 truncate max-w-[180px]">{msg.summary}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-zinc-600">{formatTime(msg.timestamp)}</span>
            {msg.expandable && msg.detail && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
        {expanded && msg.detail && (
          <div className="mt-2.5 pt-2.5 border-t border-zinc-800/40 text-[13px] text-zinc-500 leading-relaxed">
            {msg.detail}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentHandoffCard({ msg }: { msg: AgentHandoffMessage }) {
  const statusColors = {
    pending:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    accepted:  'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };
  const s = msg.status ?? 'pending';

  return (
    <div className="flex flex-col items-start max-w-[85%]">
      <div className="flex items-center gap-2 mb-1.5 px-2">
        <GitBranch className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">Agent Handoff</span>
        <span className="text-[10px] text-zinc-600 font-medium">{formatTime(msg.timestamp)}</span>
      </div>
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl rounded-tl-sm p-4 w-full">
        {/* Route */}
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium rounded-full">
            {msg.sourceAgent}
          </span>
          <span className="text-zinc-600 text-xs">→</span>
          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium rounded-full">
            {msg.targetAgent}
          </span>
          <span className={cn('ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold border', statusColors[s])}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        </div>
        {/* Objective */}
        <p className="text-[14px] text-zinc-300 leading-relaxed">{msg.objective}</p>
        {msg.handoffId && (
          <p className="mt-2 text-[11px] text-zinc-600 font-mono">ID: {msg.handoffId}</p>
        )}
      </div>
    </div>
  );
}

function ApprovalCard({ msg }: { msg: ApprovalRequestMessage }) {
  const risk = riskConfig[msg.riskLevel];

  return (
    <div className="flex flex-col items-start max-w-[85%]">
      <div className="flex items-center gap-2 mb-1.5 px-2">
        <span className={risk.color}>{risk.icon}</span>
        <span className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">Approval Request</span>
        <span className={cn('text-[10px] font-semibold', risk.color)}>{risk.label}</span>
        <span className="text-[10px] text-zinc-600 font-medium">{formatTime(msg.timestamp)}</span>
      </div>
      <div className={cn(
        'bg-zinc-900/40 border border-zinc-800/60 border-l-2 rounded-2xl rounded-tl-sm p-4 w-full',
        risk.border
      )}>
        <p className="text-[15px] font-semibold text-zinc-200 mb-1">{msg.title}</p>
        <p className="text-[14px] text-zinc-400 mb-3 leading-relaxed">{msg.summary}</p>
        {/* Route */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px] text-zinc-500">Action:</span>
          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs font-medium rounded-md font-mono">
            {msg.requestedAction}
          </span>
          {msg.targetAgent && (
            <>
              <span className="text-zinc-600 text-xs">via</span>
              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-full">
                {msg.targetAgent}
              </span>
            </>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={msg.onApprove}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-sm font-medium rounded-lg transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </button>
          <button
            onClick={msg.onReject}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 text-sm font-medium rounded-lg transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolStatusStrip({ msg }: { msg: ToolStatusMessage }) {
  const s = toolStatusConfig[msg.status];
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2.5 px-3.5 py-2 bg-zinc-900/40 border border-zinc-800/40 rounded-xl text-[13px]">
        <span className={s.color}>{s.icon}</span>
        <span className="text-zinc-400 font-medium">{msg.toolName}</span>
        <span className={cn('font-semibold', s.color)}>{s.label}</span>
        {msg.detail && <span className="text-zinc-600">— {msg.detail}</span>}
        {msg.durationMs != null && (
          <span className="text-zinc-600 ml-1">{(msg.durationMs / 1000).toFixed(2)}s</span>
        )}
        <span className="text-[10px] text-zinc-700 ml-1">{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function AssistantMessage({ msg }: { msg: AuraMessage }) {
  switch (msg.type) {
    case 'user':             return <UserBubble msg={msg} />;
    case 'assistant':        return <AssistantBubble msg={msg} />;
    case 'typing':           return <TypingBubble msg={msg} />;
    case 'system':           return <SystemCard msg={msg} />;
    case 'agent-handoff':    return <AgentHandoffCard msg={msg} />;
    case 'approval-request': return <ApprovalCard msg={msg} />;
    case 'tool-status':      return <ToolStatusStrip msg={msg} />;
    default:                 return null;
  }
}

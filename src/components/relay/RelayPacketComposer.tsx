import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type {
  RelaySourceType,
  RelayTargetType,
  RelayPacketType,
  RelayPacket,
} from '../../types/relay';

interface Props {
  onGenerate: (partial: Omit<RelayPacket, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'auditTrail'>) => void;
}

const SOURCE_OPTIONS: { value: RelaySourceType; label: string }[] = [
  { value: 'claude',       label: 'Claude (Anthropic)' },
  { value: 'codex',        label: 'Codex (OpenAI)' },
  { value: 'antigravity',  label: 'Antigravity' },
  { value: 'gemini',       label: 'Gemini (Google)' },
  { value: 'chatgpt',      label: 'ChatGPT' },
  { value: 'manual',       label: 'Manual / Admin' },
  { value: 'system',       label: 'System / AURA' },
];

const TARGET_OPTIONS: { value: RelayTargetType; label: string }[] = [
  { value: 'chatgpt',     label: 'ChatGPT (via clipboard)' },
  { value: 'claude',      label: 'Claude' },
  { value: 'codex',       label: 'Codex' },
  { value: 'antigravity', label: 'Antigravity' },
  { value: 'gemini',      label: 'Gemini' },
  { value: 'manual',      label: 'Manual Review' },
];

const PACKET_TYPE_OPTIONS: { value: RelayPacketType; label: string }[] = [
  { value: 'architecture_review', label: 'Architecture Review' },
  { value: 'debugging',           label: 'Debugging' },
  { value: 'code_review',         label: 'Code Review' },
  { value: 'planning',            label: 'Planning' },
  { value: 'risk_analysis',       label: 'Risk Analysis' },
  { value: 'handoff',             label: 'Handoff' },
  { value: 'build_error',         label: 'Build Error' },
  { value: 'agent_summary',       label: 'Agent Summary' },
];

const EMPTY = {
  sourceType: 'claude' as RelaySourceType,
  sourceAgentId: '',
  targetType: 'chatgpt' as RelayTargetType,
  packetType: 'architecture_review' as RelayPacketType,
  title: '',
  objective: '',
  context: '',
  sourceOutput: '',
  constraints: '',
  requestedAnalysis: '',
  suggestedTargetAgentId: '',
};

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
      {children}{required && <span className="text-rose-400 ml-1">*</span>}
    </label>
  );
}

function SelectInput<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}

function TextAreaInput({ label, value, onChange, placeholder, rows = 3, required }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-y font-mono"
      />
    </div>
  );
}

export function RelayPacketComposer({ onGenerate }: Props) {
  const [form, setForm] = useState({ ...EMPTY });

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function isValid(): boolean {
    return Boolean(form.title && form.objective && form.sourceOutput && form.requestedAnalysis);
  }

  function handleGenerate() {
    if (!isValid()) return;
    onGenerate({ ...form });
    setForm({ ...EMPTY });
  }

  return (
    <div className="space-y-5">
      {/* Row: source / target / type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SelectInput
          label="Source Agent"
          value={form.sourceType}
          options={SOURCE_OPTIONS}
          onChange={v => set('sourceType', v)}
        />
        <SelectInput
          label="Target Reasoning Assistant"
          value={form.targetType}
          options={TARGET_OPTIONS}
          onChange={v => set('targetType', v)}
        />
        <SelectInput
          label="Packet Type"
          value={form.packetType}
          options={PACKET_TYPE_OPTIONS}
          onChange={v => set('packetType', v)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Title"
          value={form.title}
          onChange={v => set('title', v)}
          placeholder="e.g. Tauri build error — link.exe missing"
        />
        <TextInput
          label="Source Agent ID (optional)"
          value={form.sourceAgentId}
          onChange={v => set('sourceAgentId', v)}
          placeholder="e.g. agent-claude"
        />
      </div>

      <TextAreaInput
        label="Objective"
        value={form.objective}
        onChange={v => set('objective', v)}
        placeholder="What do you want to achieve with this relay?"
        required
      />

      <TextAreaInput
        label="Context"
        value={form.context}
        onChange={v => set('context', v)}
        placeholder="Current project state, recent decisions, relevant background…"
        rows={4}
      />

      <TextAreaInput
        label="Source Output (paste agent output here)"
        value={form.sourceOutput}
        onChange={v => set('sourceOutput', v)}
        placeholder="Paste the raw output from Claude, Codex, Antigravity, etc."
        rows={6}
        required
      />

      <TextAreaInput
        label="Constraints"
        value={form.constraints}
        onChange={v => set('constraints', v)}
        placeholder="Constraints the response must respect (optional)"
        rows={2}
      />

      <TextAreaInput
        label="Requested Analysis"
        value={form.requestedAnalysis}
        onChange={v => set('requestedAnalysis', v)}
        placeholder="What specific analysis or decision do you want from ChatGPT?"
        rows={3}
        required
      />

      <TextInput
        label="Suggested Routing Target Agent ID (optional)"
        value={form.suggestedTargetAgentId}
        onChange={v => set('suggestedTargetAgentId', v)}
        placeholder="Which local agent should receive the response?"
      />

      <button
        onClick={handleGenerate}
        disabled={!isValid()}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md text-sm font-semibold transition"
      >
        <Sparkles className="w-4 h-4" />
        Generate Relay Packet
      </button>

      {!isValid() && (
        <p className="text-xs text-zinc-600 text-center">
          Title, Objective, Source Output, and Requested Analysis are required.
        </p>
      )}
    </div>
  );
}

import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { ProviderCapabilityCard } from '../components/operator/ProviderCapabilityCard';
import {
  Settings2,
  Route,
  Mic,
  Layers,
  ShieldCheck,
  FolderCog,
  Cpu,
  BrainCircuit,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Bell,
  Eye,
} from 'lucide-react';
import { useState } from 'react';
import { useAppSettings } from '../hooks/useAppSettings';
import { settingsService } from '../services/settings/SettingsService';
import type { AppSettings, ProviderConfig } from '../types/settings';
import type { KeyStorageStatus } from '../types/settings';
import { MakeConnectorCard } from '../components/connectors/MakeConnectorCard';
import { SecureKeysCard } from '../components/security/SecureKeysCard';

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title, subtitle }: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
      <span className="text-zinc-400">{icon}</span>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-4 cursor-pointer group ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className="w-9 h-5 rounded-full border border-zinc-700 bg-zinc-950 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors" />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-zinc-500 peer-checked:bg-white peer-checked:translate-x-4 transition-all" />
      </div>
      <div>
        <span className="text-sm text-zinc-300 group-hover:text-white transition">{label}</span>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

function SelectField<T extends string>({
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
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 appearance-none"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  placeholder,
  value,
  onChange,
  note,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  note?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
      />
      {note && <p className="text-xs text-zinc-600 mt-1">{note}</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="w-32 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}

function KeyStatusBadge({ status }: { status: KeyStorageStatus }) {
  if (status === 'configured') {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Configured
      </span>
    );
  }
  if (status === 'unavailable') {
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" /> Not required
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> Missing
    </span>
  );
}

function CollapsibleSection({
  icon,
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        className="w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">{icon}</span>
            <div>
              <h2 className="text-base font-semibold text-white">{title}</h2>
              {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>
      {open && <div className="p-5 space-y-5">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Provider row
// ---------------------------------------------------------------------------

function ProviderRow({
  provider,
  onToggle,
}: {
  provider: ProviderConfig;
  onToggle: (enabled: boolean) => void | Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${provider.enabled ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
        <div>
          <p className="text-sm font-medium text-zinc-200">{provider.displayName}</p>
          <p className="text-xs text-zinc-500">{provider.defaultModel}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <KeyStatusBadge status={provider.keyStorageStatus} />
        <label className="relative flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={provider.enabled}
            onChange={e => onToggle(e.target.checked)}
          />
          <div className="w-9 h-5 rounded-full border border-zinc-700 bg-zinc-950 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-zinc-500 peer-checked:bg-white peer-checked:translate-x-4 transition-all" />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Settings page
// ---------------------------------------------------------------------------

export function Settings() {
  const {
    settings,
    providers,
    isLoading,
    updateSettings,
    resetSettings,
    updateProvider,
    exportSettingsJson,
  } = useAppSettings();

  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleUpdate(patch: Partial<AppSettings>) {
    await updateSettings(patch);
    showToast('Settings saved');
  }

  async function handleReset() {
    await resetSettings();
    showToast('Settings reset to defaults');
  }

  async function handleExport() {
    const json = await exportSettingsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Settings exported');
  }

  async function handleClearMemory() {
    await settingsService.clearMemoryEntries();
    showToast('Mock memory cleared');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Settings</h1>
          <p className="text-zinc-400 text-sm">Local configuration for AURA Command Center</p>
        </div>
        <span className="text-xs text-zinc-600 border border-zinc-800 px-2 py-1 rounded">
          Phase 2E · local config
        </span>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-800 border border-zinc-700 text-sm text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}

      {/* ── General ── */}
      <CollapsibleSection icon={<Settings2 className="w-5 h-5" />} title="General">
        <SelectField
          label="App Theme"
          value={settings.appTheme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
          onChange={appTheme => handleUpdate({ appTheme })}
        />
        <Toggle
          label="Enable desktop notifications"
          checked={settings.desktopNotificationsEnabled}
          onChange={desktopNotificationsEnabled => handleUpdate({ desktopNotificationsEnabled })}
        />
        <Toggle
          label="Enable telemetry"
          description="Anonymous usage data. Disabled by default."
          checked={settings.telemetryEnabled}
          onChange={telemetryEnabled => handleUpdate({ telemetryEnabled })}
        />
      </CollapsibleSection>

      {/* ── Routing ── */}
      <CollapsibleSection
        icon={<Route className="w-5 h-5" />}
        title="Routing"
        subtitle="Controls which agent handles incoming requests"
      >
        <SelectField
          label="Routing Mode"
          value={settings.routingMode}
          options={[
            { value: 'manual', label: 'Manual — you choose the agent per request' },
            { value: 'automatic', label: 'Automatic — AURA router selects agent (mock)' },
          ]}
          onChange={routingMode => handleUpdate({ routingMode })}
        />
        <TextField
          label="Default Agent ID"
          placeholder="agent-claude"
          value={settings.defaultAgentId ?? ''}
          onChange={v => handleUpdate({ defaultAgentId: v || null })}
          note="Agent used when routing mode is Manual"
        />
        <TextField
          label="Fallback Agent ID"
          placeholder="agent-codex"
          value={settings.fallbackAgentId ?? ''}
          onChange={v => handleUpdate({ fallbackAgentId: v || null })}
          note="Agent used when primary agent is unavailable"
        />
      </CollapsibleSection>

      {/* ── Voice ── */}
      <CollapsibleSection
        icon={<Mic className="w-5 h-5" />}
        title="Voice"
        subtitle="Voice input and output settings"
      >
        <Toggle
          label="Enable voice interface"
          checked={settings.voiceEnabled}
          onChange={voiceEnabled => handleUpdate({ voiceEnabled })}
        />
        <Toggle
          label="Wake word detection"
          description='Listen for "Hey AURA" (requires microphone permission)'
          checked={settings.wakeWordEnabled}
          onChange={wakeWordEnabled => handleUpdate({ wakeWordEnabled })}
          disabled={!settings.voiceEnabled}
        />
        <Toggle
          label="Text-to-speech responses"
          description="Read assistant replies aloud via local speech synthesis"
          checked={settings.textToSpeechEnabled}
          onChange={textToSpeechEnabled => handleUpdate({ textToSpeechEnabled })}
          disabled={!settings.voiceEnabled}
        />
        <Toggle
          label="Mute assistant"
          checked={settings.assistantMuted}
          onChange={assistantMuted => handleUpdate({ assistantMuted })}
        />

        {/* Voice Runtime info card — Phase 2F */}
        <div className="mx-5 mb-5 mt-1 p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40 flex items-start gap-3">
          <Cpu className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-zinc-300 mb-0.5">
              Voice Runtime — Mock Mode
            </p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Phase 2F: All voice state is managed by the local VoiceRuntimeService.
              No microphone access, no API calls. Real STT/TTS integration lands in Phase 3.
            </p>
            <p className="text-[11px] text-indigo-400/80 mt-1 font-medium">
              Mode: mock · Source: local event bus
            </p>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Artifacts ── */}
      <CollapsibleSection
        icon={<Layers className="w-5 h-5" />}
        title="Artifacts"
      >
        <Toggle
          label="Auto-open artifacts panel"
          description="Automatically show the artifacts panel when new content is generated"
          checked={settings.artifactAutoOpen}
          onChange={artifactAutoOpen => handleUpdate({ artifactAutoOpen })}
        />
      </CollapsibleSection>

      {/* ── Safety Approvals ── */}
      <CollapsibleSection
        icon={<ShieldCheck className="w-5 h-5" />}
        title="Safety Approvals"
        subtitle="Require explicit confirmation before agents perform these actions"
      >
        <Toggle
          label="Dangerous commands"
          description="rm -rf, drop table, kill, etc."
          checked={settings.requireApprovalForDangerousCommands}
          onChange={v => handleUpdate({ requireApprovalForDangerousCommands: v })}
        />
        <Toggle
          label="Package installation"
          description="npm install, pip install, cargo add, etc."
          checked={settings.requireApprovalForPackageInstall}
          onChange={v => handleUpdate({ requireApprovalForPackageInstall: v })}
        />
        <Toggle
          label="Git push"
          description="Any push to a remote repository"
          checked={settings.requireApprovalForGitPush}
          onChange={v => handleUpdate({ requireApprovalForGitPush: v })}
        />
        <Toggle
          label="External network requests"
          description="Outbound HTTP/HTTPS calls from agent tools"
          checked={settings.requireApprovalForExternalNetwork}
          onChange={v => handleUpdate({ requireApprovalForExternalNetwork: v })}
        />
      </CollapsibleSection>

      {/* ── Desktop Paths ── */}
      <CollapsibleSection
        icon={<FolderCog className="w-5 h-5" />}
        title="Desktop Paths"
        subtitle="Placeholders — real path access requires Tauri filesystem permission grant"
      >
        <TextField
          label="Local Workspace Root"
          placeholder="C:\Users\you\dev"
          value={settings.localWorkspaceRoot}
          onChange={v => handleUpdate({ localWorkspaceRoot: v })}
          note="Base directory for new project workspaces. Requires future Tauri FS scope grant."
        />
        <TextField
          label="MCP Config Path"
          placeholder="C:\Users\you\.config\aura\mcp.json"
          value={settings.mcpConfigPath}
          onChange={v => handleUpdate({ mcpConfigPath: v })}
          note="Path to user-managed MCP server config file."
        />
      </CollapsibleSection>

      {/* ── Provider Placeholders ── */}
      <CollapsibleSection
        icon={<Cpu className="w-5 h-5" />}
        title="Provider Connections"
        subtitle="API keys are never stored in localStorage — secure storage only"
      >
        <div className="space-y-0 divide-y divide-zinc-800/50">
          {providers.map(p => (
            <Fragment key={p.id}>
              <ProviderRow
                provider={p}
                onToggle={enabled => updateProvider(p.id, { enabled })}
              />
            </Fragment>
          ))}
        </div>
        <div className="mt-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-400/80">
          Provider toggles are saved locally. API keys require secure storage configuration.
          Key values are never written to local storage.
        </div>
      </CollapsibleSection>

      {/* ── Secure Keys ── */}
      <div>
        <SecureKeysCard />
      </div>

      {/* ── Memory ── */}
      <CollapsibleSection
        icon={<BrainCircuit className="w-5 h-5" />}
        title="Memory"
        subtitle="Conversation and context memory retention"
      >
        <NumberField
          label="Memory retention (days)"
          value={settings.memoryRetentionDays}
          min={1}
          max={3650}
          onChange={memoryRetentionDays => handleUpdate({ memoryRetentionDays })}
        />
        <div className="pt-2">
          <button
            onClick={handleClearMemory}
            className="flex items-center gap-2 px-3 py-2 text-sm text-rose-400 border border-rose-500/20 bg-rose-500/5 rounded-md hover:bg-rose-500/10 transition"
          >
            <Trash2 className="w-4 h-4" />
            Clear memory entries
          </button>
          <p className="text-xs text-zinc-600 mt-1.5">
            Removes all locally persisted memory entries. Cannot be undone.
          </p>
        </div>
      </CollapsibleSection>

      {/* ── Startup & Safety Mode ── */}
      <CollapsibleSection
        icon={<Eye className="w-5 h-5" />}
        title="Startup & Safety"
        subtitle="Controls how AURA behaves when it first opens"
        defaultOpen={false}
      >
        <Toggle
          label="Safe Monitor Mode"
          description="AURA observes but does not execute actions. All tool calls require explicit approval."
          checked={settings.safeMonitorMode}
          onChange={safeMonitorMode => handleUpdate({ safeMonitorMode })}
        />
        <div className="pt-1 text-xs text-zinc-600">
          Safe Monitor can also be toggled from the Voice Core or Command Palette.
        </div>
      </CollapsibleSection>

      {/* ── Notifications ── */}
      <CollapsibleSection
        icon={<Bell className="w-5 h-5" />}
        title="Notifications"
        subtitle="Control how AURA surfaces alerts and approvals"
        defaultOpen={false}
      >
        <Toggle
          label="Toast notifications"
          description="Show brief notifications in the corner for events and approvals"
          checked={settings.toastNotificationsEnabled}
          onChange={toastNotificationsEnabled => handleUpdate({ toastNotificationsEnabled })}
        />
        <SelectField
          label="Toast position"
          value={settings.toastPosition}
          options={[
            { value: 'bottom-right', label: 'Bottom right' },
            { value: 'top-right',    label: 'Top right'    },
            { value: 'bottom-left',  label: 'Bottom left'  },
            { value: 'top-left',     label: 'Top left'     },
          ]}
          onChange={toastPosition => handleUpdate({ toastPosition })}
        />
        <Toggle
          label="Keep notification history"
          description="Store recent notifications in the bell panel (in-memory, cleared on restart)"
          checked={settings.notificationHistoryEnabled}
          onChange={notificationHistoryEnabled => handleUpdate({ notificationHistoryEnabled })}
        />
        <Toggle
          label="Notification sound"
          description="Play a soft sound for high-priority notifications"
          checked={settings.notificationSoundEnabled}
          onChange={notificationSoundEnabled => handleUpdate({ notificationSoundEnabled })}
          disabled
        />
        <Toggle
          label="Show approvals as overlay"
          description="Render approval requests directly on Voice Core, not just in notification center"
          checked={settings.showApprovalsAsOverlay}
          onChange={showApprovalsAsOverlay => handleUpdate({ showApprovalsAsOverlay })}
        />
      </CollapsibleSection>

      {/* ── Provider Capability Audit ── */}
      <div>
        <ProviderCapabilityCard />
      </div>

      {/* ── Make.com Connector ── */}
      <div>
        <MakeConnectorCard />
      </div>

      {/* ── Import / Export ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <SectionHeader
          icon={<Download className="w-5 h-5" />}
          title="Import / Export"
          subtitle="Backup or restore your AURA local configuration"
        />
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition"
            >
              <Download className="w-4 h-4" /> Export JSON
            </button>
            <button
              disabled
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-md cursor-not-allowed"
              title="Import not yet available"
            >
              <Upload className="w-4 h-4" /> Import JSON
            </button>
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-400 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 rounded-md transition"
            >
              <RotateCcw className="w-4 h-4" /> Reset Defaults
            </button>
          </div>
          <p className="text-xs text-zinc-600">
            Export includes: app settings, provider metadata (no keys), and project registry.
            Memory entries can be exported separately from the Memory page.
          </p>
        </div>
      </section>
    </div>
  );
}

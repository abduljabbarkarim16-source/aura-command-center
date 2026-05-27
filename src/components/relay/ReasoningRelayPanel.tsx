/**
 * ReasoningRelayPanel — main orchestrating component for Phase 2C.
 *
 * Manages the relay state machine and renders the correct sub-panel
 * for each step of the approval-gated workflow.
 *
 * Steps:
 *   compose → review → send/import → parse → done
 */

import { useState, useEffect, useCallback, type ElementType } from 'react';
import {
  PenLine,
  Eye,
  Inbox,
  GitBranch,
  CheckCircle2,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { relayService } from '../../services/relay/RelayService';
import { RelayPacketComposer } from './RelayPacketComposer';
import { RelayPacketPreview } from './RelayPacketPreview';
import { RelayResponseImporter } from './RelayResponseImporter';
import { RelayDecisionReview } from './RelayDecisionReview';
import { RelayHistoryPanel } from './RelayHistoryPanel';
import type {
  RelayExchange,
  RelayPacket,
  RelayTargetType,
} from '../../types/relay';

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type Step = 'compose' | 'review' | 'import' | 'parse' | 'done';

function stepFor(status: string | undefined): Step {
  switch (status) {
    case 'waiting_for_admin_review': return 'review';
    case 'approved_to_send':
    case 'sent_to_chatgpt':
    case 'waiting_for_chatgpt_response': return 'import';
    case 'response_imported':
    case 'parsed':
    case 'waiting_for_route_approval':
    case 'approved_to_route': return 'parse';
    case 'routed_to_agent':
    case 'archived':
    case 'rejected': return 'done';
    default: return 'compose';
  }
}

const STEPS: { id: Step; label: string; Icon: ElementType }[] = [
  { id: 'compose', label: 'Compose',  Icon: PenLine },
  { id: 'review',  label: 'Review',   Icon: Eye },
  { id: 'import',  label: 'Import',   Icon: Inbox },
  { id: 'parse',   label: 'Route',    Icon: GitBranch },
  { id: 'done',    label: 'Done',     Icon: CheckCircle2 },
];

// ---------------------------------------------------------------------------
// Safety banner
// ---------------------------------------------------------------------------

function SafetyBanner() {
  return (
    <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
      <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-300/90">
        <strong>Safety notice:</strong> AURA only performs relay actions after explicit admin
        approval. This phase does not automate ChatGPT web access — you paste the packet
        manually and import the response yourself.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              active
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : done
                ? 'bg-zinc-800 border-zinc-700 text-emerald-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-600'
            }`}>
              <s.Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${done ? 'bg-emerald-700' : 'bg-zinc-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReasoningRelayPanel
// ---------------------------------------------------------------------------

import { RelayWorkflowCard } from './RelayWorkflowCard';

export function ReasoningRelayPanel() {
  const [exchanges, setExchanges] = useState<RelayExchange[]>([]);
  const [active, setActive] = useState<RelayExchange | null>(null);
  const [step, setStep] = useState<Step>('compose');
  const [formatted, setFormatted] = useState('');
  const [advanced, setAdvanced] = useState(false);

  const reload = useCallback(async () => {
    const all = await relayService.listRelayHistory();
    setExchanges(all);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function selectExchange(ex: RelayExchange) {
    setActive(ex);
    setStep(stepFor(ex.packet.status));
    setFormatted(relayService.formatPacketForClipboard(ex.packet));
  }

  function startNew() {
    setActive(null);
    setStep('compose');
    setFormatted('');
  }

  // ── Step handlers ─────────────────────────────────────────────────────────

  async function handleGenerate(
    partial: Omit<RelayPacket, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'auditTrail'>
  ) {
    const ex = await relayService.createRelayPacket(partial);
    const fmt = relayService.formatPacketForClipboard(ex.packet);
    setFormatted(fmt);
    setActive(ex);
    setStep('review');
    await reload();
  }

  async function handleApprove() {
    if (!active) return;
    const updated = await relayService.approveForSend(active.id);
    if (updated) { setActive(updated); setFormatted(relayService.formatPacketForClipboard(updated.packet)); }
    await reload();
  }

  async function handleReject() {
    if (!active) return;
    const updated = await relayService.rejectRelay(active.id);
    if (updated) { setActive(updated); setStep('done'); }
    await reload();
  }

  async function handleMarkSent() {
    if (!active) return;
    const updated = await relayService.markSentToTarget(active.id);
    if (updated) { setActive(updated); setStep('import'); }
    await reload();
  }

  async function handleImport(text: string) {
    if (!active) return;
    const updated = await relayService.importRelayResponse(active.id, text);
    if (updated) { setActive(updated); setStep('parse'); }
    await reload();
  }

  async function handleApproveRoute(target: RelayTargetType) {
    if (!active) return;
    const updated = await relayService.approveRoute(active.id, target);
    if (updated) setActive(updated);
    await reload();
  }

  async function handleCreateHandoff() {
    if (!active) return;
    const updated = await relayService.createHandoffFromRelay(active.id);
    if (updated) { setActive(updated); setStep('done'); }
    await reload();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 h-full">
      {/* ── Main workflow panel ─────────────────────────────────────── */}
      <div className="xl:col-span-2 space-y-4">
        <SafetyBanner />

        {/* Step header */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <StepIndicator current={step} />
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md transition"
            >
              <Plus className="w-3.5 h-3.5" /> New Relay
            </button>
          </div>

          <div className="p-5">
            <div className="flex justify-end mb-4">
              <button 
                onClick={() => setAdvanced(!advanced)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition"
              >
                {advanced ? 'Hide Advanced Edit' : 'Show Advanced Edit'}
              </button>
            </div>

            {/* Compose */}
            {step === 'compose' && (
              <RelayPacketComposer onGenerate={handleGenerate} />
            )}

            {/* Workflow Card Mode */}
            {!advanced && step !== 'compose' && active && (
              <RelayWorkflowCard 
                exchange={active}
                onApproveSend={handleApprove}
                onImportResponse={() => setStep('import')} // For import we need the text input, so we might switch to advanced implicitly or have a simplified import in the card...
                onApproveRoute={() => handleApproveRoute('antigravity' as RelayTargetType)}
                onCreateHandoff={handleCreateHandoff}
              />
            )}

            {/* Import override if in basic mode */}
            {!advanced && step === 'import' && active && (
              <RelayResponseImporter
                packet={active.packet}
                onImport={handleImport}
              />
            )}

            {/* Advanced Edit Mode */}
            {advanced && step !== 'compose' && (
              <>
                {step === 'review' && active && (
                  <RelayPacketPreview
                    packet={active.packet}
                    formatted={formatted}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onMarkSent={handleMarkSent}
                  />
                )}

                {step === 'import' && active && (
                  <RelayResponseImporter
                    packet={active.packet}
                    onImport={handleImport}
                  />
                )}

                {step === 'parse' && active && (
                  <RelayDecisionReview
                    exchange={active}
                    onApproveRoute={handleApproveRoute}
                    onCreateHandoff={handleCreateHandoff}
                  />
                )}

                {step === 'done' && active && (
                  <div className="flex flex-col items-center gap-4 py-8 text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      active.packet.status === 'rejected'
                        ? 'bg-rose-500/15'
                        : 'bg-emerald-500/15'
                    }`}>
                      <CheckCircle2 className={`w-6 h-6 ${
                        active.packet.status === 'rejected' ? 'text-rose-400' : 'text-emerald-400'
                      }`} />
                    </div>
                    <div>
                      <p className="text-white font-semibold">
                        {active.packet.status === 'rejected' ? 'Relay Rejected' : 'Relay Complete'}
                      </p>
                      <p className="text-sm text-zinc-400 mt-1">
                        {active.packet.title}
                      </p>
                    </div>
                    <button
                      onClick={startNew}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-medium transition"
                    >
                      <Plus className="w-4 h-4" /> Start New Relay
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── History panel ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Relay History</h3>
          <span className="text-xs text-zinc-600">{exchanges.length} exchange{exchanges.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 overflow-y-auto max-h-[calc(100vh-300px)]">
          <RelayHistoryPanel
            exchanges={exchanges}
            activeId={active?.id}
            onSelect={selectExchange}
          />
        </div>
      </div>
    </div>
  );
}

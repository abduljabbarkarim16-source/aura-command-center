import React from 'react';
import { Send, Download, GitBranch, ArrowRight } from 'lucide-react';
import { RelayExchange } from '../../types/relay';
import { ApprovalCard } from '../operator/ApprovalCard';

interface RelayWorkflowCardProps {
  exchange: RelayExchange;
  onApproveSend: () => void;
  onImportResponse: () => void;
  onApproveRoute: () => void;
  onCreateHandoff: () => void;
}

export function RelayWorkflowCard({
  exchange,
  onApproveSend,
  onImportResponse,
  onApproveRoute,
  onCreateHandoff
}: RelayWorkflowCardProps) {
  
  // Render based on state
  switch(exchange.packet.status) {
    case 'waiting_for_admin_review':
      return (
        <ApprovalCard 
          title="Pending Relay Dispatch"
          summary="AURA has prepared a prompt payload for an external reasoning provider."
          riskLevel="low"
          requestedAction="Approve sending payload to API"
          sourceAgent="AURA"
          targetAgent={exchange.packet.targetType}
          onApprove={onApproveSend}
          onReject={() => {}}
        />
      );
      
    case 'waiting_for_chatgpt_response':
    case 'sent_to_chatgpt':
    case 'approved_to_send':
      return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-2">
            <Download className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-medium text-zinc-100 mb-1">Waiting for Response Import</h3>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto">
              The payload was sent to {exchange.packet.targetType}. Awaiting the provider's response to be imported.
            </p>
          </div>
          <button 
            onClick={onImportResponse}
            className="inline-flex items-center justify-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Import Response
          </button>
        </div>
      );
      
    case 'parsed':
    case 'waiting_for_route_approval':
      return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <GitBranch className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-100 mb-1">Response Received & Parsed</h3>
              <p className="text-sm text-zinc-400">
                The reasoning provider returned an actionable decision. Please approve the route or create a manual handoff.
              </p>
            </div>
          </div>
          
          <div className="bg-zinc-950/50 rounded-lg p-4 text-sm border border-zinc-800/50 space-y-3">
            <div>
              <span className="text-zinc-500 block mb-1">Suggested Next Actions</span>
              <ul className="list-disc pl-4 text-zinc-300 space-y-1">
                {exchange.response && exchange.response.nextActions.length > 0 ? (
                  exchange.response.nextActions.map((action, i) => <li key={i}>{action}</li>)
                ) : (
                  <li className="text-zinc-500 italic">None specified</li>
                )}
              </ul>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onApproveRoute}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              Approve Route
              <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={onCreateHandoff}
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2.5 rounded-lg text-sm font-medium transition border border-zinc-700"
            >
              Create Handoff
            </button>
          </div>
        </div>
      );
      
    case 'archived':
    case 'routed_to_agent':
    case 'rejected':
      return (
        <ApprovalCard 
          title={`Relay ${exchange.packet.status.replace(/_/g, ' ')}`}
          summary={`This relay exchange is closed with status: ${exchange.packet.status.replace(/_/g, ' ')}.`}
          riskLevel="low"
          requestedAction="Review history"
          sourceAgent="AURA"
          targetAgent={exchange.packet.targetType}
          status={exchange.packet.status === 'rejected' ? 'rejected' : 'approved'}
        />
      );
      
    default:
      return null;
  }
}

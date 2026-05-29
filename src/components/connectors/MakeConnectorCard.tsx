import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Play, Zap, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { makeConnectorService } from '../../services/connectors/MakeConnectorService';
import { makeBlueprintService } from '../../services/connectors/MakeBlueprintService';
import type { MakeScenarioConfig, MakeConnectionStatus, MakeScenarioEvent } from '../../types/make-connector';

const LIVE_CALLS = import.meta.env.VITE_MAKE_LIVE_CALLS === 'true';

export function MakeConnectorCard() {
  const [status, setStatus] = useState<MakeConnectionStatus>(makeConnectorService.getConnectionStatus());
  const [scenarios, setScenarios] = useState<MakeScenarioConfig[]>(makeConnectorService.listScenarios());
  
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [newEvent, setNewEvent] = useState<MakeScenarioEvent>('self_build_plan_created');
  
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const unsub = makeConnectorService.subscribe(() => {
      setStatus(makeConnectorService.getConnectionStatus());
      setScenarios(makeConnectorService.listScenarios());
    });
    return unsub;
  }, []);

  const handleAdd = () => {
    const valid = makeConnectorService.validateWebhookUrl(newUrl);
    if (!valid.isValid) {
      alert(valid.error);
      return;
    }
    
    makeConnectorService.addScenario({
      name: newName || 'New Scenario',
      description: 'Webhook listener',
      webhook: {
        url: newUrl,
        maskedUrl: valid.maskedUrl,
        isValid: true
      },
      trigger: {
        events: [newEvent],
        riskLevelThreshold: 'safe'
      },
      enabled: true
    });
    
    setIsAdding(false);
    setNewUrl('');
    setNewName('');
  };

  const handleRemove = (id: string) => {
    makeConnectorService.removeScenario(id);
  };

  const handleDryRun = async (id: string, eventType: MakeScenarioEvent) => {
    const res = await makeConnectorService.triggerScenarioDryRun(id, eventType);
    setTestResult(res.message || 'Dry-run complete.');
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleLiveTest = async (id: string, eventType: MakeScenarioEvent) => {
    setTestResult('Sending to Make.com…');
    const res = await makeConnectorService.triggerScenarioLiveTest(id, eventType);
    setTestResult(res.success ? `Live test sent. Status: ${res.statusCode ?? 'ok'}` : `Failed: ${res.message}`);
    setTimeout(() => setTestResult(null), 5000);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Webhook className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-semibold text-white">Make.com Connector</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Automate external workflows via webhooks</p>
          </div>
        </div>
        <div>
          {status === 'configured' ? (
             <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
               <CheckCircle2 className="w-3 h-3" /> Configured
             </span>
          ) : status === 'not_configured' ? (
             <span className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-full">
               <AlertCircle className="w-3 h-3" /> Not configured
             </span>
          ) : (
             <span className="flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-full">
               <XCircle className="w-3 h-3" /> Disabled
             </span>
          )}
        </div>
      </div>
      
      <div className="p-5 space-y-4">
        {scenarios.length === 0 && !isAdding && (
          <div className="text-sm text-zinc-500 text-center py-4">
            No Make.com scenarios configured.
          </div>
        )}
        
        {scenarios.map(s => (
          <div key={s.id} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-white">{s.name}</span>
              <div className="flex gap-2">
                {LIVE_CALLS && (
                  <button onClick={() => handleLiveTest(s.id, s.trigger.events[0])} className="text-zinc-400 hover:text-emerald-400 p-1" title="Live Test (sends real payload)">
                    <Zap className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleDryRun(s.id, s.trigger.events[0])} className="text-zinc-400 hover:text-indigo-400 p-1" title="Dry-run Test">
                  <Play className="w-4 h-4" />
                </button>
                <button onClick={() => handleRemove(s.id)} className="text-zinc-400 hover:text-rose-400 p-1" title="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-xs text-zinc-500 flex justify-between items-center">
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">{s.trigger.events[0]}</span>
              <span className="font-mono">{s.webhook.maskedUrl}</span>
            </div>
          </div>
        ))}

        {isAdding && (
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
            <input 
              type="text" 
              placeholder="Scenario Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white"
            />
            <input 
              type="text" 
              placeholder="Webhook URL (https://hook.us1.make.com/...)"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white"
            />
            <select
              value={newEvent}
              onChange={e => setNewEvent(e.target.value as MakeScenarioEvent)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white"
            >
              <option value="self_build_plan_created">self_build_plan_created</option>
              <option value="approval_required">approval_required</option>
              <option value="build_completed">build_completed</option>
              <option value="runtime_error">runtime_error</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAdding(false)} className="text-xs text-zinc-400 hover:text-white px-2 py-1">Cancel</button>
              <button onClick={handleAdd} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md">Save</button>
            </div>
          </div>
        )}

        {!isAdding && (
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
            >
              <Plus className="w-4 h-4" /> Add Scenario
            </button>
            <button 
              onClick={() => makeBlueprintService.downloadBlueprint()}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 font-medium ml-auto"
            >
              Download Blueprint
            </button>
          </div>
        )}

        {testResult && (
          <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded">
            {testResult}
          </div>
        )}

        <div className={`mt-2 p-3 rounded-lg text-xs ${LIVE_CALLS ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400/80' : 'bg-amber-500/5 border border-amber-500/20 text-amber-400/80'}`}>
          {LIVE_CALLS
            ? <><strong>Phase 3A — Live.</strong> Real payloads are sent to Make.com. Use <Zap className="inline w-3 h-3" /> for a live test and <Play className="inline w-3 h-3" /> for a local dry-run.</>
            : <><strong>Dry-run only.</strong> Set <code>VITE_MAKE_LIVE_CALLS=true</code> in .env to enable real payloads.</>
          }
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, Trash2, Edit3, XCircle } from 'lucide-react';
import { secureKeyService } from '../../services/security/SecureKeyService';
import type { SecretKeyEntry } from '../../types/security';

export function SecureKeysCard() {
  const [entries, setEntries] = useState<SecretKeyEntry[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    const unsub = secureKeyService.subscribe(snap => {
      setEntries(snap.entries);
    });
    return unsub;
  }, []);

  const handleSave = (provider: string) => {
    const res = secureKeyService.storeKey(`${provider}-api-key`, newValue);
    if (!res.success) {
      alert(res.message); // In foundation phase, this will always alert "not implemented"
    }
    setEditingKey(null);
    setNewValue('');
  };

  const handleDelete = (provider: string) => {
    const res = secureKeyService.deleteKey(`${provider}-api-key`);
    if (!res.success) {
      alert(res.message);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-base font-semibold text-white">Secure Key Storage</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Encrypted vault for provider API keys</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
          <AlertCircle className="w-3 h-3" /> Foundation Phase
        </span>
      </div>
      
      <div className="p-5 space-y-4">
        <div className="grid gap-2">
          {entries.map(entry => (
            <div key={entry.provider} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white capitalize">{entry.provider}</span>
                  {entry.status === 'configured' ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3" /> Stored
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase tracking-wider bg-zinc-800 px-1.5 py-0.5 rounded">
                      <XCircle className="w-3 h-3" /> Missing
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingKey(entry.provider)} className="text-zinc-400 hover:text-indigo-400 p-1" title="Update Key">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(entry.provider)} className="text-zinc-400 hover:text-rose-400 p-1" title="Remove Key">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-zinc-500 font-mono">
                {entry.name}
              </div>

              {editingKey === entry.provider && (
                <div className="flex gap-2 mt-2">
                  <input 
                    type="password" 
                    placeholder="sk-..."
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                  <button onClick={() => setEditingKey(null)} className="text-xs text-zinc-400 hover:text-white px-2 py-1">Cancel</button>
                  <button onClick={() => handleSave(entry.provider)} className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-md">Save Securely</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-400/80">
          <strong>Security Note:</strong> Keys are never displayed in plaintext after saving. In the Foundation phase, key storage returns "not implemented".
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Radio, Settings2, PlaySquare } from 'lucide-react';
import { mockVoiceState } from '../../mock/voice';
import { AuraStatusOrb } from './AuraStatusOrb';
import { cn } from '../../lib/utils';

export function VoiceControlPanel() {
  const [state, setState] = useState(mockVoiceState);

  const toggleMic = () => setState(s => ({ ...s, isMicEnabled: !s.isMicEnabled }));
  const toggleMute = () => setState(s => ({ ...s, isMuted: !s.isMuted }));

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Radio className="w-4 h-4 text-indigo-400" />
          AURA Voice
        </div>
        <Settings2 className="w-4 h-4 text-zinc-500 cursor-pointer hover:text-white" />
      </div>

      <div className="flex justify-center py-4">
        <AuraStatusOrb state={state.orbState} />
      </div>

      <div className="bg-zinc-950 p-3 rounded text-xs text-zinc-400 min-h-[60px] italic">
        {state.transcriptPreview}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button 
          onClick={toggleMic}
          className={cn(
            "flex items-center justify-center gap-2 p-2 rounded text-xs font-medium transition-colors",
            state.isMicEnabled ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          )}
        >
          {state.isMicEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
          {state.isPushToTalk ? 'Push to Talk' : 'Mic Active'}
        </button>
        <button 
          onClick={toggleMute}
          className={cn(
            "flex items-center justify-center gap-2 p-2 rounded text-xs font-medium transition-colors",
            state.isMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          )}
        >
          {state.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          {state.isMuted ? 'Muted' : 'Sound On'}
        </button>
      </div>

      <div className="flex flex-col gap-2 mt-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-zinc-500">STT Provider</span>
          <span className="text-zinc-300">{state.selectedSttProvider}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500">TTS Provider</span>
          <span className="text-zinc-300">{state.selectedTtsProvider}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Voice</span>
          <span className="text-indigo-400 flex items-center gap-1 cursor-pointer">
            <PlaySquare className="w-3 h-3" /> {state.selectedVoice}
          </span>
        </div>
      </div>
    </div>
  );
}

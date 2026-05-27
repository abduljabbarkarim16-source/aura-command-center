import { cn } from '../../lib/utils';
import { AuraOrbState } from '../../types/voice';

interface AuraStatusOrbProps {
  state: AuraOrbState;
  className?: string;
}

export function AuraStatusOrb({ state, className }: AuraStatusOrbProps) {
  const stateConfig = {
    idle: { color: 'bg-zinc-500', animation: '', label: 'Idle' },
    listening: { color: 'bg-blue-500', animation: 'animate-pulse', label: 'Listening' },
    transcribing: { color: 'bg-indigo-500', animation: 'animate-bounce', label: 'Transcribing' },
    thinking: { color: 'bg-purple-500', animation: 'animate-ping', label: 'Thinking' },
    speaking: { color: 'bg-green-500', animation: 'animate-pulse', label: 'Speaking' },
    executing_tool: { color: 'bg-amber-500', animation: 'animate-spin', label: 'Executing Tool' },
    waiting_for_permission: { color: 'bg-yellow-500', animation: 'animate-bounce', label: 'Waiting for Permission' },
    switching_model: { color: 'bg-cyan-500', animation: 'animate-pulse', label: 'Switching Model' },
    error: { color: 'bg-red-500', animation: '', label: 'Error' },
  };

  const config = stateConfig[state];

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className={cn("absolute h-full w-full rounded-full opacity-75", config.color, config.animation)}></div>
        <div className={cn("relative h-8 w-8 rounded-full", config.color)}></div>
      </div>
      <span className="text-xs font-medium text-zinc-400">{config.label}</span>
    </div>
  );
}

export type AuraOrbState = 
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'executing_tool'
  | 'waiting_for_permission'
  | 'switching_model'
  | 'error';

export interface VoiceState {
  orbState: AuraOrbState;
  isMicEnabled: boolean;
  isPushToTalk: boolean;
  isWakeWordEnabled: boolean;
  isTtsEnabled: boolean;
  isMuted: boolean;
  transcriptPreview: string;
  selectedSttProvider: string;
  selectedTtsProvider: string;
  selectedVoice: string;
}

import { VoiceState } from '../types/voice';

export const mockVoiceState: VoiceState = {
  orbState: 'idle',
  isMicEnabled: false,
  isPushToTalk: true,
  isWakeWordEnabled: false,
  isTtsEnabled: true,
  isMuted: false,
  transcriptPreview: 'Listening...',
  selectedSttProvider: 'Whisper-1',
  selectedTtsProvider: 'Google Cloud TTS',
  selectedVoice: 'en-US-Journey-F'
};

export interface VisualTone {
  rgb: string;
  soft: string;
  border: string;
  text: string;
  glow: string;
}

const TONES: Record<string, VisualTone> = {
  indigo: { rgb: '99,102,241', soft: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.34)', text: '#a5b4fc', glow: 'rgba(99,102,241,0.30)' },
  cyan: { rgb: '34,211,238', soft: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.34)', text: '#67e8f9', glow: 'rgba(34,211,238,0.30)' },
  emerald: { rgb: '52,211,153', soft: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.34)', text: '#6ee7b7', glow: 'rgba(52,211,153,0.28)' },
  amber: { rgb: '251,191,36', soft: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.34)', text: '#fcd34d', glow: 'rgba(251,191,36,0.26)' },
  rose: { rgb: '244,63,94', soft: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.34)', text: '#fda4af', glow: 'rgba(244,63,94,0.28)' },
  violet: { rgb: '139,92,246', soft: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.34)', text: '#c4b5fd', glow: 'rgba(139,92,246,0.30)' },
  zinc: { rgb: '113,113,122', soft: 'rgba(113,113,122,0.12)', border: 'rgba(113,113,122,0.32)', text: '#d4d4d8', glow: 'rgba(113,113,122,0.20)' },
};

export function resolveVisualTone(color?: string): VisualTone {
  if (!color) return TONES.indigo;
  const key = color.toLowerCase().replace(/^text-|^bg-|^border-/, '').split('-')[0];
  return TONES[key] ?? TONES.indigo;
}

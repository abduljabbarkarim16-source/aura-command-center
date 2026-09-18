import type { CanvasMode } from '../../types/visual-canvas';
import { cn } from '../../lib/utils';
import { resolveVisualTone } from './visualTheme';

interface AuraOrbVisualizerProps {
  mode: CanvasMode;
  micLevel?: number;
  audioAmplitude?: number;
  isDiagramOpen?: boolean;
  themeColor?: string;
  showLabel?: boolean;
  className?: string;
}

function labelForMode(mode: CanvasMode): string {
  switch (mode) {
    case 'listening': return 'Listening';
    case 'thinking': return 'Thinking';
    case 'speaking': return 'Speaking';
    case 'working': return 'Working';
    case 'terminal': return 'Terminal';
    case 'memory': return 'Memory';
    case 'completed': return 'Complete';
    case 'failed': return 'Attention';
    case 'diagram': return 'Canvas';
    default: return 'Ready';
  }
}

function toneForMode(mode: CanvasMode, themeColor?: string): string {
  if (themeColor) return themeColor;
  switch (mode) {
    case 'listening': return 'cyan';
    case 'speaking': return 'emerald';
    case 'thinking': return 'violet';
    case 'working':
    case 'terminal': return 'amber';
    case 'memory':
    case 'completed': return 'emerald';
    case 'failed': return 'rose';
    case 'diagram': return 'zinc';
    default: return 'indigo';
  }
}

export function AuraOrbVisualizer({
  mode,
  micLevel = 0,
  audioAmplitude = 0,
  isDiagramOpen = false,
  themeColor,
  showLabel = true,
  className,
}: AuraOrbVisualizerProps) {
  const tone = resolveVisualTone(toneForMode(mode, themeColor));
  const reactiveScale = mode === 'listening'
    ? 1 + Math.min(0.52, micLevel * 0.62)
    : mode === 'speaking'
      ? 1 + Math.min(0.62, audioAmplitude * 0.72)
      : mode === 'thinking' || mode === 'working' || mode === 'terminal'
        ? 1.06
        : 1;
  const diagramScale = isDiagramOpen ? 0.58 : 1;
  const sizeClass = isDiagramOpen ? 'h-20 w-20' : 'h-32 w-32';

  return (
    <div
      className={cn(
        'pointer-events-none flex flex-col items-center gap-3 transition-transform duration-500',
        isDiagramOpen && '-translate-y-[28vh]',
        className,
      )}
    >
      <div className="relative flex h-44 w-44 items-center justify-center">
        <div
          className="absolute rounded-full blur-3xl transition-opacity duration-500"
          style={{
            width: isDiagramOpen ? 118 : 184,
            height: isDiagramOpen ? 118 : 184,
            background: tone.glow,
            opacity: mode === 'ambient' ? 0.28 : 0.58,
          }}
        />
        {(mode === 'listening' || mode === 'speaking' || mode === 'terminal') && (
          <div
            className="absolute rounded-full border opacity-70 animate-ping"
            style={{
              width: isDiagramOpen ? 94 : 156,
              height: isDiagramOpen ? 94 : 156,
              borderColor: tone.border,
              animationDuration: mode === 'terminal' ? '1.5s' : '1.05s',
            }}
          />
        )}
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full border shadow-2xl transition-all duration-300',
            sizeClass,
          )}
          style={{
            transform: `scale(${reactiveScale * diagramScale})`,
            borderColor: tone.border,
            background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.58), rgba(${tone.rgb},0.78) 30%, rgba(24,24,27,0.92) 76%)`,
            boxShadow: `inset 0 1px 1px rgba(255,255,255,0.18), inset 0 -12px 28px rgba(0,0,0,0.42), 0 0 50px ${tone.glow}`,
          }}
        >
          <div className="absolute inset-3 rounded-full border border-white/10" />
          {mode === 'thinking' || mode === 'working' || mode === 'terminal' ? (
            <div className="absolute inset-4 rounded-full border-2 border-transparent border-t-white/70 animate-spin" />
          ) : null}
          {mode === 'failed' ? (
            <span className="text-xl font-bold text-white/80">!</span>
          ) : mode === 'completed' ? (
            <span className="text-xl font-bold text-white/80">OK</span>
          ) : mode === 'listening' || mode === 'speaking' ? (
            <div className="flex items-end gap-1">
              {[0.45, 0.75, 1, 0.64, 0.38].map((factor, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-white/75"
                  style={{ height: `${10 + factor * (mode === 'listening' ? micLevel : audioAmplitude) * 34}px` }}
                />
              ))}
            </div>
          ) : (
            <span className="h-2 w-2 rounded-full bg-white/55" />
          )}
        </div>
      </div>
      {showLabel && (
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.28em] transition-colors duration-300"
          style={{ color: tone.text }}
        >
          {labelForMode(mode)}
        </span>
      )}
    </div>
  );
}

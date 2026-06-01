import type { DiagramData, DiagramNode } from '../../types/visual-canvas';
import { cn } from '../../lib/utils';
import { resolveVisualTone } from './visualTheme';

interface AuraDiagramRendererProps {
  diagram: DiagramData;
  className?: string;
}

function nodeMarker(node: DiagramNode): string {
  return node.emoji || node.icon || '';
}

function statusLabel(status?: DiagramNode['status']): string {
  switch (status) {
    case 'running': return 'Running';
    case 'completed': return 'Done';
    case 'failed': return 'Failed';
    case 'blocked': return 'Blocked';
    case 'planned': return 'Planned';
    default: return '';
  }
}

function layoutClass(layout: DiagramData['layoutMode']): string {
  switch (layout) {
    case 'list': return 'grid grid-cols-1 gap-2.5';
    case 'flow': return 'flex flex-wrap items-center justify-center gap-3';
    case 'bento': return 'grid grid-cols-1 gap-3 sm:grid-cols-6';
    default: return 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3';
  }
}

export function AuraDiagramRenderer({ diagram, className }: AuraDiagramRendererProps) {
  const theme = resolveVisualTone(diagram.themeColor);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-4 top-16 z-[2] mx-auto max-h-[calc(100%-9rem)] max-w-5xl overflow-hidden rounded-2xl border bg-zinc-950/70 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-8 sm:p-6',
        className,
      )}
      style={{ borderColor: theme.border, boxShadow: `0 24px 80px ${theme.glow}` }}
      aria-hidden="true"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Canvas diagram</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-zinc-100">{diagram.title}</h2>
          {diagram.description && (
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">{diagram.description}</p>
          )}
        </div>
        <div
          className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: theme.text, borderColor: theme.border, background: theme.soft }}
        >
          {diagram.layoutMode}
        </div>
      </div>

      <div className={layoutClass(diagram.layoutMode)}>
        {diagram.nodes.map((node, index) => {
          const tone = resolveVisualTone(node.color ?? diagram.themeColor);
          const status = statusLabel(node.status);
          const isBento = diagram.layoutMode === 'bento';
          return (
            <div
              key={node.id ?? `${node.label}-${index}`}
              className={cn(
                'relative min-w-0 rounded-xl border bg-zinc-950/55 p-3 transition-transform duration-300',
                node.animation === 'pulse' && 'animate-pulse',
                isBento && (index % 5 === 0 ? 'sm:col-span-3' : index % 3 === 0 ? 'sm:col-span-4' : 'sm:col-span-2'),
              )}
              style={{ borderColor: tone.border, background: `linear-gradient(135deg, ${tone.soft}, rgba(24,24,27,0.72))` }}
            >
              <div className="flex items-start gap-2.5">
                {nodeMarker(node) && (
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm"
                    style={{ color: tone.text, borderColor: tone.border, background: tone.soft }}
                  >
                    {nodeMarker(node)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-zinc-100">{node.label}</h3>
                    {status && (
                      <span
                        className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{ color: tone.text, borderColor: tone.border }}
                      >
                        {status}
                      </span>
                    )}
                  </div>
                  {node.detail && <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{node.detail}</p>}
                </div>
              </div>
              {diagram.layoutMode === 'flow' && index < diagram.nodes.length - 1 && (
                <div className="absolute -right-3 top-1/2 hidden h-px w-6 bg-zinc-600/60 sm:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

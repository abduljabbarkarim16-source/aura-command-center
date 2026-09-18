import { useCallback, useEffect, useRef } from 'react';
import type { CanvasMode, DiagramData } from '../../types/visual-canvas';
import { cn } from '../../lib/utils';
import { AuraDiagramRenderer } from './AuraDiagramRenderer';
import { resolveVisualTone } from './visualTheme';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  alpha: number;
}

interface AuraLiveCanvasProps {
  mode: CanvasMode;
  micLevel?: number;
  audioAmplitude?: number;
  activeDiagram?: DiagramData | null;
  themeColor?: string;
  message?: string;
  className?: string;
}

function modeTone(mode: CanvasMode, themeColor?: string): string {
  if (themeColor) return themeColor;
  switch (mode) {
    case 'listening': return 'cyan';
    case 'speaking': return 'emerald';
    case 'thinking': return 'violet';
    case 'terminal': return 'indigo';
    case 'memory': return 'emerald';
    case 'completed': return 'emerald';
    case 'failed': return 'rose';
    case 'working': return 'amber';
    default: return 'indigo';
  }
}

function spawnParticle(w: number, h: number, energy: number, mode: CanvasMode): Particle {
  const cx = w / 2;
  const cy = h / 2;
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.min(w, h) * (0.08 + Math.random() * (mode === 'ambient' ? 0.35 : 0.42));
  const speed = 0.12 + energy * 1.1 + Math.random() * 0.35;

  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 1 + Math.random() * (1.5 + energy * 3),
    life: 0,
    maxLife: 70 + Math.random() * 90,
    alpha: 0.25 + Math.random() * 0.55,
  };
}

export function AuraLiveCanvas({
  mode,
  micLevel = 0,
  audioAmplitude = 0,
  activeDiagram,
  themeColor,
  message,
  className,
}: AuraLiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const modeRef = useRef(mode);
  const micRef = useRef(micLevel);
  const ampRef = useRef(audioAmplitude);
  const themeRef = useRef(themeColor);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { micRef.current = micLevel; }, [micLevel]);
  useEffect(() => { ampRef.current = audioAmplitude; }, [audioAmplitude]);
  useEffect(() => { themeRef.current = themeColor; }, [themeColor]);

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const currentMode = modeRef.current;
    const tone = resolveVisualTone(modeTone(currentMode, themeRef.current));
    const energy = currentMode === 'listening' ? micRef.current
      : currentMode === 'speaking' ? ampRef.current
        : currentMode === 'ambient' ? 0.12
          : currentMode === 'failed' ? 0.38
            : 0.28;

    ctx.fillStyle = reducedMotion ? 'rgba(9,9,11,1)' : 'rgba(9,9,11,0.20)';
    ctx.fillRect(0, 0, w, h);

    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.75);
    gradient.addColorStop(0, `rgba(${tone.rgb},${0.12 + energy * 0.22})`);
    gradient.addColorStop(0.48, `rgba(${tone.rgb},${0.04 + energy * 0.08})`);
    gradient.addColorStop(1, 'rgba(9,9,11,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    if (!reducedMotion) {
      const spawnRate = currentMode === 'ambient' ? 1
        : currentMode === 'diagram' ? 1
          : currentMode === 'terminal' ? 4
            : 2 + Math.round(energy * 7);

      for (let i = 0; i < spawnRate; i += 1) {
        if (particlesRef.current.length < 220) particlesRef.current.push(spawnParticle(w, h, energy, currentMode));
      }

      particlesRef.current = particlesRef.current.filter(particle => {
        particle.life += 1;
        const t = particle.life / particle.maxLife;
        const fade = t < 0.12 ? t / 0.12 : t > 0.78 ? (1 - t) / 0.22 : 1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${tone.rgb},${Math.max(0, particle.alpha * fade * 0.72)})`;
        ctx.fill();

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.985;
        particle.vy *= 0.985;
        return particle.life < particle.maxLife;
      });
    }

    if (currentMode === 'thinking' || currentMode === 'working' || currentMode === 'terminal') {
      const t = Date.now() / 1400;
      const r = Math.min(w, h) * (currentMode === 'terminal' ? 0.34 : 0.26);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${tone.rgb},0.16)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(t) * r, h / 2 + Math.sin(t) * r, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${tone.rgb},0.72)`;
      ctx.fill();
    }

    if (currentMode === 'speaking' && ampRef.current > 0.03) {
      const bars = 48;
      const totalW = w * 0.56;
      const startX = (w - totalW) / 2;
      const barW = totalW / bars;
      for (let i = 0; i < bars; i += 1) {
        const wave = Math.sin(Date.now() / 90 + i * 0.55) * 0.5 + 0.5;
        const barH = (0.18 + wave * 0.82) * ampRef.current * h * 0.24;
        ctx.fillStyle = `rgba(${tone.rgb},0.30)`;
        ctx.fillRect(startX + i * barW, h / 2 - barH / 2, Math.max(1, barW - 2), barH);
      }
    }

    frameRef.current = requestAnimationFrame(draw);
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    frameRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [draw]);

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden bg-zinc-950', className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0,rgba(9,9,11,0.26)_58%,rgba(9,9,11,0.86)_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:38px_38px]" />
      {activeDiagram && <AuraDiagramRenderer diagram={activeDiagram} />}
      {message && !activeDiagram && (
        <div className="absolute left-5 top-5 rounded-full border border-zinc-800/70 bg-zinc-950/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-600 backdrop-blur">
          {message}
        </div>
      )}
    </div>
  );
}

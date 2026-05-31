/**
 * LiveCanvas — AURA Phase 3K (Canvas Layer 2)
 *
 * The reactive visual surface behind the orb (Layer 1).
 *
 * Layer model:
 *   Layer 1: orb + controls (existing AuraVoiceCore content, z-10)
 *   Layer 2: this canvas (absolute, inset-0, z-0)
 *
 * Modes:
 *   ambient   – idle, subtle particle drift, state-reactive colour field
 *   listening – audio-reactive particle burst mirroring mic level
 *   thinking  – slow orbital ring animation, indigo/violet
 *   speaking  – waveform bars driven by audio amplitude
 *   working   – task-pulse animation (amber/indigo)
 *   diagram   – diagram/drawing mode: renders preset templates or free draw
 *               pointer-events-auto so the user/AI can interact
 *
 * Audio reactivity:
 *   Accepts a `micLevel` (0-1) and `audioAmplitude` (0-1) prop that the
 *   caller provides from the voice runtime. Canvas re-draws every frame via
 *   requestAnimationFrame when active.
 *
 * Preset templates (diagram mode):
 *   'blank', 'flow', 'layers', 'network', 'timeline'
 *   AI can select a template by calling setTemplate() on the canvas ref.
 *
 * Premium + honest:
 *   - Never animates "working" when no real task exists
 *   - Idle is calm (slow drift, low opacity) — not a busy screensaver
 *   - Reduced motion: all animations disabled via prefers-reduced-motion
 */

import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export type CanvasMode = 'ambient' | 'listening' | 'thinking' | 'speaking' | 'working' | 'diagram';
export type DiagramTemplate = 'blank' | 'flow' | 'layers' | 'network' | 'timeline';

export interface LiveCanvasHandle {
  setTemplate: (t: DiagramTemplate) => void;
  clearDiagram: () => void;
  renderMarkdown: (md: string) => void;
}

interface Props {
  mode: CanvasMode;
  micLevel?: number;       // 0-1, used in listening mode
  audioAmplitude?: number; // 0-1, used in speaking mode
  template?: DiagramTemplate;
  className?: string;
}

// ── Colour palettes per mode ──────────────────────────────────────────────────

const MODE_PALETTE: Record<CanvasMode, { primary: string; secondary: string; alpha: number }> = {
  ambient:   { primary: '#6366f1', secondary: '#8b5cf6', alpha: 0.12 },
  listening: { primary: '#38bdf8', secondary: '#22d3ee', alpha: 0.30 },
  thinking:  { primary: '#818cf8', secondary: '#6366f1', alpha: 0.22 },
  speaking:  { primary: '#818cf8', secondary: '#34d399', alpha: 0.28 },
  working:   { primary: '#fbbf24', secondary: '#6366f1', alpha: 0.22 },
  diagram:   { primary: '#6366f1', secondary: '#34d399', alpha: 0.10 },
};

// ── Particle system ───────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  opacity: number;
  hue: number;
  life: number; maxLife: number;
}

function spawnParticle(w: number, h: number, mode: CanvasMode, energy: number): Particle {
  const cx = w / 2, cy = h / 2;
  const angle = Math.random() * Math.PI * 2;
  const radius = mode === 'listening' ? (0.15 + energy * 0.35) * Math.min(w, h) : Math.random() * Math.min(w, h) * 0.4;
  const speed = mode === 'listening' ? 0.5 + energy * 1.5
    : mode === 'speaking' ? 0.4 + energy * 1.2
      : mode === 'thinking' ? 0.2 + Math.random() * 0.4
        : 0.1 + Math.random() * 0.3;
  return {
    x: cx + Math.cos(angle) * radius * 0.4,
    y: cy + Math.sin(angle) * radius * 0.4,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 1.5 + Math.random() * (mode === 'listening' ? 3 * energy : 2),
    opacity: 0.4 + Math.random() * 0.5,
    hue: mode === 'listening' ? 200 + Math.random() * 30
      : mode === 'thinking' ? 240 + Math.random() * 40
        : mode === 'speaking' ? 220 + Math.random() * 80
          : mode === 'working' ? 40 + Math.random() * 20
            : 240 + Math.random() * 60,
    life: 0,
    maxLife: 40 + Math.random() * 80,
  };
}

// ── Diagram template renderers ────────────────────────────────────────────────

function drawTemplate(ctx: CanvasRenderingContext2D, w: number, h: number, t: DiagramTemplate) {
  const mid = { x: w / 2, y: h / 2 };
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(99,102,241,0.55)';
  ctx.fillStyle = 'rgba(99,102,241,0.08)';
  ctx.lineWidth = 1.5;
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(160,170,220,0.85)';

  if (t === 'blank') return;

  if (t === 'flow') {
    // Vertical flow diagram: 3 boxes connected by arrows
    const boxes = [
      { label: 'Input', y: h * 0.2 },
      { label: 'Process', y: h * 0.5 },
      { label: 'Output', y: h * 0.8 },
    ];
    const bw = 120, bh = 36;
    boxes.forEach(b => {
      const bx = mid.x - bw / 2, by = b.y - bh / 2;
      ctx.strokeStyle = 'rgba(99,102,241,0.55)';
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(99,102,241,0.07)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(200,205,255,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, mid.x, b.y + 4);
    });
    for (let i = 0; i < boxes.length - 1; i++) {
      const fromY = boxes[i].y + bh / 2;
      const toY = boxes[i + 1].y - bh / 2;
      ctx.beginPath();
      ctx.moveTo(mid.x, fromY);
      ctx.lineTo(mid.x, toY);
      ctx.strokeStyle = 'rgba(99,102,241,0.45)';
      ctx.stroke();
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(mid.x - 6, toY - 10);
      ctx.lineTo(mid.x, toY);
      ctx.lineTo(mid.x + 6, toY - 10);
      ctx.stroke();
    }
  }

  if (t === 'layers') {
    const layers = ['UI / Frontend', 'Logic / Services', 'Storage / Native'];
    const lh = 46, gap = 14;
    const totalH = layers.length * lh + (layers.length - 1) * gap;
    const startY = mid.y - totalH / 2;
    const lw = Math.min(w * 0.7, 360);
    layers.forEach((label, i) => {
      const lx = mid.x - lw / 2;
      const ly = startY + i * (lh + gap);
      ctx.strokeStyle = 'rgba(99,102,241,0.45)';
      ctx.strokeRect(lx, ly, lw, lh);
      ctx.fillStyle = `rgba(99,102,241,${0.04 + i * 0.03})`;
      ctx.fillRect(lx, ly, lw, lh);
      ctx.fillStyle = 'rgba(200,205,255,0.88)';
      ctx.textAlign = 'center';
      ctx.fillText(label, mid.x, ly + lh / 2 + 4);
    });
  }

  if (t === 'network') {
    // Central hub + surrounding nodes
    const nodes = [
      { label: 'AURA', cx: mid.x, cy: mid.y, r: 28 },
      { label: 'Claude', cx: mid.x, cy: mid.y - h * 0.3, r: 20 },
      { label: 'Codex', cx: mid.x + w * 0.28, cy: mid.y - h * 0.12, r: 20 },
      { label: 'Memory', cx: mid.x + w * 0.25, cy: mid.y + h * 0.18, r: 20 },
      { label: 'Voice', cx: mid.x - w * 0.28, cy: mid.y + h * 0.12, r: 20 },
      { label: 'Tools', cx: mid.x - w * 0.22, cy: mid.y - h * 0.22, r: 20 },
    ];
    // Draw edges first
    ctx.strokeStyle = 'rgba(99,102,241,0.30)';
    ctx.lineWidth = 1;
    for (let i = 1; i < nodes.length; i++) {
      ctx.beginPath();
      ctx.moveTo(nodes[0].cx, nodes[0].cy);
      ctx.lineTo(nodes[i].cx, nodes[i].cy);
      ctx.stroke();
    }
    // Draw nodes
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.cx, n.cy, n.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(99,102,241,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(99,102,241,0.10)';
      ctx.fill();
      ctx.fillStyle = 'rgba(200,205,255,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.cx, n.cy + 4);
    });
  }

  if (t === 'timeline') {
    const items = ['Phase 3J', 'Phase 3K', 'Phase 4 (planned)'];
    const lineY = mid.y;
    const startX = w * 0.12, endX = w * 0.88;
    ctx.beginPath();
    ctx.moveTo(startX, lineY);
    ctx.lineTo(endX, lineY);
    ctx.strokeStyle = 'rgba(99,102,241,0.40)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    items.forEach((label, i) => {
      const tx = startX + (endX - startX) * (i / (items.length - 1));
      ctx.beginPath();
      ctx.arc(tx, lineY, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < 2 ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(99,102,241,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,205,255,0.88)';
      ctx.textAlign = 'center';
      ctx.fillText(label, tx, lineY + (i % 2 === 0 ? -18 : 24));
    });
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const LiveCanvas = forwardRef<LiveCanvasHandle, Props>(function LiveCanvas(
  { mode, micLevel = 0, audioAmplitude = 0, template = 'blank', className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const modeRef = useRef(mode);
  const micRef = useRef(micLevel);
  const ampRef = useRef(audioAmplitude);
  const templateRef = useRef<DiagramTemplate>(template);
  const diagramDirtyRef = useRef(true);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { micRef.current = micLevel; }, [micLevel]);
  useEffect(() => { ampRef.current = audioAmplitude; }, [audioAmplitude]);
  useEffect(() => { templateRef.current = template; diagramDirtyRef.current = true; }, [template]);

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    setTemplate(t) { templateRef.current = t; diagramDirtyRef.current = true; },
    clearDiagram() { templateRef.current = 'blank'; diagramDirtyRef.current = true; },
    renderMarkdown() { /* future: parse + draw markdown as diagram shapes */ },
  }));

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width, h = canvas.height;
    const m = modeRef.current;
    const pal = MODE_PALETTE[m];
    const energy = m === 'listening' ? micRef.current : m === 'speaking' ? ampRef.current : 0.3;

    if (m === 'diagram') {
      if (diagramDirtyRef.current) {
        drawTemplate(ctx, w, h, templateRef.current);
        diagramDirtyRef.current = false;
      }
      frameRef.current = requestAnimationFrame(draw);
      return;
    }

    // Clear with slight trail (motion blur feel)
    ctx.fillStyle = `rgba(9,9,11,${prefersReducedMotion ? 1 : 0.18})`;
    ctx.fillRect(0, 0, w, h);

    if (prefersReducedMotion) {
      // Static gradient only
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.6);
      g.addColorStop(0, `${pal.primary}${Math.round(pal.alpha * 255).toString(16).padStart(2, '0')}`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      frameRef.current = requestAnimationFrame(draw);
      return;
    }

    // Spawn new particles based on mode + energy
    const spawnRate = m === 'listening' ? 3 + Math.round(energy * 8)
      : m === 'speaking' ? 2 + Math.round(energy * 6)
        : m === 'thinking' || m === 'working' ? 2
          : 1;
    for (let i = 0; i < spawnRate; i++) {
      if (particlesRef.current.length < 200) {
        particlesRef.current.push(spawnParticle(w, h, m, energy));
      }
    }

    // Draw + update particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.life++;
      const t = p.life / p.maxLife;
      const fade = t < 0.1 ? t * 10 : t > 0.8 ? (1 - t) * 5 : 1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue},80%,70%,${p.opacity * fade * pal.alpha * 5})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      return p.life < p.maxLife;
    });

    // Waveform bars in speaking mode
    if (m === 'speaking' && ampRef.current > 0.05) {
      const bars = 40, bw = w * 0.6 / bars, bx = w * 0.2;
      for (let i = 0; i < bars; i++) {
        const barHeight = ampRef.current * h * 0.3 * (0.3 + Math.random() * 0.7);
        ctx.fillStyle = `rgba(129,140,248,${0.25 * pal.alpha * 8})`;
        ctx.fillRect(bx + i * bw, h / 2 - barHeight / 2, bw - 1, barHeight);
      }
    }

    // Orbital ring in thinking mode
    if (m === 'thinking') {
      const t = Date.now() / 4000;
      const r = Math.min(w, h) * 0.28;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(129,140,248,${0.12})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Moving dot on ring
      const dx = w / 2 + Math.cos(t) * r;
      const dy = h / 2 + Math.sin(t) * r;
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(129,140,248,0.6)';
      ctx.fill();
    }

    frameRef.current = requestAnimationFrame(draw);
  }, [prefersReducedMotion]);

  // Start / resize RAF loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || canvas.offsetWidth;
      canvas.height = rect.height || canvas.offsetHeight;
      if (modeRef.current === 'diagram') diagramDirtyRef.current = true;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    frameRef.current = requestAnimationFrame(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'pointer-events-none absolute inset-0 z-0 h-full w-full',
        mode === 'diagram' && 'pointer-events-auto cursor-crosshair',
        className,
      )}
    />
  );
});

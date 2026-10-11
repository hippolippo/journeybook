import type { ResolvedLight } from './resolve';

export interface Ambient {
  /** Ambient (unlit) darkness colour. */
  color: string;
  /** 0–1 how dark the unlit areas get. */
  alpha: number;
}

const STOP_POS = [0, 0.2, 0.45, 0.7, 1];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function parseColor(input: string): [number, number, number] {
  const c = input.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(c);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return [255, 216, 138];
}

/** Smooth, deterministic flicker around 1 (amount 0 = steady). */
export function flickerValue(amount: number, timeSec: number): number {
  if (amount <= 0) return 1;
  const n = Math.sin(timeSec * 11.3) * 0.6 + Math.sin(timeSec * 5.1 + 1.7) * 0.4;
  return 1 + amount * n;
}

function sizeCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number, dpr: number): CanvasRenderingContext2D | null {
  const pxW = Math.max(1, Math.round(cssW * dpr));
  const pxH = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * Paint one light into the current pass. `additive` = the glow pass (uses the
 * light colour); otherwise the darkness pass (erases the ambient veil). Handles
 * omni profiles and directional cones (spot/wash) with a feathered edge.
 */
function paintLight(
  ctx: CanvasRenderingContext2D,
  light: ResolvedLight,
  cssW: number,
  cssH: number,
  timeSec: number,
  additive: boolean,
): void {
  const inten = clamp(light.intensity * flickerValue(light.flicker, timeSec), 0, 1.6);
  if (inten <= 0) return;
  const cx = light.cx * cssW;
  const cy = light.cy * cssH;
  const r = Math.max(1, light.r * cssH);
  const rgb = additive ? parseColor(light.color) : null;

  const paintCircle = () => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    light.stops.forEach((s, i) => {
      const a = clamp(s * inten, 0, 1).toFixed(4);
      g.addColorStop(STOP_POS[i], rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : `rgba(0,0,0,${a})`);
    });
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  if (!light.directional || light.angle <= 0 || light.angle >= 360) {
    paintCircle();
    return;
  }

  const dir = (light.direction * Math.PI) / 180;
  const half = (Math.min(360, light.angle) * Math.PI) / 360;
  const pen = clamp(light.penumbra, 0, 1);

  // Soft spill outside the cone, so the beam doesn't read as a hard shape.
  if (pen > 0.001) {
    ctx.save();
    ctx.globalAlpha = 0.4 * pen;
    paintCircle();
    ctx.restore();
  }
  // Feather the cone edge with a few layered wedges (core → wider/fainter).
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const alpha = 1 - t;
    if (alpha <= 0) continue;
    const h = half * (1 + pen * t);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, dir - h, dir + h);
    ctx.closePath();
    ctx.clip();
    paintCircle();
    ctx.restore();
  }
}

/**
 * Draw the two lightmap passes:
 *  - `dark` : ambient darkness with light-shaped holes (composited normally).
 *  - `glow` : additive colour pools (composited `screen`).
 * Lights accumulate inside each canvas, so overlapping/reordered lights are
 * identical (order-independent) and colours mix.
 */
export function drawLightmap(
  dark: HTMLCanvasElement,
  glow: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  dpr: number,
  lights: ResolvedLight[],
  ambient: Ambient,
  timeMs: number,
): void {
  const dctx = sizeCanvas(dark, cssW, cssH, dpr);
  const gctx = sizeCanvas(glow, cssW, cssH, dpr);
  if (!dctx || !gctx) return;

  const timeSec = timeMs / 1000;

  // --- darkness pass ---
  dctx.clearRect(0, 0, cssW, cssH);
  dctx.globalCompositeOperation = 'source-over';
  dctx.globalAlpha = clamp(ambient.alpha, 0, 1);
  dctx.fillStyle = ambient.color;
  dctx.fillRect(0, 0, cssW, cssH);
  dctx.globalAlpha = 1;
  dctx.globalCompositeOperation = 'destination-out';
  for (const light of lights) paintLight(dctx, light, cssW, cssH, timeSec, false);

  // --- glow pass ---
  gctx.clearRect(0, 0, cssW, cssH);
  gctx.globalCompositeOperation = 'lighter';
  for (const light of lights) paintLight(gctx, light, cssW, cssH, timeSec, true);
  gctx.globalCompositeOperation = 'source-over';
}

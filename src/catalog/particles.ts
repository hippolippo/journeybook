/**
 * Generic, data-driven particle system.
 *
 * A particle system is fully described by data: how many, what shape (any SVG
 * or a plain circle), where they spawn, and how they move. The engine has no
 * notion of "smoke" or "firefly" — those are just configurations. Shapes are
 * art, so new particle looks never require code.
 */
import type { AnimationDef } from './animation';
import { animationStyle } from './animation';

export interface ParticleShape {
  /** `svg` draws an SVG (tinted when `color` is set); `circle` draws a dot. */
  kind?: 'svg' | 'circle';
  /** SVG source: an asset URL, a data URL, or an `assets/svg` file name. */
  svg?: string;
  /** Tint applied via a mask; omit to render the SVG as-is. */
  color?: string;
  /** Softness in px applied to the particle. */
  blur?: number;
}

export interface ParticleSpawn {
  /** Centre of the spawn box, % of the item box (0–100). Default 50 / 4. */
  x?: number;
  y?: number;
  /** Half-size of the spawn box, % of the item box. Default 0. */
  spreadX?: number;
  spreadY?: number;
}

export interface ParticleDef {
  /** Optional name for a stable class, e.g. `fx-smoke`. */
  name?: string;
  /** Number of particles (clamped to 1–24). Default 3. */
  count?: number;
  shape?: ParticleShape;
  spawn?: ParticleSpawn;
  /** Motion over one particle's life; keyframes drive its transform/opacity. */
  motion?: AnimationDef;
  /** Lifetime in seconds. Default 3.4. */
  duration?: number;
  /** Start offset in seconds. */
  delay?: number;
  /** Seconds between successive particles. Default `duration / count`. */
  stagger?: number;
  /** Particle width as a % of the item box. Default 16. */
  size?: number;
  /** Per-particle randomisation (0–1) of delay, offset and scale. */
  jitter?: number;
  /** Opacity ceiling for each particle. Default 1. */
  opacity?: number;
  /** Optional CSS mix-blend-mode. */
  blend?: string;
}

export interface ParticleInstance {
  cls: string;
  style: Record<string, string>;
  shapeStyle: Record<string, string>;
}

/** The default motion: rise, fade in, grow, fade out (a generic "puff"). */
export const DEFAULT_PARTICLE_MOTION: AnimationDef = {
  keyframes: [
    { at: 0, opacity: 0, transform: 'translateY(0) scale(0.6)' },
    { at: 25, opacity: 0.65 },
    { at: 100, opacity: 0, transform: 'translateY(-220%) scale(1.7)' },
  ],
};

function makeRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampInt(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(value)));
}

function shapeStyle(shape: ParticleShape | undefined, opacity: number | undefined): Record<string, string> {
  const s: ParticleShape = shape ?? {};
  const style: Record<string, string> = {
    transform: 'scale(var(--p-scale, 1))',
    opacity: String(opacity ?? 1),
  };
  const url = s.svg ? `url("${s.svg}")` : undefined;
  if (s.kind === 'circle' || (!url && s.kind !== 'svg')) {
    style.background = s.color ?? 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)';
    style.borderRadius = '50%';
  } else if (url && s.color) {
    style.backgroundColor = s.color;
    style.maskImage = url;
    style.WebkitMaskImage = url;
  } else if (url) {
    style.backgroundImage = url;
  }
  if (s.blur) style.filter = `blur(${s.blur}px)`;
  return style;
}

/**
 * Expand particle definitions into concrete, per-particle instances. Jitter is
 * seeded from `seed` so instances stay stable across re-renders.
 */
export function particleInstances(defs: ParticleDef[], seed: string): ParticleInstance[] {
  const out: ParticleInstance[] = [];
  defs.forEach((def, index) => {
    const count = clampInt(def.count ?? 3, 1, 24);
    const duration = def.duration ?? 3.4;
    const stagger = def.stagger ?? duration / count;
    const size = def.size ?? 16;
    const spawn = def.spawn ?? {};
    const centerX = spawn.x ?? 50;
    const centerY = spawn.y ?? 4;
    const spreadX = spawn.spreadX ?? 0;
    const spreadY = spawn.spreadY ?? 0;
    const jitter = def.jitter ?? 0;
    const motion = def.motion ?? DEFAULT_PARTICLE_MOTION;
    const rng = makeRng(`${seed}|${def.name ?? index}`);
    for (let i = 0; i < count; i++) {
      const jx = (rng() * 2 - 1) * spreadX * jitter;
      const jy = (rng() * 2 - 1) * spreadY * jitter;
      const jd = (rng() * 2 - 1) * stagger * jitter;
      const jscale = 1 + (rng() * 2 - 1) * 0.3 * jitter;
      const style: Record<string, string> = {
        ...animationStyle({ ...motion, duration: `${duration}s` }),
        animationDelay: `${((def.delay ?? 0) + i * stagger + jd).toFixed(2)}s`,
        left: `${(centerX + jx).toFixed(2)}%`,
        top: `${(centerY + jy).toFixed(2)}%`,
        width: `${size}%`,
        height: `${size}%`,
        '--p-scale': jscale.toFixed(3),
      };
      if (def.blend) style.mixBlendMode = def.blend;
      out.push({
        cls: def.name ? `fx-${def.name}` : '',
        style,
        shapeStyle: shapeStyle(def.shape, def.opacity),
      });
    }
  });
  return out;
}

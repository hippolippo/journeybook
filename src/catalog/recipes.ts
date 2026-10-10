/**
 * Named effect recipes. These are the human-friendly `effect` values from the
 * asset guide (sway, float, flicker, twinkle, glow, smoke), expressed as plain
 * data on top of the generic animation/particle engines. Adding a new recipe is
 * data-only; the engines never learn a new "type".
 */
import type { EffectDef } from './types';
import type { AnimationDef } from './animation';
import type { ParticleDef } from './particles';

export interface ResolvedVisuals {
  animations: AnimationDef[];
  particles: ParticleDef[];
}

function secs(n: number | undefined, fallback: number): string {
  return `${n ?? fallback}s`;
}
function deg(n: number | undefined, fallback: number): string {
  return `${n ?? fallback}deg`;
}
function px(n: number | undefined, fallback: number): string {
  return `${n ?? fallback}px`;
}

function sway(e: EffectDef): AnimationDef {
  return {
    name: 'sway',
    origin: e.origin === 'top' ? '50% 0%' : '50% 100%',
    duration: secs(e.duration, 4),
    delay: e.delay != null ? secs(e.delay, 0) : undefined,
    vars: { '--fx-amp': deg(e.amplitude, 2) },
    keyframes: [
      { at: 0, transform: 'rotate(calc(var(--fx-amp) * -1))' },
      { at: 50, transform: 'rotate(var(--fx-amp))' },
      { at: 100, transform: 'rotate(calc(var(--fx-amp) * -1))' },
    ],
  };
}

function float(e: EffectDef): AnimationDef {
  return {
    name: 'float',
    duration: secs(e.duration, 5),
    delay: e.delay != null ? secs(e.delay, 0) : undefined,
    vars: { '--fx-amp': px(e.amplitude, 4) },
    keyframes: [
      { at: 0, transform: 'translateY(0)' },
      { at: 50, transform: 'translateY(calc(var(--fx-amp) * -1))' },
      { at: 100, transform: 'translateY(0)' },
    ],
  };
}

function flicker(e: EffectDef): AnimationDef {
  return {
    name: 'flicker',
    duration: secs(e.duration, 2.4),
    delay: e.delay != null ? secs(e.delay, 0) : undefined,
    timing: 'steps(1, end)',
    keyframes: [
      { at: 0, opacity: 1 },
      { at: 42, opacity: 1 },
      { at: 47, opacity: 0.6 },
      { at: 52, opacity: 1 },
      { at: 72, opacity: 0.82 },
      { at: 76, opacity: 1 },
      { at: 100, opacity: 1 },
    ],
  };
}

function twinkle(e: EffectDef): AnimationDef {
  return {
    name: 'twinkle',
    duration: secs(e.duration, 3),
    delay: e.delay != null ? secs(e.delay, 0) : undefined,
    keyframes: [
      { at: 0, opacity: 0.45 },
      { at: 50, opacity: 1 },
      { at: 100, opacity: 0.45 },
    ],
  };
}

function glow(e: EffectDef): AnimationDef {
  return {
    name: 'glow',
    nightOnly: true,
    bloom: true,
    duration: secs(e.duration, 3),
    delay: e.delay != null ? secs(e.delay, 0) : undefined,
    vars: { '--fx-color': e.color ?? '#ffd88a' },
    keyframes: [
      { at: 0, opacity: 0.6 },
      { at: 50, opacity: 1 },
      { at: 100, opacity: 0.6 },
    ],
  };
}

function smoke(e: EffectDef): ParticleDef {
  return {
    name: 'smoke',
    count: Math.max(1, Math.min(8, Math.round(e.count ?? 3))),
    duration: e.duration ?? 3.6,
    delay: e.delay,
    shape: { kind: 'circle' },
    spawn: { x: 50, y: 2 },
    size: 16,
  };
}

/** Turn legacy `effect` definitions into generic animations + particles. */
export function resolveRecipes(effects: EffectDef[], night: boolean): ResolvedVisuals {
  const animations: AnimationDef[] = [];
  const particles: ParticleDef[] = [];
  for (const e of effects) {
    switch (e.type) {
      case 'sway':
        animations.push(sway(e));
        break;
      case 'float':
        animations.push(float(e));
        break;
      case 'flicker':
        animations.push(flicker(e));
        break;
      case 'twinkle':
        animations.push(twinkle(e));
        break;
      case 'glow':
        if (night) animations.push(glow(e));
        break;
      case 'smoke':
        particles.push(smoke(e));
        break;
    }
  }
  return { animations, particles };
}

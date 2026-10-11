import type { CatalogItem, LightDistribution, LightType } from '@/catalog/types';
import type { ParticleDef } from '@/catalog/particles';
import { effectList } from '@/catalog/effects';

/**
 * Per-fixture-type defaults: reach (% of the item box height), brightness,
 * colour and flicker. The *shape* of the light (falloff / beam) comes from the
 * light's `distribution`, so a candle and a window differ in both.
 */
export interface LightTypeDef {
  radius: number;
  intensity: number;
  color?: string;
  /** 0–1 flicker amount. */
  flicker: number;
}

export const LIGHT_TYPES: Record<LightType, LightTypeDef> = {
  lamp: { radius: 300, intensity: 1, flicker: 0.05 },
  candle: { radius: 180, intensity: 0.72, flicker: 0.4, color: '#ffb066' },
  firefly: { radius: 90, intensity: 0.5, flicker: 0.55, color: '#ffd76b' },
  string: { radius: 120, intensity: 0.55, flicker: 0.18, color: '#ffd9a0' },
  window: { radius: 380, intensity: 1.05, flicker: 0, color: '#cfe0ff' },
  screen: { radius: 240, intensity: 0.8, flicker: 0.04, color: '#bfe3ff' },
  moon: { radius: 320, intensity: 0.55, flicker: 0, color: '#dfe6ff' },
};

export function lightTypeDef(type?: LightType): LightTypeDef {
  return (type && LIGHT_TYPES[type]) || LIGHT_TYPES.lamp;
}

/** Default distribution for each fixture type (can be overridden per light). */
export const TYPE_DISTRIBUTION: Record<LightType, LightDistribution> = {
  lamp: 'semi',
  candle: 'point',
  firefly: 'point',
  string: 'point',
  window: 'ambient',
  screen: 'diffuse',
  moon: 'ambient',
};

/**
 * Per-distribution falloff + beam shape.
 *  - `stops`    — alpha at [0, 0.2, 0.45, 0.7, 1] of the radius (the profile).
 *  - `gain`     — peak multiplier (point sources read hotter, diffusers softer).
 *  - `directional` — light is emitted in a cone (uses `angle`/`direction`).
 *  - `angle`/`penumbra` — cone defaults when not overridden per light.
 */
export interface LightDistributionDef {
  stops: number[];
  gain: number;
  directional?: boolean;
  angle?: number;
  penumbra?: number;
}

export const LIGHT_DISTRIBUTIONS: Record<LightDistribution, LightDistributionDef> = {
  point: { stops: [1, 0.5, 0.2, 0.05, 0], gain: 1.15 },
  semi: { stops: [1, 0.62, 0.32, 0.1, 0], gain: 1 },
  diffuse: { stops: [0.85, 0.72, 0.52, 0.26, 0], gain: 0.9 },
  spot: { stops: [1, 0.68, 0.36, 0.13, 0], gain: 1.1, directional: true, angle: 55, penumbra: 0.35 },
  wash: { stops: [0.82, 0.7, 0.52, 0.28, 0], gain: 0.9, directional: true, angle: 150, penumbra: 0.75 },
  ambient: { stops: [0.5, 0.5, 0.48, 0.4, 0], gain: 0.85 },
};

export function lightDistributionDef(dist: LightDistribution): LightDistributionDef {
  return LIGHT_DISTRIBUTIONS[dist] ?? LIGHT_DISTRIBUTIONS.semi;
}

function hasLightParticles(particles?: ParticleDef[]): boolean {
  return !!particles?.some((p) => p.light);
}

/** Does this asset cast any light (declared lights, a glow effect, or light particles)? */
export function emitsLight(cat: CatalogItem): boolean {
  if (cat.lights?.length) return true;
  if (effectList(cat.effect).some((e) => e.type === 'glow')) return true;
  return (
    hasLightParticles(cat.particles) ||
    hasLightParticles(cat.artVariants?.day?.particles) ||
    hasLightParticles(cat.artVariants?.night?.particles)
  );
}

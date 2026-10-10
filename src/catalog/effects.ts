import type { CatalogItem, EffectDef } from './types';
import { resolveRecipes, type ResolvedVisuals } from './recipes';

export function effectList(effect: CatalogItem['effect']): EffectDef[] {
  if (!effect) return [];
  return Array.isArray(effect) ? effect : [effect];
}

export const EMPTY_VISUALS: ResolvedVisuals = { animations: [], particles: [] };

/**
 * Every visual that should be active for an item at a given time of day:
 * legacy recipes (glow filtered to night) + generic animations/particles +
 * per-variant overrides. Fully data-driven, no hard-coded effect types.
 */
export function resolveVisuals(item: CatalogItem, night: boolean): ResolvedVisuals {
  const base = resolveRecipes(effectList(item.effect), night);
  const variant = item.artVariants?.[night ? 'night' : 'day'] ?? {};
  return {
    animations: [...base.animations, ...(item.animations ?? []), ...(variant.animations ?? [])],
    particles: [...base.particles, ...(item.particles ?? []), ...(variant.particles ?? [])],
  };
}

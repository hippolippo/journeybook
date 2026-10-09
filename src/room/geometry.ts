import type { Layer, Placement } from '@/data/types';
import type { CatalogItem } from '@/catalog/types';

/** Fraction of the stage height where the wall ends and the floor begins. */
export const WALL_LINE = 0.74;

/** Base stacking per layer so wall decor sits behind furniture, etc. */
export const LAYER_BASE: Record<Layer, number> = { wall: 10, floor: 20, surface: 30 };

export interface Band {
  top: number;
  height: number;
}

export function bandFor(layer: Layer): Band {
  return layer === 'wall'
    ? { top: 0, height: WALL_LINE }
    : { top: WALL_LINE, height: 1 - WALL_LINE };
}

export interface ResolvedStyle {
  left: string;
  top: string;
  width: string;
  height: string;
  transform: string;
  transformOrigin: string;
  zIndex: string;
}

/**
 * Resolve a band-relative placement to a CSS style. Positions are fractions of
 * the band; sizes are fractions of the band height (expressed in `vh`, since the
 * stage fills the viewport). Items are anchored at their bottom-center so they
 * "stand" on the point they were placed at.
 */
export function resolveItemStyle(
  layer: Layer,
  itemZ: number,
  placement: Placement,
  cat: Pick<CatalogItem, 'aspect'>,
): ResolvedStyle {
  const band = bandFor(layer);
  // `cqh` = 1% of the room stage's height, so items scale with the stage
  // (full viewport normally, or a phone-sized preview in the editor).
  const height = placement.scale * band.height * 100;
  const width = height * cat.aspect;
  const bottomFrac = band.top + placement.y * band.height;
  const top = bottomFrac * 100 - height;
  return {
    left: `${placement.x * 100}%`,
    top: `${top}cqh`,
    width: `${width}cqh`,
    height: `${height}cqh`,
    transform: `translateX(-50%) rotate(${placement.rotation}deg) scaleX(${placement.flip ? -1 : 1})`,
    transformOrigin: '50% 100%',
    zIndex: String(itemZ),
  };
}

/** Mobile placement derived from the desktop one when none is set explicitly. */
export function deriveMobile(desktop: Placement): Placement {
  return {
    ...desktop,
    x: Math.min(0.92, Math.max(0.08, desktop.x)),
  };
}

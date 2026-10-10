import type { Placement } from '@/data/types';
import type { Band, CatalogItem } from '@/catalog/types';
import { normalizeAngle } from '@/scrapbook/transform';

/** Fraction of the stage height where the wall ends and the floor begins. */
export const WALL_LINE = 0.74;

export interface BandRange {
  top: number;
  height: number;
}

export function bandFor(band: Band): BandRange {
  switch (band) {
    case 'wall':
      return { top: 0, height: WALL_LINE };
    case 'both':
      return { top: 0, height: 1 };
    case 'floor':
    default:
      return { top: WALL_LINE, height: 1 - WALL_LINE };
  }
}

/** A resolved box in stage fractions: `left` is the centre-x, `top` the top edge. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Box for an item using its own band coordinates. */
export function itemRect(band: Band, placement: Placement, aspect: number): Rect {
  const range = bandFor(band);
  const height = placement.scale * range.height;
  const width = height * aspect;
  const bottom = range.top + placement.y * range.height;
  return { left: placement.x, top: bottom - height, width, height };
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

function placeTransform(placement: Placement): string {
  return `translateX(-50%) rotate(${placement.rotation}deg) scaleX(${placement.flip ? -1 : 1})`;
}

/**
 * Resolve a band-relative placement to a CSS style. The position band anchors
 * the item (`positionBand`); size is measured against `sizeBand` so an item's
 * size is stable even when its position band differs (e.g. a loose surface item
 * that can be dragged anywhere before attaching).
 */
export function resolveItemStyle(
  positionBand: Band,
  itemZ: number,
  placement: Placement,
  cat: Pick<CatalogItem, 'aspect'>,
  sizeBand: Band = positionBand,
): ResolvedStyle {
  const pos = bandFor(positionBand);
  const size = bandFor(sizeBand);
  const height = placement.scale * size.height;
  const width = height * cat.aspect;
  const bottom = pos.top + placement.y * pos.height;
  const top = bottom - height;
  return {
    left: `${(placement.x * 100).toFixed(4)}%`,
    top: `${(top * 100).toFixed(4)}cqh`,
    width: `${(width * 100).toFixed(4)}cqh`,
    height: `${(height * 100).toFixed(4)}cqh`,
    transform: placeTransform(placement),
    transformOrigin: '50% 50%',
    zIndex: String(itemZ),
  };
}

/**
 * Resolve a style for an item attached to a host. The child's bottom-centre is
 * placed at `(ax, ay)` within the host box. Size is measured against the child's
 * own band (`sizeBand`) so it looks the same whether the host is on the wall or
 * the floor.
 */
export function resolveAttachedStyle(
  host: Rect,
  hostLeftPct: number,
  itemZ: number,
  placement: Placement,
  childAspect: number,
  sizeBand: Band,
): ResolvedStyle {
  const ax = placement.ax ?? 0.5;
  const ay = placement.ay ?? 0;
  const height = placement.scale * bandFor(sizeBand).height;
  const width = height * childAspect;
  const bottom = host.top + ay * host.height;
  const top = bottom - height;
  // `host.left` is the host centre; `ax` is measured from the host's left edge.
  const offsetCqh = (ax - 0.5) * host.width * 100;
  const sign = offsetCqh < 0 ? '-' : '+';
  const offset = Math.abs(offsetCqh).toFixed(4);
  return {
    left: `calc(${(hostLeftPct * 100).toFixed(4)}% ${sign} ${offset}cqh)`,
    top: `${(top * 100).toFixed(4)}cqh`,
    width: `${(width * 100).toFixed(4)}cqh`,
    height: `${(height * 100).toFixed(4)}cqh`,
    transform: placeTransform(placement),
    transformOrigin: '50% 50%',
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

/**
 * Flat (screen-space) style for an item attached to a host, matching how the
 * nested child renders — including the host's rotation and flip. Used for the
 * floating drag preview so it lines up with the real (nested) item.
 */
export function resolveAttachedFlatStyle(
  host: Pick<CatalogItem, 'band' | 'aspect' | 'defaultScale'>,
  hostPlacement: Placement,
  child: Pick<CatalogItem, 'band' | 'aspect'>,
  childPlacement: Placement,
  itemZ: number,
): ResolvedStyle {
  const hostRange = bandFor(host.band);
  const hostH = hostPlacement.scale * hostRange.height;
  const hostW = hostH * host.aspect;
  const childH =
    childPlacement.scale * bandFor(child.band).height * (hostPlacement.scale / host.defaultScale);
  const childW = childH * child.aspect;
  const ax = childPlacement.ax ?? 0.5;
  const ay = childPlacement.ay ?? 0;
  // Child centre relative to the host centre, in cqh units.
  let cx = (ax - 0.5) * hostW * 100;
  const cy = (ay - 0.5) * hostH * 100 - (childH * 100) / 2;
  if (hostPlacement.flip) cx = -cx;
  const rad = (hostPlacement.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = cx * cos - cy * sin;
  const ry = cx * sin + cy * cos;
  const pivotX = hostPlacement.x * 100;
  const pivotY = (hostRange.top + hostPlacement.y * hostRange.height - hostH / 2) * 100;
  const sign = rx < 0 ? '-' : '+';
  const totalRot = normalizeAngle(
    hostPlacement.rotation + (hostPlacement.flip ? -childPlacement.rotation : childPlacement.rotation),
  );
  const totalFlip = hostPlacement.flip ? !childPlacement.flip : childPlacement.flip;
  return {
    left: `calc(${pivotX.toFixed(4)}% ${sign} ${Math.abs(rx).toFixed(4)}cqh)`,
    top: `${(pivotY + ry - (childH * 100) / 2).toFixed(4)}cqh`,
    width: `${(childW * 100).toFixed(4)}cqh`,
    height: `${(childH * 100).toFixed(4)}cqh`,
    transform: `translateX(-50%) rotate(${totalRot}deg) scaleX(${totalFlip ? -1 : 1})`,
    transformOrigin: '50% 50%',
    zIndex: String(itemZ),
  };
}

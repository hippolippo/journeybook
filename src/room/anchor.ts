import type { CatalogItem } from '@/catalog/types';

/** A point inside an item's box (0–1) that pins it to a host. */
export interface AttachAnchor {
  x: number;
  y: number;
}

/** Items rest on their bottom-centre unless they declare otherwise. */
export const DEFAULT_ATTACH_ANCHOR: AttachAnchor = { x: 0.5, y: 1 };

/** The item's declared anchor, or the bottom-centre default. */
export function attachAnchorOf(cat: Pick<CatalogItem, 'attachAnchor'>): AttachAnchor {
  return cat.attachAnchor ?? DEFAULT_ATTACH_ANCHOR;
}

/** Mirror the anchor horizontally when the item is flipped. */
export function displayAnchor(anchor: AttachAnchor, flip: boolean): AttachAnchor {
  return flip ? { x: 1 - anchor.x, y: anchor.y } : anchor;
}

/** Offset from a child's centre to its displayed anchor (unrotated). */
export function anchorCenterOffset(
  anchor: AttachAnchor,
  width: number,
  height: number,
  flip: boolean,
): { x: number; y: number } {
  const q = displayAnchor(anchor, flip);
  return { x: (q.x - 0.5) * width, y: (q.y - 0.5) * height };
}

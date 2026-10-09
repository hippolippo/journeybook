export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface Point {
  x: number;
  y: number;
}

function rotate(px: number, py: number, deg: number): Point {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: px * c - py * s, y: px * s + py * c };
}

/** Normalize an angle to (-180, 180], rounded to 0.1°. */
export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Math.round(a * 10) / 10;
}

export interface ResizeOptions {
  /** Preserve the box's original aspect ratio when true. */
  locked?: boolean;
  minSize?: number;
}

/**
 * Resize a box by dragging its bottom-right corner to `pointer` (page fractions,
 * square page). The opposite (top-left) corner stays fixed, so the dragged edge
 * tracks the pointer 1:1. With `locked`, the original aspect ratio is preserved.
 */
export function resizeCorner(box: Box, pointer: Point, opts: ResizeOptions = {}): Box {
  const minSize = opts.minSize ?? 0.03;
  const tl = rotate(-box.w / 2, -box.h / 2, box.rotation);
  const fixed = { x: box.x + tl.x, y: box.y + tl.y };
  const v = rotate(pointer.x - fixed.x, pointer.y - fixed.y, -box.rotation);
  let w = Math.max(minSize, v.x);
  let h = Math.max(minSize, v.y);
  if (opts.locked) {
    const s = Math.max(w / box.w, h / box.h);
    w = Math.max(minSize, box.w * s);
    h = Math.max(minSize, box.h * s);
  }
  const c = rotate(w / 2, h / 2, box.rotation);
  return { x: fixed.x + c.x, y: fixed.y + c.y, w, h, rotation: box.rotation };
}

/** Rotation for a handle dragging around `center`; the handle rests "up" at 0°. */
export function angleFromCenter(center: Point, pointer: Point): number {
  const deg = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI;
  return normalizeAngle(deg + 90);
}

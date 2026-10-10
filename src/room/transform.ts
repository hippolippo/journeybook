import type { Placement } from '@/data/types';
import type { Band, CatalogItem } from '@/catalog/types';
import { bandFor } from './geometry';
import { angleFromCenter, normalizeAngle, resizeCorner, type Box, type Point } from '@/scrapbook/transform';

/** A stage element's box in client pixels (from getBoundingClientRect). */
export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function heightFrac(band: Band, p: Placement): number {
  return p.scale * bandFor(band).height;
}

export function bottomFrac(band: Band, p: Placement): number {
  const r = bandFor(band);
  return r.top + p.y * r.height;
}

/** The item box in px: centre-x, centre-y, width, height, rotation. */
export function boxPx(
  positionBand: Band,
  sizeBand: Band,
  p: Placement,
  aspect: number,
  stage: StageRect,
): Box {
  const h = heightFrac(sizeBand, p) * stage.height;
  const w = h * aspect;
  const bottom = bottomFrac(positionBand, p) * stage.height;
  return { x: stage.left + p.x * stage.width, y: stage.top + bottom - h / 2, w, h, rotation: p.rotation };
}

/** The item box's centre in px (the rotation pivot). */
export function centerPx(positionBand: Band, sizeBand: Band, p: Placement, stage: StageRect): Point {
  const h = heightFrac(sizeBand, p) * stage.height;
  const bottom = bottomFrac(positionBand, p) * stage.height;
  return { x: stage.left + p.x * stage.width, y: stage.top + bottom - h / 2 };
}

/** Convert a resized pixel box back into placement fields. */
export function placementFromBox(
  positionBand: Band,
  sizeBand: Band,
  box: Box,
  stage: StageRect,
): Pick<Placement, 'x' | 'y' | 'scale' | 'rotation'> {
  const scale = box.h / (bandFor(sizeBand).height * stage.height);
  const bottom = (box.y + box.h / 2 - stage.top) / stage.height;
  const r = bandFor(positionBand);
  return {
    x: (box.x - stage.left) / stage.width,
    y: (bottom - r.top) / r.height,
    scale,
    rotation: normalizeAngle(box.rotation),
  };
}

/**
 * Resize a loose item by dragging its bottom-right handle: the opposite
 * (top-left) corner stays fixed, aspect ratio preserved.
 */
export function resizeLoose(
  positionBand: Band,
  sizeBand: Band,
  p: Placement,
  aspect: number,
  pointer: Point,
  stage: StageRect,
): Pick<Placement, 'x' | 'y' | 'scale' | 'rotation'> {
  const box = boxPx(positionBand, sizeBand, p, aspect, stage);
  const next = resizeCorner(box, pointer, { locked: true, minSize: 8 });
  return placementFromBox(positionBand, sizeBand, next, stage);
}

/**
 * A host's transform frame: its pivot and pre-transform box size, so attached
 * children can map between host-local and screen space.
 */
export interface HostFrame {
  pivot: Point;
  widthPx: number;
  heightPx: number;
  rotation: number;
  flip: boolean;
}

export function hostFrame(
  hostCat: Pick<CatalogItem, 'band' | 'aspect'>,
  hostPlacement: Placement,
  stage: StageRect,
): HostFrame {
  const heightPx = heightFrac(hostCat.band, hostPlacement) * stage.height;
  return {
    // Items rotate about their centre, so the host's frame pivots there too.
    pivot: centerPx(hostCat.band, hostCat.band, hostPlacement, stage),
    widthPx: heightPx * hostCat.aspect,
    heightPx,
    rotation: hostPlacement.rotation,
    flip: hostPlacement.flip,
  };
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** World displacement → host-local displacement (inverts host rotation + flip). */
export function screenToHostLocal(dx: number, dy: number, frame: HostFrame): Point {
  const r = toRadians(frame.rotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  let x = dx * cos + dy * sin;
  const y = -dx * sin + dy * cos;
  if (frame.flip) x = -x;
  return { x, y };
}

/** A child's bottom-centre in host-local px, relative to the host centre. */
export function childAnchorLocal(ax: number, ay: number, frame: HostFrame): Point {
  return { x: (ax - 0.5) * frame.widthPx, y: (ay - 0.5) * frame.heightPx };
}

/** Host-local point (relative to the pivot) → screen px. */
export function hostLocalToScreen(local: Point, frame: HostFrame): Point {
  const x = frame.flip ? -local.x : local.x;
  const r = toRadians(frame.rotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    x: frame.pivot.x + x * cos - local.y * sin,
    y: frame.pivot.y + x * sin + local.y * cos,
  };
}

/**
 * Size of a nested child as a percentage of the host box. The child keeps its
 * own band-relative size at the host's default scale, then scales with the host.
 */
export function attachedPct(
  child: Pick<CatalogItem, 'aspect' | 'band'>,
  childPlacement: Placement,
  host: Pick<CatalogItem, 'aspect' | 'band' | 'defaultScale'>,
): { heightPct: number; widthPct: number } {
  const heightPct =
    ((childPlacement.scale * bandFor(child.band).height) /
      (host.defaultScale * bandFor(host.band).height)) *
    100;
  return { heightPct, widthPct: (heightPct * child.aspect) / host.aspect };
}

/** Screen angle → the child's local rotation inside a (possibly rotated) host. */
export function localRotation(screenAngle: number, frame: HostFrame): number {
  return normalizeAngle(frame.flip ? frame.rotation - screenAngle : screenAngle - frame.rotation);
}

/** Rotation for a loose item's handle (unaffected by horizontal flip). */
export function looseRotation(pivot: Point, pointer: Point): number {
  return angleFromCenter(pivot, pointer);
}

/** The child's on-screen bottom-centre, given its host frame and anchor. */
export function childPivotScreen(ax: number, ay: number, frame: HostFrame): Point {
  return hostLocalToScreen(childAnchorLocal(ax, ay, frame), frame);
}

/** The child's on-screen centre (its rotation pivot), independent of its rotation. */
export function childCenterScreen(ax: number, ay: number, childHeightPx: number, frame: HostFrame): Point {
  const anchor = childAnchorLocal(ax, ay, frame);
  return hostLocalToScreen({ x: anchor.x, y: anchor.y - childHeightPx / 2 }, frame);
}

/**
 * Scale multiplier for a nested child's resize handle, measured along the
 * child's local axes in host space.
 */
export function attachedResizeRatio(
  ax: number,
  ay: number,
  childRotation: number,
  childWidthPx: number,
  childHeightPx: number,
  pointer: Point,
  frame: HostFrame,
): number {
  const anchor = childAnchorLocal(ax, ay, frame);
  const world = screenToHostLocal(pointer.x - frame.pivot.x, pointer.y - frame.pivot.y, frame);
  const vx = world.x - anchor.x;
  const vy = world.y - anchor.y;
  const r = toRadians(childRotation);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const u = vx * cos + vy * sin;
  const w = -vx * sin + vy * cos;
  const ratioX = u / Math.max(1, childWidthPx / 2);
  const ratioY = w / Math.max(1, childHeightPx);
  return Math.max(ratioX, ratioY);
}

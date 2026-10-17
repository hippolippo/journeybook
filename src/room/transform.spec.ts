import { describe, expect, it } from 'vitest';
import type { Placement } from '@/data/types';
import type { Band } from '@/catalog/types';
import { bandFor } from './geometry';
import {
  attachedPct,
  bottomFrac,
  centerPx,
  childCenterScreen,
  childPivotScreen,
  detachedLoosePlacement,
  heightFrac,
  hostFrame,
  hostLocalToScreen,
  localRotation,
  looseAnchorPoint,
  resizeLoose,
  screenToHostLocal,
  type HostFrame,
  type StageRect,
} from './transform';

const stage: StageRect = { left: 0, top: 0, width: 1000, height: 1000 };
const place = (over: Partial<Placement> = {}): Placement => ({
  x: 0.5,
  y: 0.5,
  scale: 0.5,
  rotation: 0,
  flip: false,
  ...over,
});

describe('band fractions', () => {
  it('measures height against the size band and bottom against the position band', () => {
    const p = place({ y: 1, scale: 0.5 });
    expect(heightFrac('floor', p)).toBeCloseTo(0.13);
    expect(bottomFrac('floor', p)).toBeCloseTo(1);
    expect(bottomFrac('wall', place({ y: 0.5 }))).toBeCloseTo(0.37);
  });
});

describe('attachedPct', () => {
  it('keeps the item size independent of the host band at each host default', () => {
    const child = { aspect: 1, band: 'floor' as Band };
    const shelf = { aspect: 280 / 170, band: 'wall' as Band, defaultScale: 0.22 };
    const desk = { aspect: 440 / 260, band: 'floor' as Band, defaultScale: 1 };
    const childPlacement = place({ scale: 0.18 });
    const onShelf = attachedPct(child, childPlacement, shelf);
    const onDesk = attachedPct(child, childPlacement, desk);
    // Render the same child on both hosts: its stage height should match.
    const shelfChild = (onShelf.heightPct / 100) * shelf.defaultScale * bandFor('wall').height;
    const deskChild = (onDesk.heightPct / 100) * desk.defaultScale * bandFor('floor').height;
    expect(shelfChild).toBeCloseTo(childPlacement.scale * bandFor('floor').height);
    expect(deskChild).toBeCloseTo(childPlacement.scale * bandFor('floor').height);
  });

  it('scales with the host percentage (fixed fraction of host height)', () => {
    const child = { aspect: 1, band: 'floor' as Band };
    const host = { aspect: 2, band: 'floor' as Band, defaultScale: 1 };
    const { heightPct, widthPct } = attachedPct(child, place({ scale: 1 }), host);
    expect(heightPct).toBeCloseTo(100);
    expect(widthPct).toBeCloseTo(50);
  });
});

describe('host frames and screen mapping', () => {
  it('round-trips host-local points through screen space', () => {
    const frame: HostFrame = { pivot: { x: 100, y: 200 }, widthPx: 80, heightPx: 40, rotation: 30, flip: false };
    for (const local of [
      { x: 12, y: -8 },
      { x: -20, y: 5 },
      { x: 0, y: 0 },
    ]) {
      const screen = hostLocalToScreen(local, frame);
      const back = screenToHostLocal(screen.x - frame.pivot.x, screen.y - frame.pivot.y, frame);
      expect(back.x).toBeCloseTo(local.x, 5);
      expect(back.y).toBeCloseTo(local.y, 5);
    }
  });

  it('round-trips with a flipped host', () => {
    const frame: HostFrame = { pivot: { x: 0, y: 0 }, widthPx: 50, heightPx: 30, rotation: -15, flip: true };
    const local = { x: 9, y: -4 };
    const screen = hostLocalToScreen(local, frame);
    const back = screenToHostLocal(screen.x, screen.y, frame);
    expect(back.x).toBeCloseTo(local.x, 5);
    expect(back.y).toBeCloseTo(local.y, 5);
  });

  it('converts a screen angle to a child local rotation inside a rotated host', () => {
    const frame: HostFrame = { pivot: { x: 0, y: 0 }, widthPx: 50, heightPx: 30, rotation: 30, flip: false };
    expect(localRotation(60, frame)).toBeCloseTo(30);
    const flipped = { ...frame, flip: true };
    expect(localRotation(60, flipped)).toBeCloseTo(-30);
  });
});

describe('resizeLoose', () => {
  it('keeps the aspect ratio and the opposite (top-left) corner fixed', () => {
    const p = place({ x: 0.5, y: 1, scale: 0.5, rotation: 0 });
    const next = resizeLoose('floor', 'floor', p, 2, { x: 760, y: 1000 }, stage);
    const h = next.scale * bandFor('floor').height * stage.height;
    const w = h * 2;
    const bottom = (bandFor('floor').top + next.y * bandFor('floor').height) * stage.height;
    const centerY = bottom - h / 2;
    const centerX = next.x * stage.width;
    // Top-left corner was (370, 870) and must stay put.
    expect(centerX - w / 2).toBeCloseTo(370, 1);
    expect(centerY - h / 2).toBeCloseTo(870, 1);
    expect(Math.abs(w / h - 2)).toBeLessThan(1e-6);
  });
});

describe('centerPx', () => {
  it('returns the box centre (rotation pivot) in px', () => {
    const c = centerPx('floor', 'floor', place({ x: 0.5, y: 1, scale: 0.5 }), stage);
    expect(c.x).toBeCloseTo(500);
    expect(c.y).toBeCloseTo(1000 - 65);
  });
});

describe('looseAnchorPoint', () => {
  it('defaults to the bottom-centre of the item box', () => {
    const point = looseAnchorPoint(
      { aspect: 2 },
      'floor',
      'floor',
      place({ x: 0.5, y: 1, scale: 0.5 }),
      stage,
    );
    expect(point.x).toBeCloseTo(500);
    expect(point.y).toBeCloseTo(1000);
  });

  it('uses a top-right anchor and mirrors it when flipped', () => {
    const child = { aspect: 2, attachAnchor: { x: 1, y: 0 } };
    const p = place({ x: 0.5, y: 1, scale: 0.5 });
    const right = looseAnchorPoint(child, 'floor', 'floor', p, stage);
    expect(right.x).toBeCloseTo(630);
    expect(right.y).toBeCloseTo(870);

    const left = looseAnchorPoint(child, 'floor', 'floor', { ...p, flip: true }, stage);
    expect(left.x).toBeCloseTo(370);
    expect(left.y).toBeCloseTo(870);
  });
});

describe('childCenterScreen', () => {
  it('is independent of the child rotation and sits half a height above the anchor', () => {
    const host = { band: 'floor' as Band, aspect: 2 };
    const frame = hostFrame(host, place({ x: 0.2, y: 1, scale: 1, rotation: 0 }), stage);
    const center = childCenterScreen(0.5, 1, 100, frame);
    expect(center.x).toBeCloseTo(200);
    expect(center.y).toBeCloseTo(1000 - 50);
  });

  it('offsets the centre from a custom attach point', () => {
    const host = { band: 'floor' as Band, aspect: 2 };
    const frame = hostFrame(host, place({ x: 0.2, y: 1, scale: 1, rotation: 0 }), stage);
    const center = childCenterScreen(1, 0, 100, frame, { x: 1, y: 0 }, 200, false);
    expect(center.x).toBeCloseTo(360);
    expect(center.y).toBeCloseTo(790);

    const flipped = childCenterScreen(1, 0, 100, frame, { x: 1, y: 0 }, 200, true);
    expect(flipped.x).toBeCloseTo(560);
    expect(flipped.y).toBeCloseTo(790);
  });
});

describe('childPivotScreen', () => {
  it('places the anchor at the host pivot for a centred, bottom-anchored child', () => {
    const host = { band: 'floor' as Band, aspect: 2 };
    const frame = hostFrame(host, place({ x: 0.2, y: 1, scale: 1, rotation: 0 }), stage);
    const pivot = childPivotScreen(0.5, 1, frame);
    expect(pivot.x).toBeCloseTo(200, 5);
    expect(pivot.y).toBeCloseTo(1000, 5);
  });

  it('rotates the anchor around the host pivot', () => {
    const host = { band: 'floor' as Band, aspect: 2 };
    const frame = hostFrame(host, place({ x: 0.2, y: 1, scale: 1, rotation: 180 }), stage);
    // Child at the host's left edge, rotated 180° -> appears on the right and up.
    const pivot = childPivotScreen(0, 1, frame);
    expect(pivot.x).toBeCloseTo(200 + frame.widthPx / 2, 4);
    expect(pivot.y).toBeCloseTo(1000 - frame.heightPx, 4);
  });
});

describe('detachedLoosePlacement', () => {
  const host = { band: 'floor' as Band, aspect: 2, defaultScale: 1 };
  const child = { band: 'floor' as Band, aspect: 1.5, layer: 'floor' as const };

  /** The child's on-screen centre while attached, using the px-space helpers. */
  function attachedCenter(
    hostPlacement: Placement,
    childPlacement: Placement,
    rect: StageRect,
  ) {
    const frame = hostFrame(host, hostPlacement, rect);
    const { heightPct } = attachedPct(child, childPlacement, host);
    const childH = (heightPct / 100) * frame.heightPx;
    return childCenterScreen(childPlacement.ax ?? 0.5, childPlacement.ay ?? 0, childH, frame);
  }

  it('keeps the child centre when detached (axis-aligned host)', () => {
    const rect: StageRect = { left: 0, top: 0, width: 800, height: 1000 };
    const hp = place({ x: 0.3, y: 0.8, scale: 0.6, rotation: 0 });
    const cp = place({ scale: 0.2, ax: 0.7, ay: 0.9, rotation: 0 });
    const detached = detachedLoosePlacement(host, hp, child, cp, rect.height / rect.width);
    const loose = centerPx('floor', 'floor', { ...cp, ...detached }, rect);
    const attached = attachedCenter(hp, cp, rect);
    expect(loose.x).toBeCloseTo(attached.x, 4);
    expect(loose.y).toBeCloseTo(attached.y, 4);
  });

  it('keeps the child centre for a rotated host on a non-square stage', () => {
    const rect: StageRect = { left: 0, top: 0, width: 1200, height: 900 };
    const hp = place({ x: 0.42, y: 0.6, scale: 0.5, rotation: 24, flip: true });
    const cp = place({ scale: 0.17, ax: 0.34, ay: 0.8, rotation: 0 });
    const detached = detachedLoosePlacement(host, hp, child, cp, rect.height / rect.width);
    const loose = centerPx('floor', 'floor', { ...cp, ...detached }, rect);
    const attached = attachedCenter(hp, cp, rect);
    expect(loose.x).toBeCloseTo(attached.x, 4);
    expect(loose.y).toBeCloseTo(attached.y, 4);
  });
});

import { describe, expect, it } from 'vitest';
import { WALL_LINE, bandFor, deriveMobile, itemRect, resolveAttachedFlatStyle, resolveAttachedStyle, resolveItemStyle } from './geometry';

describe('bandFor', () => {
  it('splits the stage into wall, floor and whole-stage bands', () => {
    expect(bandFor('wall')).toEqual({ top: 0, height: WALL_LINE });
    expect(bandFor('floor')).toEqual({ top: WALL_LINE, height: 1 - WALL_LINE });
    expect(bandFor('both')).toEqual({ top: 0, height: 1 });
  });
});

describe('resolveItemStyle', () => {
  it('anchors an item at its bottom-center on the band', () => {
    const style = resolveItemStyle('floor', 20, { x: 0.5, y: 1, scale: 0.5, rotation: 0, flip: false }, { aspect: 2 });
    expect(style.left).toBe('50.0000%');
    // floor band height 0.26; scale 0.5 -> 13cqh tall; bottoms out -> top 87cqh
    expect(parseFloat(style.top)).toBeCloseTo(87);
    expect(parseFloat(style.height)).toBeCloseTo(13);
    expect(parseFloat(style.width)).toBeCloseTo(26);
    expect(style.zIndex).toBe('20');
  });

  it('sizes against the size band even when the position band differs', () => {
    // Loose surface item can move across the whole stage but is sized by its floor band.
    const style = resolveItemStyle('both', 30, { x: 0.5, y: 0.5, scale: 0.5, rotation: 0, flip: false }, { aspect: 2 }, 'floor');
    expect(parseFloat(style.height)).toBeCloseTo(13);
    expect(parseFloat(style.top)).toBeCloseTo(37);
  });
});

describe('resolveAttachedStyle', () => {
  it('places a child at host-relative offsets, sized against its own band', () => {
    const host = itemRect('floor', { x: 0.2, y: 1, scale: 1, rotation: 0, flip: false }, 2);
    const child = { x: 0.5, y: 0.5, scale: 0.5, rotation: 0, flip: false, ax: 0.25, ay: 0 };
    const style = resolveAttachedStyle(host, 0.2, 30, child, 1, 'floor');
    // ax 0.25 -> (0.25 - 0.5) * host width 0.52 = -13cqh from 20%
    expect(style.left).toBe('calc(20.0000% - 13.0000cqh)');
    // floor band height 0.26 -> child height 0.13; bottom at host top 0.74 -> top 0.61
    expect(parseFloat(style.height)).toBeCloseTo(13);
    expect(parseFloat(style.top)).toBeCloseTo(61);
    expect(style.zIndex).toBe('30');
  });

  it('maps ax from the host left edge (0.5 = centre)', () => {
    const host = itemRect('floor', { x: 0.2, y: 1, scale: 1, rotation: 0, flip: false }, 2);
    const at = (ax: number) =>
      resolveAttachedStyle(host, 0.2, 30, { x: 0.5, y: 0.5, scale: 0.5, rotation: 0, flip: false, ax, ay: 0 }, 1, 'floor');
    expect(at(0).left).toBe('calc(20.0000% - 26.0000cqh)');
    expect(at(0.5).left).toBe('calc(20.0000% + 0.0000cqh)');
    expect(at(1).left).toBe('calc(20.0000% + 26.0000cqh)');
  });

  it('keeps size independent of the host (same item, wall host)', () => {
    const wallHost = itemRect('wall', { x: 0.2, y: 0.5, scale: 0.2, rotation: 0, flip: false }, 2);
    const child = { x: 0.5, y: 0.5, scale: 0.5, rotation: 0, flip: false, ax: 0.5, ay: 0 };
    const style = resolveAttachedStyle(wallHost, 0.2, 30, child, 1, 'floor');
    // Sized by the child's floor band, not the wall host.
    expect(parseFloat(style.height)).toBeCloseTo(13);
  });
});

describe('deriveMobile', () => {
  it('clamps x into a safe range', () => {
    expect(deriveMobile({ x: 0.01, y: 0.5, scale: 1, rotation: 0, flip: false }).x).toBe(0.08);
    expect(deriveMobile({ x: 0.99, y: 0.5, scale: 1, rotation: 0, flip: false }).x).toBe(0.92);
    expect(deriveMobile({ x: 0.5, y: 0.5, scale: 1, rotation: 0, flip: false }).x).toBe(0.5);
  });
});

describe('resolveAttachedFlatStyle', () => {
  const hostCat = { band: 'floor' as const, aspect: 2, defaultScale: 1 };
  const childCat = { band: 'floor' as const, aspect: 1 };
  const child = { x: 0.5, y: 0.5, scale: 0.5, rotation: 0, flip: false, ax: 0.25, ay: 0 };

  it('matches the flat attached placement for an unrotated host', () => {
    const host = { x: 0.2, y: 1, scale: 1, rotation: 0, flip: false };
    const style = resolveAttachedFlatStyle(hostCat, host, childCat, child, 30);
    expect(style.left).toBe('calc(20.0000% - 13.0000cqh)');
    expect(parseFloat(style.top)).toBeCloseTo(61);
    expect(parseFloat(style.height)).toBeCloseTo(13);
  });

  it('adds the host rotation to the child transform', () => {
    const host = { x: 0.2, y: 1, scale: 1, rotation: 30, flip: false };
    const style = resolveAttachedFlatStyle(hostCat, host, childCat, { ...child, ax: 0.5, rotation: 10 }, 30);
    expect(style.transform).toBe('translateX(-50%) rotate(40deg) scaleX(1)');
  });
});


import { describe, expect, it } from 'vitest';
import { WALL_LINE, bandFor, deriveMobile, resolveItemStyle } from './geometry';

describe('bandFor', () => {
  it('splits the stage into wall and floor bands', () => {
    expect(bandFor('wall')).toEqual({ top: 0, height: WALL_LINE });
    expect(bandFor('floor')).toEqual({ top: WALL_LINE, height: 1 - WALL_LINE });
    expect(bandFor('surface').top).toBeCloseTo(WALL_LINE);
  });
});

describe('resolveItemStyle', () => {
  it('anchors an item at its bottom-center on the band', () => {
    const style = resolveItemStyle(
      'floor',
      20,
      { x: 0.5, y: 1, scale: 0.5, rotation: 0, flip: false },
      { aspect: 2 },
    );
    expect(style.left).toBe('50%');
    // floor band height 0.26; scale 0.5 -> 13cqh tall (of the stage); bottoms out -> top 87cqh
    expect(style.top).toBe('87cqh');
    expect(style.height).toBe('13cqh');
    expect(style.width).toBe('26cqh');
    expect(style.zIndex).toBe('20');
  });
});

describe('deriveMobile', () => {
  it('clamps x into a safe range', () => {
    expect(deriveMobile({ x: 0.01, y: 0.5, scale: 1, rotation: 0, flip: false }).x).toBe(0.08);
    expect(deriveMobile({ x: 0.99, y: 0.5, scale: 1, rotation: 0, flip: false }).x).toBe(0.92);
    expect(deriveMobile({ x: 0.5, y: 0.5, scale: 1, rotation: 0, flip: false }).x).toBe(0.5);
  });
});

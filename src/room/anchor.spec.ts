import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ATTACH_ANCHOR,
  anchorCenterOffset,
  attachAnchorOf,
  displayAnchor,
} from './anchor';

describe('attach anchors', () => {
  it('defaults to bottom-centre', () => {
    expect(attachAnchorOf({})).toEqual(DEFAULT_ATTACH_ANCHOR);
  });

  it('uses the declared anchor', () => {
    expect(attachAnchorOf({ attachAnchor: { x: 1, y: 0 } })).toEqual({ x: 1, y: 0 });
  });

  it('mirrors the horizontal side when flipped', () => {
    expect(displayAnchor({ x: 1, y: 0 }, false)).toEqual({ x: 1, y: 0 });
    expect(displayAnchor({ x: 1, y: 0 }, true)).toEqual({ x: 0, y: 0 });
  });

  it('computes the offset from the child centre to its anchor', () => {
    expect(anchorCenterOffset({ x: 0.5, y: 1 }, 10, 20, false)).toEqual({ x: 0, y: 10 });
    expect(anchorCenterOffset({ x: 1, y: 0 }, 10, 20, false)).toEqual({ x: 5, y: -10 });
    expect(anchorCenterOffset({ x: 1, y: 0 }, 10, 20, true)).toEqual({ x: -5, y: -10 });
  });
});

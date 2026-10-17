import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHADOW,
  STRONG_SHADOW,
  composePose,
  defaultShadowAmount,
  isRestingCategory,
  levelShadowTransform,
  ovalShadowStyle,
  shadowFilter,
} from './shadow';

describe('room item shadow defaults', () => {
  it('defaults shadows on for trinkets, furniture and wall decor', () => {
    expect(defaultShadowAmount({ id: 'floor-lamp', category: 'furniture' })).toBe(DEFAULT_SHADOW);
    expect(defaultShadowAmount({ id: 'potted-plant', category: 'trinket' })).toBe(DEFAULT_SHADOW);
    expect(defaultShadowAmount({ id: 'wall-clock', category: 'wallDecor' })).toBe(DEFAULT_SHADOW);
  });

  it('excludes postcards and rugs, but the corkboard gets the wall shadow', () => {
    expect(defaultShadowAmount({ id: 'postcard-01', category: 'trinket' })).toBe(0);
    expect(defaultShadowAmount({ id: 'circular-rug', category: 'furniture' })).toBe(0);
    expect(defaultShadowAmount({ id: 'rectangle-rug', category: 'furniture' })).toBe(0);
    expect(defaultShadowAmount({ id: 'corkboard', category: 'wallDecor' })).toBe(DEFAULT_SHADOW);
  });

  it('gives surfaces no shadow', () => {
    expect(defaultShadowAmount({ id: 'plain-sage', category: 'wallpaper' })).toBe(0);
    expect(defaultShadowAmount({ id: 'wood-warm', category: 'flooring' })).toBe(0);
  });

  it('gives pets a shadow (drop + oval)', () => {
    expect(defaultShadowAmount({ id: 'raccoon', category: 'pet' })).toBe(DEFAULT_SHADOW);
    expect(isRestingCategory('pet')).toBe(true);
    expect(ovalShadowStyle('pet', 0.5)).not.toBeNull();
  });

  it('renders a scaled drop shadow, and none at zero', () => {
    expect(shadowFilter(0)).toBe('none');
    expect(shadowFilter(0.5)).toContain('drop-shadow(');
    expect(shadowFilter(1)).toContain('drop-shadow(');
  });

  it('gives shelves and the desk a stronger default shadow', () => {
    for (const id of ['desk', 'short-shelf', 'medium-shelf', 'tall-shelf']) {
      expect(defaultShadowAmount({ id, category: 'furniture' })).toBe(STRONG_SHADOW);
    }
    expect(defaultShadowAmount({ id: 'large-wall-shelf', category: 'wallDecor' })).toBe(STRONG_SHADOW);
    expect(defaultShadowAmount({ id: 'medium-wall-shelf', category: 'wallDecor' })).toBe(STRONG_SHADOW);
  });

  it('classifies resting items (trinkets + furniture) for the oval shadow', () => {
    expect(isRestingCategory('trinket')).toBe(true);
    expect(isRestingCategory('furniture')).toBe(true);
    expect(isRestingCategory('wallDecor')).toBe(false);
    expect(isRestingCategory('wallpaper')).toBe(false);
  });

  it('builds an oval style only for resting items, scaling opacity + width', () => {
    expect(ovalShadowStyle('wallDecor', 0.5)).toBeNull();
    expect(ovalShadowStyle('furniture', 0)).toBeNull();
    const mid = ovalShadowStyle('trinket', 0.5);
    const high = ovalShadowStyle('trinket', 1);
    expect(mid).toBeTruthy();
    expect(high).toBeTruthy();
    expect(parseFloat(high!.width)).toBeGreaterThan(parseFloat(mid!.width));
    expect(parseFloat(high!.opacity)).toBeGreaterThan(parseFloat(mid!.opacity));
  });

  it('composes an attached child pose with its host, including flips', () => {
    expect(composePose({ rotation: 30, flip: false }, { rotation: 10, flip: false })).toEqual({ rotation: 40, flip: false });
    expect(composePose({ rotation: 30, flip: false }, { rotation: 10, flip: true })).toEqual({ rotation: 40, flip: true });
    expect(composePose({ rotation: 30, flip: true }, { rotation: 10, flip: false })).toEqual({ rotation: 20, flip: true });
    expect(composePose({ rotation: 30, flip: true }, { rotation: 10, flip: true })).toEqual({ rotation: 20, flip: false });
  });

  it('counter-transforms the level shadow wrapper for rotation and flip', () => {
    expect(levelShadowTransform({ rotation: 0, flip: false })).toBe('scaleX(1) rotate(0deg)');
    expect(levelShadowTransform({ rotation: 30, flip: false })).toBe('scaleX(1) rotate(-30deg)');
    expect(levelShadowTransform({ rotation: 30, flip: true })).toBe('scaleX(-1) rotate(-30deg)');
  });
});

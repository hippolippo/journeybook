import { describe, expect, it } from 'vitest';
import { animationClass, animationStyle, ensureKeyframes } from './animation';

describe('animation engine', () => {
  it('compiles keyframes to a cached name', () => {
    const stops = [{ at: 0, opacity: 0 }, { at: 100, opacity: 1 }];
    const a = ensureKeyframes(stops);
    const b = ensureKeyframes([{ at: 0, opacity: 0 }, { at: 100, opacity: 1 }]);
    expect(typeof a).toBe('string');
    expect(a).toBe(b);
  });

  it('applies durations, origins and custom vars', () => {
    const style = animationStyle({
      name: 'sway',
      keyframes: [{ at: 0, transform: 'rotate(-2deg)' }, { at: 100, transform: 'rotate(2deg)' }],
      duration: '5s',
      origin: '50% 0%',
      vars: { '--fx-amp': '3deg' },
    });
    expect(style.animationDuration).toBe('5s');
    expect(style.animationTimingFunction).toBe('ease-in-out');
    expect(style.animationIterationCount).toBe('infinite');
    expect(style.transformOrigin).toBe('50% 0%');
    expect(style['--fx-amp']).toBe('3deg');
    expect(animationClass({ name: 'sway', keyframes: [] })).toBe('fx--sway');
  });
});

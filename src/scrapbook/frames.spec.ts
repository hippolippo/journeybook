import { describe, expect, it } from 'vitest';
import { FRAMES, frameAspect, frameById } from './frames';

describe('frameById', () => {
  it('falls back to the first frame', () => {
    expect(frameById(undefined).id).toBe('none');
    expect(frameById('nope').id).toBe('none');
    expect(frameById('polaroid').id).toBe('polaroid');
  });
});

describe('frameAspect', () => {
  it('is undefined for free-form frames', () => {
    expect(frameAspect(frameById('none'))).toBeUndefined();
    expect(frameAspect(frameById('rounded'))).toBeUndefined();
  });

  it('pins the box aspect for fixed-content frames', () => {
    const polaroid = frameAspect(frameById('polaroid'))!;
    expect(polaroid).toBeLessThan(1);
    expect(polaroid).toBeGreaterThan(0.5);
    expect(frameAspect(frameById('square'))).toBeCloseTo(1);
    expect(frameAspect(frameById('film'))).toBeGreaterThan(1);
  });
});

describe('frame set', () => {
  it('offers a range of frames', () => {
    expect(FRAMES.length).toBeGreaterThanOrEqual(12);
    expect(FRAMES.some((f) => f.tape === 'corners')).toBe(true);
    expect(FRAMES.some((f) => f.sprockets)).toBe(true);
  });
});

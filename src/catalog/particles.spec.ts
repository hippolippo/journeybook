import { describe, expect, it } from 'vitest';
import { particleInstances } from './particles';

describe('particle system', () => {
  it('draws a tinted svg as a mask (image longhand only)', () => {
    const [p] = particleInstances([{ shape: { kind: 'svg', svg: 'z.svg', color: '#9dbfc9' } }], 'seed');
    expect(p.shapeStyle.backgroundColor).toBe('#9dbfc9');
    expect(p.shapeStyle.maskImage).toBe('url("z.svg")');
    expect(p.shapeStyle.maskImage).not.toContain('/');
  });

  it('defaults to a soft circular puff', () => {
    const [p] = particleInstances([{}], 'seed');
    expect(p.shapeStyle.borderRadius).toBe('50%');
    expect(p.shapeStyle.background).toContain('radial-gradient');
  });

  it('clamps count and names the class', () => {
    expect(particleInstances([{ name: 'smoke', count: 99 }], 's')).toHaveLength(24);
    expect(particleInstances([{ name: 'smoke', count: 0 }], 's')).toHaveLength(1);
    expect(particleInstances([{ name: 'smoke', count: 3 }], 's')[0].cls).toBe('fx-smoke');
  });

  it('is deterministic for a given seed', () => {
    const defs = [{ name: 'x', count: 4, jitter: 0.8, spawn: { spreadX: 10 } }];
    const a = particleInstances(defs, 'abc').map((p) => p.style.left);
    const b = particleInstances(defs, 'abc').map((p) => p.style.left);
    expect(a).toEqual(b);
  });
});

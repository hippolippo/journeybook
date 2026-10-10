import { describe, expect, it } from 'vitest';
import { animationStyle } from './animation';
import { particleInstances } from './particles';
import { resolveRecipes } from './recipes';

describe('effect recipes', () => {
  it('compiles the legacy sway recipe to a data-defined animation', () => {
    const { animations } = resolveRecipes([{ type: 'sway', amplitude: 3, duration: 5, origin: 'top' }], false);
    expect(animations).toHaveLength(1);
    const [sway] = animations;
    expect(sway.name).toBe('sway');
    expect(sway.origin).toBe('50% 0%');
    const style = animationStyle(sway);
    expect(style['--fx-amp']).toBe('3deg');
    expect(style.animationDuration).toBe('5s');
    expect(typeof style.animationName).toBe('string');
  });

  it('only includes glow at night', () => {
    expect(resolveRecipes([{ type: 'glow' }], false).animations).toHaveLength(0);
    const night = resolveRecipes([{ type: 'glow' }], true).animations;
    expect(night).toHaveLength(1);
    expect(night[0].bloom).toBe(true);
  });

  it('turns smoke into a generic particle system with a stable class', () => {
    const { particles } = resolveRecipes([{ type: 'smoke', count: 99 }], false);
    expect(particles).toHaveLength(1);
    const instances = particleInstances(particles, 'seed');
    expect(instances.length).toBe(8);
    expect(instances[0].cls).toBe('fx-smoke');
  });
});

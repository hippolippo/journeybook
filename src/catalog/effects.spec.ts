import { describe, expect, it } from 'vitest';
import type { EffectDef } from './types';
import { activeEffects, effectClasses, effectVars, hasGlow, smokeCount } from './effects';

describe('effects', () => {
  it('activates glow only at night', () => {
    const fx: EffectDef[] = [{ type: 'glow' }, { type: 'sway' }];
    expect(activeEffects(fx, false).map((e) => e.type)).toEqual(['sway']);
    expect(activeEffects(fx, true).map((e) => e.type)).toEqual(['glow', 'sway']);
  });

  it('builds classes and css vars', () => {
    expect(effectClasses([{ type: 'sway' }])['fx--sway']).toBe(true);
    const vars = effectVars([{ type: 'sway', amplitude: 3, duration: 5, origin: 'top' }]);
    expect(vars['--fx-amp']).toBe('3deg');
    expect(vars['--fx-dur']).toBe('5s');
    expect(vars['--fx-origin']).toBe('top');
    const floatVars = effectVars([{ type: 'float', amplitude: 8 }]);
    expect(floatVars['--fx-amp']).toBe('8px');
  });

  it('clamps smoke count and detects glow', () => {
    expect(smokeCount([{ type: 'smoke', count: 3 }])).toBe(3);
    expect(smokeCount([{ type: 'smoke', count: 99 }])).toBe(8);
    expect(smokeCount([])).toBe(0);
    expect(hasGlow([{ type: 'glow' }])).toBe(true);
    expect(hasGlow([{ type: 'sway' }])).toBe(false);
  });
});

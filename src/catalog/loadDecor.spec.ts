import { describe, expect, it } from 'vitest';
import type { EffectDef } from './types';
import { loadedRoomItems } from './loadDecor';

function firstEffect(effect: unknown): EffectDef | undefined {
  if (!effect) return undefined;
  return Array.isArray(effect) ? (effect[0] as EffectDef) : (effect as EffectDef);
}

describe('asset loader', () => {
  it('loads a sidecar-defined room item (recolor + presets + sway + inlined svg)', () => {
    const plant = loadedRoomItems.find((i) => i.id === 'trailing-plant');
    expect(plant).toBeTruthy();
    expect(plant?.colorSlots.length).toBe(2);
    expect(firstEffect(plant?.effect)?.type).toBe('sway');
    expect(plant?.presets?.length).toBeGreaterThan(0);
    expect(plant?.raw).toContain('--c-leaves');
  });

  it('reads embedded SVG metadata', () => {
    const chai = loadedRoomItems.find((i) => i.id === 'chai-cup');
    expect(chai).toBeTruthy();
    expect(firstEffect(chai?.effect)?.type).toBe('smoke');
    expect(chai?.category).toBe('trinket');
    expect(chai?.layer).toBe('surface');
  });

  it('supports repeating textures with recolouring', () => {
    const lights = loadedRoomItems.find((i) => i.id === 'fairy-lights');
    expect(lights?.repeat).toBe('x');
    expect(lights?.raw).toContain('--c-bulbs');
    expect(lights?.presets?.length).toBeGreaterThan(0);
  });

  it('auto-detects night variants and multiple effects', () => {
    const lantern = loadedRoomItems.find((i) => i.id === 'paper-lantern');
    expect(lantern).toBeTruthy();
    expect(lantern?.art.day).toBeTruthy();
    expect(lantern?.art.night).toBeTruthy();
    expect(Array.isArray(lantern?.effect)).toBe(true);
  });
});

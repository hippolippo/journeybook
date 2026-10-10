import { describe, expect, it } from 'vitest';
import type { EffectDef } from './types';
import { loadedFrames, loadedPapers, loadedRoomItems, loadedStickers } from './loadDecor';

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

  it('loads per-variant particles and resolves bare svg shape names', () => {
    const plant = loadedRoomItems.find((i) => i.id === 'trailing-plant');
    const night = plant?.artVariants?.night?.particles;
    expect(night?.length).toBe(1);
    expect(night?.[0].name).toBe('firefly');
    const shape = night?.[0].shape?.svg ?? '';
    expect(shape).toBeTruthy();
    expect(shape).not.toBe('particle-firefly.svg');
  });

  it('loads a recolourable, animated sticker', () => {
    const moon = loadedStickers.find((s) => s.id === 'sticker-moon');
    expect(moon?.colorSlots?.length).toBe(2);
    expect(moon?.presets?.length).toBeGreaterThan(0);
    expect(moon?.animations?.length).toBe(1);
    expect(moon?.raw).toContain('--c-body');
  });

  it('loads a sticker particle system with a resolved svg shape', () => {
    const burst = loadedStickers.find((s) => s.id === 'sticker-heart-burst');
    expect(burst?.particles?.length).toBe(1);
    const shape = burst?.particles?.[0].shape?.svg ?? '';
    expect(shape).toBeTruthy();
    expect(shape).not.toBe('doodle-heart.svg');
  });

  it('loads an asset-driven frame with recolour slots', () => {
    const frame = loadedFrames.find((f) => f.id === 'frame-stitched');
    expect(frame).toBeTruthy();
    expect(frame?.colorSlots?.length).toBe(1);
    expect(frame?.raw).toContain('--c-stitch');
    expect(frame?.art).toBeTruthy();
  });

  it('loads a layered paper with fill, border and corner slots', () => {
    const paper = loadedPapers.find((p) => p.id === 'paper-meadow');
    expect(paper).toBeTruthy();
    expect(paper?.fill?.colorSlots?.length).toBe(1);
    expect(paper?.border?.colorSlots?.length).toBe(1);
    expect(paper?.corners?.colorSlots?.length).toBe(2);
    expect(paper?.colorSlots?.length).toBe(4);
    expect(paper?.fill?.raw).toContain('--c-dot');
  });
});

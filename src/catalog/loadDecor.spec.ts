import { describe, expect, it } from 'vitest';
import type { EffectDef } from './types';
import { CATALOG } from './catalog';
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

  it('gives the potted plants a pot recolour slot (plus flower for the bloom)', () => {
    for (const id of ['potted-plant-2', 'potted-plant-4']) {
      const plant = loadedRoomItems.find((i) => i.id === id);
      expect(plant?.colorSlots.map((s) => s.id)).toEqual(['pot']);
      expect(plant?.raw).toContain('--c-pot');
    }
    const bloom = loadedRoomItems.find((i) => i.id === 'potted-plant-3');
    expect(bloom?.colorSlots.map((s) => s.id)).toEqual(['pot', 'flower']);
    expect(bloom?.raw).toContain('--c-flower');
    expect(bloom?.presets?.length).toBeGreaterThan(0);
    const builtin = CATALOG.find((i) => i.id === 'plant');
    expect(builtin?.colorSlots.map((s) => s.id)).toEqual(['pot']);
    expect(builtin?.raw).toContain('--c-pot');
  });

  it('loads the former built-in room items from sidecars', () => {
    const byId = new Map(loadedRoomItems.map((i) => [i.id, i]));
    for (const id of [
      'window',
      'curtain',
      'string-lights',
      'wall-shelf',
      'corkboard',
      'desk',
      'beanbag',
      'rug',
      'raccoon',
      'mug',
      'pencil-cup',
      'laptop',
      'scissors',
      'owala',
      'plant',
    ]) {
      expect(byId.get(id), `${id} should load from a sidecar`).toBeTruthy();
    }
    // The four whose file name differs from the item id still resolve to art
    // (Vite inlines these as data URLs, so compare by distinctness).
    const aliasedArts = ['window', 'mug', 'raccoon', 'plant'].map((id) => byId.get(id)?.art.day);
    for (const art of aliasedArts) expect(art).toBeTruthy();
    expect(new Set(aliasedArts).size).toBe(4);
    // Multi-slot furniture keeps its slots, presets and inlined svg.
    expect(byId.get('beanbag')?.colorSlots.map((s) => s.id)).toEqual(['body', 'trim', 'seat']);
    expect(byId.get('beanbag')?.presets?.length).toBeGreaterThan(0);
    expect(byId.get('beanbag')?.raw).toContain('--c-body');
    expect(byId.get('beanbag')?.host).toBe(true);
    expect(byId.get('rug')?.colorSlots.map((s) => s.id)).toEqual([
      'band1',
      'band2',
      'band3',
      'band4',
    ]);
    expect(byId.get('rug')?.raw).toContain('--c-band1');
    // Particles survive the move to data.
    expect(byId.get('raccoon')?.particles?.[0].name).toBe('zzz');
    // The wall clock stays built-in so its live component still renders.
    expect(CATALOG.find((i) => i.id === 'wall-clock')?.component).toBe('clock');
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

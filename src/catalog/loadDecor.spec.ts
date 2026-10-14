import { describe, expect, it } from 'vitest';
import type { EffectDef } from './types';
import { CATALOG } from './catalog';
import {
  loadedFrames,
  loadedPapers,
  loadedRoomItems,
  loadedTapes,
  mergeArtFrame,
} from './loadDecor';

function firstEffect(effect: unknown): EffectDef | undefined {
  if (!effect) return undefined;
  return Array.isArray(effect) ? (effect[0] as EffectDef) : (effect as EffectDef);
}

function viewBoxOfDataUri(uri: string): { w: number; h: number } {
  const svg = decodeURIComponent(uri.replace(/^data:image\/svg\+xml,/, ''));
  const m = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg);
  if (!m) throw new Error('no viewBox');
  return { w: Number(m[3]), h: Number(m[4]) };
}

describe('asset loader', () => {
  it('loads a sidecar-defined room item (recolor + presets + inlined svg)', () => {
    const camera = loadedRoomItems.find((i) => i.id === 'camera');
    expect(camera).toBeTruthy();
    expect(camera?.colorSlots.length).toBe(2);
    expect(camera?.presets?.length).toBeGreaterThan(0);
    expect(camera?.raw).toContain('--c-body');
  });

  it('loads the chai cup (smoke effect) from a sidecar', () => {
    const chai = loadedRoomItems.find((i) => i.id === 'chai-cup');
    expect(chai).toBeTruthy();
    expect(firstEffect(chai?.effect)?.type).toBe('smoke');
    expect(chai?.category).toBe('trinket');
    expect(chai?.layer).toBe('surface');
  });

  it('auto-detects (and merges) a day/night pair', () => {
    const puppy = loadedRoomItems.find((i) => i.id === 'bernese-mountain-puppy');
    expect(puppy).toBeTruthy();
    expect(puppy?.art.day).toBeTruthy();
    expect(puppy?.art.night).toBeTruthy();
  });

  it('loads per-variant particles and resolves bare svg shape names', () => {
    const puppy = loadedRoomItems.find((i) => i.id === 'bernese-mountain-puppy');
    const night = puppy?.artVariants?.night?.particles;
    expect(night?.length).toBe(1);
    expect(night?.[0].name).toBe('zzz');
    const shape = night?.[0].shape?.svg ?? '';
    expect(shape).toBeTruthy();
    expect(shape).not.toBe('particle-zzz.svg');
  });

  it('loads the migrated built-in tapes from sidecars', () => {
    const byId = new Map(loadedTapes.map((t) => [t.id, t]));
    expect(byId.get('washi')?.opacity).toBeCloseTo(0.85);
    expect(byId.get('masking')?.defaultColor).toBe('#f2e3c0');
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
      'medium-wall-shelf',
      'large-wall-shelf',
      'short-shelf',
      'medium-shelf',
      'tall-shelf',
      'circular-rug',
      'rectangle-rug',
      'camera',
      'bernese-mountain-puppy',
      'bedside-table',
      'desk-lamp',
      'books-1',
      'books-2',
      'records-stack',
      'conch',
      'nautilus',
      'scallop-shell',
      'snail-shell',
      'candle-warmer',
      'record-player',
      'fairy-lights-photos',
      'corkboard',
      'desk',
      'beanbag',
      'raccoon',
      'coffee-cup',
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
    const aliasedArts = ['window', 'raccoon', 'plant'].map((id) => byId.get(id)?.art.day);
    for (const art of aliasedArts) expect(art).toBeTruthy();
    expect(new Set(aliasedArts).size).toBe(3);
    // The window has a day/night pair (window-day / window-night).
    expect(byId.get('window')?.art.night).toBeTruthy();
    // Furniture can host surface items; the beanbag recolours its fabric.
    expect(byId.get('beanbag')?.host).toBe(true);
    expect(byId.get('beanbag')?.colorSlots.map((s) => s.id)).toEqual(['fabric']);
    expect(byId.get('beanbag')?.raw).toContain('--c-fabric');
    expect(byId.get('circular-rug')?.colorSlots.map((s) => s.id)).toEqual(['rug']);
    expect(byId.get('circular-rug')?.raw).toContain('--c-rug');
    expect(byId.get('medium-shelf')?.host).toBe(true);
    expect(byId.get('bernese-mountain-puppy')?.artVariants?.night?.particles?.[0].name).toBe('zzz');
    // Particles survive the move to data (per-variant on the day art).
    expect(byId.get('raccoon')?.artVariants?.day?.particles?.[0].name).toBe('zzz');
    // The wall clock stays built-in so its live component still renders.
    expect(CATALOG.find((i) => i.id === 'wall-clock')?.component).toBe('clock');
  });

  it('loads the pinned postcards as recolorable wall surface items', () => {
    const byId = new Map(loadedRoomItems.map((i) => [i.id, i]));
    for (const id of ['postcard-01', 'postcard-02', 'postcard-03', 'postcard-04']) {
      const card = byId.get(id);
      expect(card, `${id} should load from a sidecar`).toBeTruthy();
      expect(card?.category).toBe('trinket');
      expect(card?.layer).toBe('surface');
      expect(card?.band).toBe('wall');
      expect(card?.attach).toBe('shelf');
      expect(card?.colorSlots.map((s) => s.id)).toEqual(['paper', 'art', 'pin']);
      expect(card?.raw).toContain('--c-paper');
      expect(card?.raw).toContain('--c-art');
      expect(card?.raw).toContain('--c-pin');
      expect(card?.presets?.length).toBeGreaterThan(0);
    }
    // The corkboard hosts the pinned cards.
    expect(byId.get('corkboard')?.host).toBe(true);
  });

  it('adds light and music to the new decor', () => {
    const warmer = loadedRoomItems.find((i) => i.id === 'candle-warmer');
    expect(warmer?.colorSlots.map((s) => s.id)).toEqual(['shade', 'metal', 'candle']);
    expect(warmer?.lights?.length).toBe(1);

    const string = loadedRoomItems.find((i) => i.id === 'fairy-lights-photos');
    expect(string?.repeat).toBeUndefined();
    expect(string?.lights?.length).toBeGreaterThan(0);
    expect(string?.lights?.[0].slot).toBe('bulb');

    const player = loadedRoomItems.find((i) => i.id === 'record-player');
    expect(player?.particles?.length).toBe(1);
    expect(player?.particles?.[0].name).toBe('music');
    expect(player?.particles?.[0].shape?.svg ?? '').not.toBe('particle-music.svg');

    const deskLamp = loadedRoomItems.find((i) => i.id === 'desk-lamp');
    expect(deskLamp?.attach).toBe('furniture');
    expect(deskLamp?.lights?.length).toBe(1);

    const table = loadedRoomItems.find((i) => i.id === 'bedside-table');
    expect(table?.host).toBe(true);
  });

  it('loads the otter barrel as a floor-only pet with a single barrel colour', () => {
    const otter = loadedRoomItems.find((i) => i.id === 'otter-barrel');
    expect(otter).toBeTruthy();
    expect(otter?.category).toBe('pet');
    expect(otter?.layer).toBe('floor');
    expect(otter?.band).toBe('floor');
    expect(otter?.attach).toBeUndefined();
    expect(otter?.colorSlots.map((s) => s.id)).toEqual(['barrel']);
    expect(otter?.raw).toContain('--c-barrel');
    expect(otter?.raw).not.toContain('--c-water');
    // The lighter rim and the water tint are derived from the barrel colour.
    expect(otter?.raw).toContain('color-mix');
  });

  it('makes the corkboard recolourable (cork + derived patches, fixed frame, configurable rim)', () => {
    const board = loadedRoomItems.find((i) => i.id === 'corkboard');
    expect(board?.host).toBe(true);
    expect(board?.colorSlots.map((s) => s.id)).toEqual(['cork', 'rim']);
    expect(board?.raw).toContain('--c-cork');
    expect(board?.raw).toContain('--c-rim');
    expect(board?.raw).not.toContain('--c-frame');
    // Patches are derived slightly darker than the cork colour.
    expect(board?.raw).toContain('color-mix');
    expect(board?.presets?.length).toBeGreaterThan(0);
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

describe('day/night variant merging', () => {
  const day = '<svg viewBox="0 0 100 50"></svg>';
  const night = '<svg viewBox="0 0 40 80"></svg>';

  it('unions mismatched viewBoxes into one shared frame, preserving baked size', () => {
    const frame = mergeArtFrame(day, night, 1, 1)!;
    expect(frame.aspect).toBeCloseTo(100 / 80, 5);
    // The wider day art fills the width; it is bottom-aligned by default.
    expect(frame.day).toMatchObject({ x: 0, y: -30, w: 100, h: 80 });
    // The taller night art keeps its 40-unit width, centred horizontally.
    expect(frame.night).toMatchObject({ x: -30, y: 0, w: 100, h: 80 });
  });

  it('overlays the variants by the requested anchor', () => {
    const centered = mergeArtFrame(day, night, 1, 1, 'center')!;
    expect(centered.day).toMatchObject({ x: 0, y: -15, w: 100, h: 80 });
    expect(centered.night).toMatchObject({ x: -30, y: 0, w: 100, h: 80 });

    const bottomLeft = mergeArtFrame(day, night, 1, 1, 'bottom-left')!;
    expect(bottomLeft.day).toMatchObject({ x: 0, y: -30, w: 100, h: 80 });
    expect(bottomLeft.night).toMatchObject({ x: 0, y: 0, w: 100, h: 80 });
  });

  it('honours per-variant scale offsets', () => {
    const frame = mergeArtFrame(day, night, 1, 2, 'center')!;
    // Scaling night up by 2 makes it the dominant, taller variant.
    expect(frame.aspect).toBeCloseTo(100 / 160, 5);
    expect(frame.night.h).toBeCloseTo(80, 5);
  });

  it('normalises the shipped raccoon into a shared viewBox', () => {
    const raccoon = loadedRoomItems.find((i) => i.id === 'raccoon')!;
    expect(raccoon.art.day.startsWith('data:image/svg+xml')).toBe(true);
    expect(raccoon.art.night?.startsWith('data:image/svg+xml')).toBe(true);
    const dayBox = viewBoxOfDataUri(raccoon.art.day);
    const nightBox = viewBoxOfDataUri(raccoon.art.night!);
    // Both variants share the merged frame's aspect; the data URIs round their
    // viewBox to 3 decimals, so allow for that rounding here.
    expect(dayBox.w / dayBox.h).toBeCloseTo(nightBox.w / nightBox.h, 4);
    expect(raccoon.aspect).toBeCloseTo(dayBox.w / dayBox.h, 4);
  });

  it('lets rugs host surface items and never lets a host attach elsewhere', () => {
    for (const id of ['circular-rug', 'rectangle-rug']) {
      const rug = loadedRoomItems.find((i) => i.id === id);
      expect(rug?.host, `${id} should be a host`).toBe(true);
      expect(rug?.attach, `${id} should not attach`).toBeUndefined();
    }
    for (const item of loadedRoomItems) {
      if (item.host) expect(item.attach, `${item.id} is a host and must not attach`).toBeFalsy();
    }
  });
});

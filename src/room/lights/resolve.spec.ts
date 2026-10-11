import { describe, expect, it } from 'vitest';
import type { CatalogItem, LightDef } from '@/catalog/types';
import type { RoomItem } from '@/data/types';
import { resolveItemLights } from './resolve';
import { emitsLight, lightTypeDef } from './registry';

function cat(patch: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 'lantern',
    label: 'Lantern',
    category: 'wallDecor',
    layer: 'wall',
    band: 'wall',
    aspect: 0.72,
    defaultScale: 0.34,
    defaultRotation: 0,
    art: { day: 'x.svg' },
    colorSlots: [{ id: 'glass', label: 'Glass', default: '#f2b25c', palette: [], allowCustom: true }],
    ...patch,
  };
}

function item(patch: Partial<RoomItem> = {}): RoomItem {
  return {
    id: 'i1',
    catalogId: 'lantern',
    layer: 'wall',
    z: 1,
    color: {},
    desktop: { x: 0.5, y: 0.5, scale: 0.34, rotation: 0, flip: false },
    ...patch,
  };
}

describe('light resolver', () => {
  it('places a centered light and uses the type defaults', () => {
    const c = cat({ lights: [{ type: 'lamp', slot: 'glass', x: 50, y: 50 }] });
    const [light] = resolveItemLights(item(), c, item().desktop);
    const h = 0.34 * 0.74;
    expect(light.cx).toBeCloseTo(0.5, 4);
    expect(light.cy).toBeCloseTo(0 + 0.5 * 0.74 - h / 2, 4);
    expect(light.r).toBeCloseTo((lightTypeDef('lamp').radius / 100) * h, 4);
    expect(light.intensity).toBeCloseTo(lightTypeDef('lamp').intensity, 4);
    expect(light.color).toBe('#f2b25c');
  });

  it('scales brightness by the item level and the light override', () => {
    const c = cat({ lights: [{ type: 'lamp', intensity: 2 }] });
    const [light] = resolveItemLights(item({ lightLevel: 0.5 }), c, item().desktop);
    expect(light.intensity).toBeCloseTo(2 * lightTypeDef('lamp').intensity * 0.5, 4);
  });

  it('supports multiple light sources, only lighting marked parts', () => {
    const defs: LightDef[] = [
      { id: 'a', type: 'lamp', x: 20, y: 30 },
      { id: 'b', type: 'candle', x: 80, y: 70 },
    ];
    const lights = resolveItemLights(item(), cat({ lights: defs }), item().desktop);
    expect(lights).toHaveLength(2);
    expect(lights[0].key).not.toBe(lights[1].key);
    expect(lights[0].cx).toBeLessThan(lights[1].cx);
    expect(lights[0].r).not.toBe(lights[1].r);
  });

  it('synthesizes a lamp light from a legacy glow effect', () => {
    const c = cat({ effect: [{ type: 'glow', slot: 'glass', duration: 3.5 }] });
    const lights = resolveItemLights(item(), c, item().desktop);
    expect(lights).toHaveLength(1);
    expect(lights[0].color).toBe('#f2b25c');
  });

  it('prefers explicit lights over a glow effect', () => {
    const c = cat({
      effect: [{ type: 'glow', color: '#000000' }],
      lights: [{ type: 'window', color: '#cfe0ff' }],
    });
    const lights = resolveItemLights(item(), c, item().desktop);
    expect(lights).toHaveLength(1);
    expect(lights[0].color).toBe('#cfe0ff');
  });

  it('derives distribution from the fixture type and lets a light override it', () => {
    const [candle] = resolveItemLights(item(), cat({ lights: [{ type: 'candle' }] }), item().desktop);
    expect(candle.distribution).toBe('point');
    const [win] = resolveItemLights(item(), cat({ lights: [{ type: 'window' }] }), item().desktop);
    expect(win.distribution).toBe('ambient');
    const [custom] = resolveItemLights(
      item(),
      cat({ lights: [{ type: 'lamp', distribution: 'diffuse' }] }),
      item().desktop,
    );
    expect(custom.distribution).toBe('diffuse');
  });

  it('resolves directional cone parameters for spot/wash, and marks omni as non-directional', () => {
    const [spot] = resolveItemLights(
      item(),
      cat({ lights: [{ type: 'lamp', distribution: 'spot' }] }),
      item().desktop,
    );
    expect(spot.directional).toBe(true);
    expect(spot.angle).toBeGreaterThan(0);
    expect(spot.penumbra).toBeGreaterThan(0);
    const [custom] = resolveItemLights(
      item(),
      cat({ lights: [{ type: 'lamp', distribution: 'spot', angle: 30, direction: 45, penumbra: 0.1 }] }),
      item().desktop,
    );
    expect(custom.angle).toBe(30);
    expect(custom.direction).toBe(45);
    expect(custom.penumbra).toBe(0.1);
    const [pt] = resolveItemLights(
      item(),
      cat({ lights: [{ type: 'lamp', distribution: 'point' }] }),
      item().desktop,
    );
    expect(pt.directional).toBe(false);
  });

  it('tiles a repeating light with the art and scales x by the stage aspect', () => {
    const c = cat({
      repeat: 'x',
      aspect: 2,
      lights: [{ type: 'string', repeat: 'x', x: 10, y: 50, radius: 40 }],
    });
    const p = { x: 0.5, y: 0.5, scale: 0.1, rotation: 0, flip: false };
    const lights = resolveItemLights(item(), c, p, 1.5);
    expect(lights.length).toBeGreaterThan(1);
    const h = 0.1 * 0.74;
    const pitch = (h * 2) / 1.5;
    expect(lights[1].cx - lights[0].cx).toBeCloseTo(pitch, 4);
    expect(lights[0].r).toBeCloseTo((40 / 100) * h, 4);
  });
});

describe('emitsLight', () => {
  it('detects declared lights, glow effects and light particles', () => {
    expect(emitsLight(cat({ lights: [{ type: 'lamp' }] }))).toBe(true);
    expect(emitsLight(cat({ effect: [{ type: 'glow' }] }))).toBe(true);
    expect(emitsLight(cat({ particles: [{ light: true }] }))).toBe(true);
    expect(emitsLight(cat({ particles: [{ name: 'smoke' }] }))).toBe(false);
    expect(emitsLight(cat())).toBe(false);
  });
});

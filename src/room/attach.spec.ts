import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '@/catalog/types';
import { getCatalogItem } from '@/catalog/catalog';
import { canHost } from './attach';

function cat(over: Partial<CatalogItem>): CatalogItem {
  return {
    id: 'x',
    label: 'x',
    category: 'furniture',
    layer: 'floor',
    band: 'floor',
    aspect: 1,
    defaultScale: 0.2,
    defaultRotation: 0,
    art: { day: 'x.svg' },
    colorSlots: [],
    ...over,
  };
}

describe('canHost', () => {
  it('lets a floor trinket rest on any host surface (desk or shelf)', () => {
    const trinket = cat({ layer: 'surface', attach: 'furniture' });
    expect(canHost(trinket, cat({ category: 'furniture', host: true }))).toBe(true);
    expect(canHost(trinket, cat({ category: 'wallDecor', host: true }))).toBe(true);
    expect(canHost(trinket, cat({ category: 'furniture' }))).toBe(false); // not a host
  });

  it('restricts shelf-only items to wall decor hosts', () => {
    const item = cat({ layer: 'surface', attach: 'shelf' });
    expect(canHost(item, cat({ category: 'wallDecor', host: true }))).toBe(true);
    expect(canHost(item, cat({ category: 'furniture', host: true }))).toBe(false);
  });

  it('never lets a surface item host another item', () => {
    expect(canHost(cat({ layer: 'surface' }), cat({ layer: 'surface', host: true, category: 'furniture' }))).toBe(false);
  });

  it('lets rugs (floor furniture) host surface items', () => {
    const rug = getCatalogItem('circular-rug');
    expect(rug?.host).toBe(true);
    expect(canHost(getCatalogItem('potted-plant-2'), rug)).toBe(true);
  });

  it('never lets a non-surface item attach to a host', () => {
    expect(canHost(cat({ layer: 'floor' }), cat({ category: 'furniture', host: true }))).toBe(false);
    expect(canHost(cat({ layer: 'wall' }), cat({ category: 'furniture', host: true }))).toBe(false);
  });

  it('makes the puppy attachable to furniture', () => {
    const puppy = getCatalogItem('bernese-mountain-puppy');
    expect(puppy?.layer).toBe('surface');
    expect(canHost(puppy, getCatalogItem('desk'))).toBe(true);
  });
});

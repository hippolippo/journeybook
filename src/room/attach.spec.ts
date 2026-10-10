import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '@/catalog/types';
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
});

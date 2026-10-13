import type { CatalogItem } from './types';
import { loadedRoomItems } from './loadDecor';

import clockArt from '@/assets/svg/wall-clock.svg';

/** Built-in items that still need bespoke component code (the live wall clock). */
const BUILTIN: CatalogItem[] = [
  {
    id: 'wall-clock',
    label: 'Wall clock',
    category: 'wallDecor',
    layer: 'wall',
    band: 'wall',
    aspect: 120 / 130,
    defaultScale: 0.13,
    defaultRotation: 0,
    art: { day: clockArt },
    colorSlots: [],
    component: 'clock',
  },
];

/** Built-in items plus any loaded from artist asset definitions. */
export const CATALOG: CatalogItem[] = [...BUILTIN, ...loadedRoomItems];

/**
 * Indexed once so per-item lookups during rendering stay O(1). Mirrors
 * `Array.prototype.find` semantics: the first definition of an id wins.
 */
const CATALOG_BY_ID = new Map<string, CatalogItem>();
for (const item of CATALOG) {
  if (!CATALOG_BY_ID.has(item.id)) CATALOG_BY_ID.set(item.id, item);
}

export function getCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG_BY_ID.get(id);
}

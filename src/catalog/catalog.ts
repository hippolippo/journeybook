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
    defaultScale: 0.22,
    defaultRotation: 0,
    art: { day: clockArt },
    colorSlots: [],
    component: 'clock',
  },
];

/** Built-in items plus any loaded from artist asset definitions. */
export const CATALOG: CatalogItem[] = [...BUILTIN, ...loadedRoomItems];

export function getCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id);
}

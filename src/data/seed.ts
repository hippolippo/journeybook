import type { AppData } from '@/data/types';
import { DEFAULT_ROOM } from '@/catalog/defaultLayout';

/** A brand-new, empty library: the default room with no items and no books. */
export function createEmptyData(): AppData {
  return {
    version: 1,
    content: { nodes: [], pages: [], elements: [], media: [] },
    room: { ...DEFAULT_ROOM },
    roomItems: [],
    events: [],
  };
}

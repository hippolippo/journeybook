import type { RoomItem } from '@/data/types';

/**
 * Items whose rendered box contains a viewport point, ordered front-to-back by
 * depth. Used to cycle selection through overlapping items in the editor.
 */
export function itemsAtPoint(items: RoomItem[], x: number, y: number): RoomItem[] {
  const hits: RoomItem[] = [];
  for (const item of items) {
    const el = document.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement | null;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hits.push(item);
  }
  return hits.sort((a, b) => b.z - a.z);
}

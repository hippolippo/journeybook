import type { CatalogItem } from '@/catalog/types';
import { getCatalogItem } from '@/catalog/catalog';

/** Whether `host` can hold `child` (a surface item), honouring the child's `attach`. */
export function canHost(child: CatalogItem | undefined, host: CatalogItem | undefined): boolean {
  if (!child || !host) return false;
  if (!host.host || host.layer === 'surface') return false;
  const attach = child.attach ?? 'any';
  if (attach === 'shelf') return host.category === 'wallDecor';
  return true;
}

/**
 * The topmost host-capable item under a viewport point (skipping items that
 * can't host and the dragged item itself).
 */
export function hostAt(
  x: number,
  y: number,
  child: CatalogItem | undefined,
  skipId?: string,
): { id: string; catalogId: string } | null {
  const stack = document.elementsFromPoint(x, y) as HTMLElement[];
  for (const el of stack) {
    const holder = el.closest('[data-item-id]') as HTMLElement | null;
    if (!holder) continue;
    const id = holder.dataset.itemId;
    const catalogId = holder.dataset.catalog;
    if (!id || !catalogId || id === skipId) continue;
    if (canHost(child, getCatalogItem(catalogId))) return { id, catalogId };
  }
  return null;
}

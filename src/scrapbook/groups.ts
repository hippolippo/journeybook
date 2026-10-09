import type { PageElement, PageGroup } from '@/data/types';
import { stickerById } from './decor';

/** Layers are grouped front-to-back; the pane lists front (top) first. */
export const DEFAULT_GROUPS: PageGroup[] = [
  { id: 'g-tape', name: 'Tape' },
  { id: 'g-stickers', name: 'Stickers' },
  { id: 'g-notes', name: 'Notes' },
  { id: 'g-photos', name: 'Photos' },
];

export function defaultGroupId(kind: PageElement['kind']): string {
  switch (kind) {
    case 'photo':
    case 'image':
      return 'g-photos';
    case 'note':
      return 'g-notes';
    case 'sticker':
      return 'g-stickers';
    case 'tape':
      return 'g-tape';
    default:
      return 'g-photos';
  }
}

export function ensureGroups(groups?: PageGroup[]): PageGroup[] {
  return groups && groups.length ? groups.map((g) => ({ ...g })) : DEFAULT_GROUPS.map((g) => ({ ...g }));
}

/** Short human label for a element row in the layers pane. */
export function elementLabel(el: PageElement): string {
  if (el.name) return el.name;
  switch (el.kind) {
    case 'photo':
      return el.caption || 'Photo';
    case 'image':
      return el.caption || 'Photo';
    case 'note':
      return el.text ? el.text.slice(0, 24) : 'Note';
    case 'sticker':
      return stickerById(el.icon).label;
    case 'tape':
      return el.style === 'masking' ? 'Masking tape' : 'Washi tape';
    default:
      return 'Item';
  }
}

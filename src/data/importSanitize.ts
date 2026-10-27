import type { PageElement } from './types';
import { newId } from '@/utils/id';
import { STICKERS, TAPES } from '@/scrapbook/decor';
import { FRAMES } from '@/scrapbook/frames';
import { NOTE_PAPERS } from '@/scrapbook/notes';

const PHOTO_STYLES = new Set(['sunset', 'sea', 'forest', 'night', 'blush', 'meadow']);
const NOTE_PAPER_IDS = new Set([...NOTE_PAPERS.map((paper) => paper.id), 'none']);
const STICKER_IDS = new Set(STICKERS.map((sticker) => sticker.id));
const TAPE_IDS = new Set(TAPES.map((tape) => tape.id));
const FRAME_IDS = new Set(FRAMES.map((frame) => frame.id));
const ELEMENT_KINDS = new Set(['photo', 'note', 'sticker', 'image', 'tape']);

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Re-key an imported page element and discard references that cannot resolve.
 * Shared by whole-library and single-book imports so neither can create dangling
 * page/media/preset references.
 */
export function cleanImportedElement(
  source: PageElement,
  pageId: string,
  mediaMap: Map<string, string>,
  groupMap: Map<string, string>,
  presetMap: Map<string, string>,
): PageElement | null {
  if (!source || typeof source !== 'object' || !ELEMENT_KINDS.has(source.kind)) return null;
  if (
    !isFiniteNumber(source.x) ||
    !isFiniteNumber(source.y) ||
    !isFiniteNumber(source.w) ||
    !isFiniteNumber(source.h) ||
    !isFiniteNumber(source.rotation) ||
    !isFiniteNumber(source.z) ||
    !isFiniteNumber(source.opacity)
  ) {
    return null;
  }
  const element = {
    ...source,
    id: newId(),
    pageId,
    groupId: source.groupId ? groupMap.get(source.groupId) : undefined,
  } as PageElement;
  if (element.kind === 'image') {
    const mediaId = mediaMap.get(element.mediaId);
    if (!mediaId) return null;
    element.mediaId = mediaId;
    if (element.frame && !FRAME_IDS.has(element.frame)) delete element.frame;
    if (element.preset) {
      const preset = presetMap.get(element.preset);
      if (preset) element.preset = preset;
      else delete element.preset;
    }
  }
  if (element.kind === 'sticker' && !STICKER_IDS.has(element.icon)) return null;
  if (element.kind === 'tape' && !TAPE_IDS.has(element.style)) return null;
  if (element.kind === 'photo' && !PHOTO_STYLES.has(element.photo)) return null;
  if (element.kind === 'note' && element.paper && !NOTE_PAPER_IDS.has(element.paper)) {
    delete element.paper;
  }
  return element;
}

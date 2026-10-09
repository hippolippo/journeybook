import type { TapeStyle } from '@/data/types';
import heartArt from '@/assets/svg/doodle-heart.svg';
import starArt from '@/assets/svg/doodle-star.svg';
import sparkleArt from '@/assets/svg/sparkle.svg';
import flowerArt from '@/assets/svg/pressed-flower.svg';
import cornerArt from '@/assets/svg/corner-flower.svg';
import postcardArt from '@/assets/svg/postcard.svg';
import paperclipArt from '@/assets/svg/paperclip.svg';
import catArt from '@/assets/svg/cat-sleeping.svg';
import washiTape from '@/assets/svg/washi-tape.svg';
import maskingTape from '@/assets/svg/masking-tape.svg';
import { loadedStickers, loadedTapes } from '@/catalog/loadDecor';

export const NOTE_COLORS = [
  '#f6e8a8',
  '#f7c9c9',
  '#cfe3c5',
  '#cfe0ea',
  '#e8d3b0',
  '#fdf8ef',
  '#e6dcf0',
];

export const STICKER_COLORS = [
  '#d98c8c',
  '#e8b4af',
  '#c97b5a',
  '#d9a94e',
  '#9caf88',
  '#7e8f6b',
  '#9dbfc9',
  '#b99362',
  '#fcf7ec',
];

export const TAPE_COLORS = [
  '#e8b4af',
  '#f6e8a8',
  '#cfe3c5',
  '#cfe0ea',
  '#e6dcf0',
  '#f2e3c0',
  '#fdf8ef',
  '#d9a94e',
];

export interface StickerDef {
  id: string;
  label: string;
  art: string;
  /** true = a silhouette that can be recolored via masking. */
  tint: boolean;
  aspect: number;
  defaultColor?: string;
}

const BUILTIN_STICKERS: StickerDef[] = [
  { id: 'heart', label: 'Heart', art: heartArt, tint: true, aspect: 1, defaultColor: '#d98c8c' },
  { id: 'star', label: 'Star', art: starArt, tint: true, aspect: 1, defaultColor: '#d9a94e' },
  { id: 'sparkle', label: 'Sparkle', art: sparkleArt, tint: true, aspect: 1, defaultColor: '#d9a94e' },
  { id: 'flower', label: 'Flower', art: flowerArt, tint: false, aspect: 1 },
  { id: 'corner', label: 'Blossoms', art: cornerArt, tint: false, aspect: 1 },
  { id: 'postcard', label: 'Postcard', art: postcardArt, tint: false, aspect: 1.5 },
  { id: 'paperclip', label: 'Paperclip', art: paperclipArt, tint: false, aspect: 1 },
  { id: 'cat', label: 'Cat', art: catArt, tint: false, aspect: 1.4 },
];

export const STICKERS: StickerDef[] = [...BUILTIN_STICKERS, ...loadedStickers];

export function stickerById(id: string): StickerDef {
  return STICKERS.find((s) => s.id === id) ?? STICKERS[0];
}

export interface TapeDef {
  id: TapeStyle;
  label: string;
  mask: string;
  aspect: number;
  defaultColor: string;
  opacity: number;
}

const BUILTIN_TAPES: TapeDef[] = [
  { id: 'washi', label: 'Washi', mask: washiTape, aspect: 220 / 64, defaultColor: '#e8b4af', opacity: 0.85 },
  { id: 'masking', label: 'Masking', mask: maskingTape, aspect: 220 / 64, defaultColor: '#f2e3c0', opacity: 0.92 },
];

export const TAPES: TapeDef[] = [...BUILTIN_TAPES, ...loadedTapes];

export function tapeById(id: TapeStyle): TapeDef {
  return TAPES.find((t) => t.id === id) ?? TAPES[0];
}

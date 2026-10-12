import type { TapeStyle } from '@/data/types';
import type { ColorPreset, ColorSlot } from '@/catalog/types';
import type { AnimationDef } from '@/catalog/animation';
import type { ParticleDef } from '@/catalog/particles';
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
  /** Inlined SVG for multi-slot recolouring (uses `var(--c-<slot>, …)`). */
  raw?: string;
  colorSlots?: ColorSlot[];
  presets?: ColorPreset[];
  animations?: AnimationDef[];
  particles?: ParticleDef[];
}

/** Every sticker is defined by an artist asset (`kind: "sticker"`). */
export const STICKERS: StickerDef[] = loadedStickers;

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
  /** Inlined SVG for multi-slot recolouring (uses `var(--c-<slot>, …)`). */
  raw?: string;
  colorSlots?: ColorSlot[];
  presets?: ColorPreset[];
  animations?: AnimationDef[];
  particles?: ParticleDef[];
}

/** Every tape is defined by an artist asset (`kind: "tape"`). */
export const TAPES: TapeDef[] = loadedTapes;

export function tapeById(id: TapeStyle): TapeDef {
  return TAPES.find((t) => t.id === id) ?? TAPES[0];
}

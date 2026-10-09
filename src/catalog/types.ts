import type { Layer } from '@/data/types';

export type Category = 'wallpaper' | 'flooring' | 'furniture' | 'wallDecor' | 'trinket' | 'pet';
export type Band = 'wall' | 'floor';

export interface ColorSlot {
  id: string;
  label: string;
  default: string;
  palette: string[];
  allowCustom: boolean;
}

/** Animated decor effects, configured per asset (no code change needed). */
export type EffectType = 'sway' | 'glow' | 'smoke' | 'float' | 'flicker' | 'twinkle';

export interface EffectDef {
  type: EffectType;
  /** sway: swing angle in degrees · float: vertical travel in px. */
  amplitude?: number;
  /** Seconds. */
  duration?: number;
  /** Seconds. */
  delay?: number;
  /** glow / smoke colour. */
  color?: string;
  /** smoke: number of puffs. */
  count?: number;
  /** sway origin. */
  origin?: 'top' | 'bottom';
}

/** A named multi-slot colour configuration. */
export interface ColorPreset {
  id: string;
  label: string;
  colors: Record<string, string>;
}

export interface CatalogItem {
  id: string;
  label: string;
  category: Category;
  layer: Layer;
  band: Band;
  aspect: number;
  defaultScale: number;
  defaultRotation: number;
  art: { day: string; night?: string };
  colorSlots: ColorSlot[];
  attach?: 'furniture' | 'shelf' | 'any';
  component?: 'clock';
  raw?: string;
  effect?: EffectDef | EffectDef[] | null;
  presets?: ColorPreset[];
  /** Tile the art across the band instead of drawing a single instance. */
  repeat?: 'x' | 'y' | 'both';
}

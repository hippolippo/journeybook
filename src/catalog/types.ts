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
}

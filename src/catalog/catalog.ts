import type { CatalogItem, ColorSlot } from './types';

import windowArt from '@/assets/svg/window-cozy.svg';
import curtainArt from '@/assets/svg/curtain.svg';
import lightsArt from '@/assets/svg/string-lights.svg';
import shelfArt from '@/assets/svg/wall-shelf.svg';
import corkboardArt from '@/assets/svg/corkboard.svg';
import clockArt from '@/assets/svg/wall-clock.svg';
import deskArt from '@/assets/svg/desk.svg';
import beanbagArt from '@/assets/svg/beanbag.svg';
import rugArt from '@/assets/svg/rug.svg';
import raccoonArt from '@/assets/svg/raccoon-sleeping.svg';
import mugArt from '@/assets/svg/mug-tea.svg';
import cupArt from '@/assets/svg/pencil-cup.svg';
import laptopArt from '@/assets/svg/laptop.svg';
import scissorsArt from '@/assets/svg/scissors.svg';
import owalaArt from '@/assets/svg/owala.svg';
import plantArt from '@/assets/svg/potted-plant.svg';

import beanbagRaw from '@/assets/svg/beanbag.svg?raw';
import rugRaw from '@/assets/svg/rug.svg?raw';

const PALETTE = [
  '#d98c8c',
  '#e8b4af',
  '#c97b5a',
  '#d9a94e',
  '#9caf88',
  '#7e8f6b',
  '#9dbfc9',
  '#d3b184',
  '#b99362',
  '#fcf7ec',
  '#4a3b2e',
];

function slot(id: string, label: string, def: string): ColorSlot {
  return { id, label, default: def, palette: PALETTE, allowCustom: true };
}

export const CATALOG: CatalogItem[] = [
  {
    id: 'window',
    label: 'Window',
    category: 'wallDecor',
    layer: 'wall',
    band: 'wall',
    aspect: 260 / 340,
    defaultScale: 0.4,
    defaultRotation: 0,
    art: { day: windowArt },
    colorSlots: [],
  },
  {
    id: 'curtain',
    label: 'Curtain',
    category: 'wallDecor',
    layer: 'wall',
    band: 'wall',
    aspect: 130 / 360,
    defaultScale: 0.56,
    defaultRotation: 0,
    art: { day: curtainArt },
    colorSlots: [],
  },
  {
    id: 'string-lights',
    label: 'String lights',
    category: 'wallDecor',
    layer: 'wall',
    band: 'wall',
    aspect: 420 / 150,
    defaultScale: 0.22,
    defaultRotation: 0,
    art: { day: lightsArt },
    colorSlots: [],
  },
  {
    id: 'wall-shelf',
    label: 'Wall shelf',
    category: 'wallDecor',
    layer: 'wall',
    band: 'wall',
    aspect: 280 / 170,
    defaultScale: 0.22,
    defaultRotation: 0,
    art: { day: shelfArt },
    colorSlots: [],
  },
  {
    id: 'corkboard',
    label: 'Corkboard',
    category: 'wallDecor',
    layer: 'wall',
    band: 'wall',
    aspect: 340 / 250,
    defaultScale: 0.38,
    defaultRotation: 0,
    art: { day: corkboardArt },
    colorSlots: [],
  },
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
  {
    id: 'desk',
    label: 'Desk',
    category: 'furniture',
    layer: 'floor',
    band: 'floor',
    aspect: 440 / 260,
    defaultScale: 1,
    defaultRotation: 0,
    art: { day: deskArt },
    colorSlots: [],
  },
  {
    id: 'beanbag',
    label: 'Bean bag',
    category: 'furniture',
    layer: 'floor',
    band: 'floor',
    aspect: 260 / 180,
    defaultScale: 0.92,
    defaultRotation: 0,
    art: { day: beanbagArt },
    colorSlots: [
      slot('body', 'Fabric', '#c97b5a'),
      slot('trim', 'Seams', '#a85f43'),
      slot('seat', 'Seat', '#b06a4b'),
    ],
    raw: beanbagRaw,
  },
  {
    id: 'rug',
    label: 'Rug',
    category: 'furniture',
    layer: 'floor',
    band: 'floor',
    aspect: 360 / 150,
    defaultScale: 0.5,
    defaultRotation: 0,
    art: { day: rugArt },
    colorSlots: [
      slot('band1', 'Outer', '#c97b5a'),
      slot('band2', 'Ring 2', '#d98c8c'),
      slot('band3', 'Ring 3', '#e8b4af'),
      slot('band4', 'Center', '#d9a94e'),
    ],
    raw: rugRaw,
  },
  {
    id: 'raccoon',
    label: 'Raccoon',
    category: 'pet',
    layer: 'surface',
    band: 'floor',
    aspect: 240 / 170,
    defaultScale: 0.4,
    defaultRotation: 0,
    art: { day: raccoonArt },
    colorSlots: [],
    attach: 'furniture',
  },
  {
    id: 'mug',
    label: 'Mug',
    category: 'trinket',
    layer: 'surface',
    band: 'floor',
    aspect: 130 / 130,
    defaultScale: 0.14,
    defaultRotation: -4,
    art: { day: mugArt },
    colorSlots: [],
    attach: 'furniture',
  },
  {
    id: 'pencil-cup',
    label: 'Pencil cup',
    category: 'trinket',
    layer: 'surface',
    band: 'floor',
    aspect: 140 / 190,
    defaultScale: 0.17,
    defaultRotation: 4,
    art: { day: cupArt },
    colorSlots: [],
    attach: 'furniture',
  },
  {
    id: 'laptop',
    label: 'Laptop',
    category: 'trinket',
    layer: 'surface',
    band: 'floor',
    aspect: 200 / 150,
    defaultScale: 0.22,
    defaultRotation: -2,
    art: { day: laptopArt },
    colorSlots: [],
    attach: 'furniture',
  },
  {
    id: 'scissors',
    label: 'Scissors',
    category: 'trinket',
    layer: 'surface',
    band: 'floor',
    aspect: 190 / 120,
    defaultScale: 0.12,
    defaultRotation: 12,
    art: { day: scissorsArt },
    colorSlots: [],
    attach: 'furniture',
  },
  {
    id: 'owala',
    label: 'Owala bottle',
    category: 'trinket',
    layer: 'surface',
    band: 'floor',
    aspect: 84 / 176,
    defaultScale: 0.2,
    defaultRotation: -3,
    art: { day: owalaArt },
    colorSlots: [],
    attach: 'furniture',
  },
  {
    id: 'plant',
    label: 'Plant',
    category: 'trinket',
    layer: 'surface',
    band: 'floor',
    aspect: 140 / 170,
    defaultScale: 0.18,
    defaultRotation: 3,
    art: { day: plantArt },
    colorSlots: [],
    attach: 'furniture',
  },
];

export function getCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id);
}

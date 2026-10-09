import type { AppData, Content, PageElement, ScrapNode, ScrapPage } from '@/data/types';
import { DEFAULT_ROOM, createDefaultRoomItems } from '@/catalog/defaultLayout';

interface SeedPageEl {
  kind: 'photo' | 'note' | 'sticker';
  photo?: 'sunset' | 'sea' | 'forest' | 'night' | 'blush' | 'meadow';
  caption?: string;
  text?: string;
  icon?: 'heart' | 'star' | 'sparkle';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  z?: number;
}

interface SeedPage {
  els: SeedPageEl[];
}

const NODES: ScrapNode[] = [
  { id: 'f1', type: 'folder', title: 'Us', parentId: null, tags: [], order: 0 },
  { id: 'f2', type: 'folder', title: 'Trips', parentId: null, tags: [], order: 1 },
  { id: 'b7', type: 'scrapbook', title: 'Everyday', parentId: null, tags: [], order: 2, cover: 'sage' },
  { id: 'b1', type: 'scrapbook', title: 'First hello', parentId: 'f1', tags: [], order: 0, cover: 'rose' },
  { id: 'b2', type: 'scrapbook', title: 'Little things', parentId: 'f1', tags: [], order: 1, cover: 'mustard' },
  { id: 'f3', type: 'folder', title: 'Inside jokes', parentId: 'f1', tags: [], order: 2 },
  { id: 'b3', type: 'scrapbook', title: 'The raccoon incident', parentId: 'f3', tags: [], order: 0, cover: 'terracotta' },
  { id: 'f4', type: 'folder', title: '2024', parentId: 'f2', tags: [], order: 0 },
  { id: 'b4', type: 'scrapbook', title: 'Lisbon', parentId: 'f4', tags: [], order: 0, cover: 'sky' },
  { id: 'b5', type: 'scrapbook', title: 'Cabin weekend', parentId: 'f4', tags: [], order: 1, cover: 'kraft' },
  { id: 'b6', type: 'scrapbook', title: 'Someday list', parentId: 'f2', tags: [], order: 1, cover: 'rose' },
];

const PAGES: Record<string, SeedPage[]> = {
  b1: [
    {
      els: [
        { kind: 'photo', photo: 'blush', caption: 'us, day one', x: 0.42, y: 0.34, w: 0.56, h: 0.52 },
        { kind: 'sticker', icon: 'heart', x: 0.2, y: 0.24, w: 0.16, h: 0.16, rotation: -8 },
        { kind: 'note', text: 'I still get butterflies when your name pops up.', x: 0.5, y: 0.78, w: 0.66, h: 0.26, rotation: 2 },
      ],
    },
    {
      els: [
        { kind: 'photo', photo: 'night', caption: '3am talks', x: 0.55, y: 0.36, w: 0.56, h: 0.52 },
        { kind: 'note', text: 'We said we would just say goodnight. We did not.', x: 0.42, y: 0.78, w: 0.66, h: 0.24, rotation: -2 },
      ],
    },
    {
      els: [
        { kind: 'sticker', icon: 'sparkle', x: 0.32, y: 0.3, w: 0.18, h: 0.18 },
        { kind: 'note', text: 'Twelve hours apart, zero kilometres between us.', x: 0.5, y: 0.56, w: 0.72, h: 0.26, rotation: 3 },
      ],
    },
  ],
  b2: [
    {
      els: [
        { kind: 'photo', photo: 'meadow', caption: 'your laugh, Wednesday', x: 0.44, y: 0.36, w: 0.58, h: 0.54 },
        { kind: 'sticker', icon: 'star', x: 0.2, y: 0.72, w: 0.16, h: 0.16, rotation: 6 },
      ],
    },
    {
      els: [
        { kind: 'note', text: 'You hum when you are happy. I noticed. I always notice.', x: 0.5, y: 0.46, w: 0.76, h: 0.3, rotation: -2 },
      ],
    },
  ],
  b3: [
    {
      els: [
        { kind: 'photo', photo: 'forest', caption: 'the culprit', x: 0.5, y: 0.36, w: 0.6, h: 0.54 },
        { kind: 'note', text: 'We do not speak of the bins.', x: 0.48, y: 0.8, w: 0.72, h: 0.22, rotation: -3 },
      ],
    },
  ],
  b4: [
    {
      els: [
        { kind: 'photo', photo: 'sunset', caption: 'the miradouro', x: 0.42, y: 0.34, w: 0.56, h: 0.52 },
        { kind: 'sticker', icon: 'sparkle', x: 0.22, y: 0.68, w: 0.16, h: 0.16, rotation: 10 },
      ],
    },
    {
      els: [
        { kind: 'photo', photo: 'sea', caption: 'tram 28, again', x: 0.56, y: 0.34, w: 0.56, h: 0.52 },
        { kind: 'note', text: 'Pastéis de nata count: eleven. No regrets.', x: 0.48, y: 0.78, w: 0.7, h: 0.24, rotation: -2 },
      ],
    },
    {
      els: [
        { kind: 'note', text: 'You fell asleep on my shoulder and I did not move for an hour.', x: 0.5, y: 0.44, w: 0.78, h: 0.3, rotation: 1 },
      ],
    },
    {
      els: [
        { kind: 'sticker', icon: 'heart', x: 0.36, y: 0.34, w: 0.2, h: 0.2, rotation: -6 },
        { kind: 'note', text: 'Next time: the Algarve.', x: 0.5, y: 0.64, w: 0.6, h: 0.24, rotation: 2 },
      ],
    },
  ],
  b6: [
    {
      els: [
        { kind: 'note', text: 'Things we will do when the distance is done:', x: 0.5, y: 0.36, w: 0.78, h: 0.24, rotation: -2 },
        { kind: 'note', text: '1. Adopt a cat with an unimpressed face.', x: 0.5, y: 0.62, w: 0.72, h: 0.22, rotation: 1 },
        { kind: 'sticker', icon: 'star', x: 0.76, y: 0.8, w: 0.16, h: 0.16, rotation: -10 },
      ],
    },
  ],
};

export function createSeedData(): AppData {
  const pages: ScrapPage[] = [];
  const elements: PageElement[] = [];
  let pe = 0;

  for (const node of NODES) {
    if (node.type !== 'scrapbook') continue;
    const seedPages = PAGES[node.id] ?? [];
    seedPages.forEach((seedPage, index) => {
      const pageId = `${node.id}-p${index + 1}`;
      pages.push({ id: pageId, bookId: node.id, index });
      seedPage.els.forEach((el, elIndex) => {
        const base = {
          id: `e${++pe}`,
          pageId,
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
          rotation: el.rotation ?? 0,
          z: el.z ?? elIndex + 1,
          opacity: 1,
        };
        if (el.kind === 'photo') {
          elements.push({ ...base, kind: 'photo', photo: el.photo ?? 'sunset', caption: el.caption });
        } else if (el.kind === 'note') {
          elements.push({ ...base, kind: 'note', text: el.text ?? '' });
        } else {
          elements.push({ ...base, kind: 'sticker', icon: el.icon ?? 'heart' });
        }
      });
    });
  }

  const content: Content = { nodes: NODES, pages, elements, media: [] };
  return {
    version: 1,
    content,
    room: { ...DEFAULT_ROOM },
    roomItems: createDefaultRoomItems(),
    events: [],
  };
}

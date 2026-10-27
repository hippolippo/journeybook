import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createEmptyData } from '@/data/seed';
import type { PageElement } from '@/data/types';
import { useAppStore } from './app';

const image: PageElement = {
  id: 'e1',
  pageId: 'p1',
  kind: 'image',
  mediaId: 'm1',
  x: 0.5,
  y: 0.5,
  w: 0.4,
  h: 0.3,
  rotation: 0,
  z: 1,
  opacity: 1,
};

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('referential cleanup', () => {
  it('trashes placed image elements with the album photo', async () => {
    const app = useAppStore();
    app.data = createEmptyData();
    app.data.content = {
      nodes: [{ id: 'n1', type: 'scrapbook', title: 'Us', parentId: null, tags: [], order: 0 }],
      pages: [{ id: 'p1', bookId: 'n1', index: 0 }],
      elements: [image],
      media: [{ id: 'm1', bookId: 'n1', name: 'photo.jpg', created: 1 }],
    };

    await app.removeMedia('m1');

    expect(app.data.content.media).toHaveLength(0);
    expect(app.data.content.elements).toHaveLength(0);
    expect(app.trash).toHaveLength(1);
    expect(app.trash[0]?.records.map((record) => record.collection)).toEqual(['media', 'elements']);
  });

  it('detaches children when a room host is removed', () => {
    const app = useAppStore();
    app.data = createEmptyData();
    app.data.roomItems = [
      {
        id: 'host',
        catalogId: 'floor-lamp',
        layer: 'surface',
        z: 1,
        color: {},
        desktop: { x: 0.5, y: 0.5, scale: 0.2, rotation: 0, flip: false },
      },
      {
        id: 'child',
        catalogId: 'candle',
        layer: 'surface',
        z: 2,
        attachTo: 'host',
        color: {},
        desktop: { x: 0.5, y: 0.5, scale: 0.2, rotation: 0, flip: false },
      },
    ];
    app.removeRoomItem('host');
    expect(app.data.roomItems).toHaveLength(1);
    expect(app.data.roomItems[0]?.attachTo).toBeUndefined();
  });

  it('trashes named layouts instead of hard-deleting them', async () => {
    const app = useAppStore();
    app.data = createEmptyData();
    const layout = await app.saveNamedLayout('Evening', app.data.room, []);
    await app.deleteLayout(layout.id);

    expect(await app.listLayouts()).toHaveLength(0);
    expect(app.trash[0]).toMatchObject({ kind: 'layout', label: 'Evening' });
  });

  it('trashes image presets instead of hard-deleting them', async () => {
    const app = useAppStore();
    app.data = createEmptyData();
    await app.saveImagePreset({ id: 'preset1', name: 'Warm', effects: {} });
    await app.deleteImagePreset('preset1');

    expect(app.imagePresets).toHaveLength(0);
    expect(app.trash[0]).toMatchObject({ kind: 'preset', label: 'Warm' });
  });

  it('expires local trash older than thirty days', async () => {
    const app = useAppStore();
    app.trash = [
      {
        id: 'old',
        kind: 'event',
        label: 'Old',
        deletedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
        records: [],
      },
    ];
    await app.expireTrash();
    expect(app.trash).toHaveLength(0);
  });
});

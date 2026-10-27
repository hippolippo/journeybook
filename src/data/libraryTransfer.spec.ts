import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import { exportLibrary, importLibrary, prepareLibraryImport } from './libraryTransfer';
import type { NoteElement } from './types';

const note: NoteElement = {
  id: 'e1',
  pageId: 'p1',
  kind: 'note',
  x: 0.5,
  y: 0.5,
  w: 0.5,
  h: 0.3,
  rotation: 0,
  z: 1,
  opacity: 1,
  text: 'Dear you',
  font: 'cursive',
  size: 22,
  dropShadow: true,
};

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('library export/import', () => {
  it('round-trips books, pages and elements (with all fields)', async () => {
    const app = useAppStore();
    app.data = {
      version: 1,
      content: {
        nodes: [{ id: 'n1', type: 'scrapbook', title: 'Us', parentId: null, tags: [], order: 0 }],
        pages: [{ id: 'p1', bookId: 'n1', index: 0 }],
        elements: [note],
        media: [],
      },
      room: app.data.room,
      roomItems: [],
      events: [],
    };
    const json = await exportLibrary();

    // Simulate a fresh, empty library before importing.
    app.data.content = { nodes: [], pages: [], elements: [], media: [] };
    app.data.events = [];

    await importLibrary(json);

    const [node] = app.data.content.nodes;
    const [page] = app.data.content.pages;
    const [element] = app.data.content.elements;
    expect(node?.title).toBe('Us');
    expect(node?.id).not.toBe('n1');
    expect(page?.bookId).toBe(node?.id);
    expect(page?.id).not.toBe('p1');
    expect(element?.pageId).toBe(page?.id);
    expect(element?.id).not.toBe('e1');
    expect(element).toMatchObject({ kind: 'note', text: 'Dear you' });
  });

  it('rejects a file that is not a library export', async () => {
    await expect(importLibrary('{"format":"other"}')).rejects.toThrow();
  });

  it('drops pages and elements whose book/page cannot resolve', () => {
    const prepared = prepareLibraryImport({
      format: 'journeybook.library',
      version: 1,
      exportedAt: '',
      data: {
        content: {
          nodes: [{ id: 'n1', type: 'scrapbook', title: 'Us', parentId: null, tags: [], order: 0 }],
          pages: [{ id: 'bad-page', bookId: 'gone', index: 0 }],
          elements: [{ ...note, id: 'e1', pageId: 'bad-page' }],
          media: [],
        },
        room: {
          wallId: 'w',
          floorId: 'f',
          dayNightMode: 'auto',
          referenceTz: 'UTC',
        },
        roomItems: [],
        events: [],
        layouts: [],
        presets: [],
      },
      media: [],
    });
    expect(prepared.data.content.pages).toHaveLength(0);
    expect(prepared.data.content.elements).toHaveLength(0);
    expect(prepared.skipped).toBeGreaterThan(0);
  });

  it('re-keys every reference before importing', () => {
    const prepared = prepareLibraryImport({
      format: 'journeybook.library',
      version: 1,
      exportedAt: '',
      data: {
        content: {
          nodes: [{ id: 'n1', type: 'scrapbook', title: 'Us', parentId: null, tags: [], order: 0 }],
          pages: [{ id: 'p1', bookId: 'n1', index: 0, groups: [{ id: 'g1', name: 'G' }] }],
          elements: [
            {
              ...note,
              id: 'e1',
              pageId: 'p1',
              kind: 'image',
              mediaId: 'm1',
              groupId: 'g1',
              preset: 'preset1',
            } as never,
          ],
          media: [{ id: 'm1', bookId: 'n1', name: 'photo.jpg', created: 1 }],
        },
        room: {
          wallId: 'w',
          floorId: 'f',
          dayNightMode: 'auto',
          referenceTz: 'UTC',
        },
        roomItems: [
          {
            id: 'r1',
            catalogId: 'floor-lamp',
            layer: 'surface',
            z: 1,
            attachTo: 'r2',
            color: {},
            desktop: { x: 0.5, y: 0.5, scale: 0.2, rotation: 0, flip: false },
          },
          {
            id: 'r2',
            catalogId: 'candle',
            layer: 'surface',
            z: 2,
            color: {},
            desktop: { x: 0.5, y: 0.5, scale: 0.2, rotation: 0, flip: false },
          },
        ],
        events: [],
        layouts: [],
        presets: [{ id: 'preset1', name: 'Warm', effects: {} }],
      },
      media: [{ id: 'm1', name: 'photo.jpg', dataUrl: 'data:image/jpeg;base64,AA==' }],
    });

    const node = prepared.data.content.nodes[0];
    const page = prepared.data.content.pages[0];
    const element = prepared.data.content.elements[0];
    const media = prepared.media[0];
    const child = prepared.data.roomItems.find((item) => item.attachTo);
    expect(node?.id).not.toBe('n1');
    expect(page?.bookId).toBe(node?.id);
    expect(element?.pageId).toBe(page?.id);
    expect(element?.kind === 'image' ? element.mediaId : '').toBe(media?.asset.id);
    expect(element?.groupId).toBe(page?.groups?.[0]?.id);
    expect(element?.kind === 'image' ? element.preset : '').toBe(prepared.data.presets[0]?.id);
    expect(child?.attachTo).toBe(prepared.data.roomItems.find((item) => !item.attachTo)?.id);
    expect(media?.asset.id).not.toBe('m1');
  });
});

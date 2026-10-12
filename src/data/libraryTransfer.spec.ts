import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import { exportLibrary, importLibrary } from './libraryTransfer';
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

    expect(app.data.content.nodes.map((n) => n.id)).toEqual(['n1']);
    expect(app.data.content.pages.map((p) => p.id)).toEqual(['p1']);
    expect(app.data.content.elements).toEqual([note]);
  });

  it('rejects a file that is not a library export', async () => {
    await expect(importLibrary('{"format":"other"}')).rejects.toThrow();
  });
});

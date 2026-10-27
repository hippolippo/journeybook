import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import { BOOK_FILE_FORMAT, importBookData } from './bookTransfer';

const baseElement = {
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

describe('book import', () => {
  it('rejects malformed files', async () => {
    await expect(importBookData('{"format":"other"}', null)).rejects.toThrow();
  });

  it('drops dangling media/page refs and normalizes asset ids', async () => {
    const app = useAppStore();
    const json = JSON.stringify({
      format: BOOK_FILE_FORMAT,
      version: 1,
      book: { title: 'Imported' },
      pages: [
        {
          id: 'old-page',
          index: 0,
          background: 'not-a-paper',
          groups: [{ id: 'old-group', name: 'Group' }],
        },
      ],
      elements: [
        { ...baseElement, id: 'bad-image', pageId: 'old-page', kind: 'image', mediaId: 'gone' },
        {
          ...baseElement,
          id: 'bad-page',
          pageId: 'missing-page',
          kind: 'note',
          text: 'orphan',
          paper: 'lined',
        },
        {
          ...baseElement,
          id: 'note',
          pageId: 'old-page',
          kind: 'note',
          text: 'kept',
          paper: 'not-a-paper',
          groupId: 'old-group',
        },
      ],
      media: [],
    });

    const node = await importBookData(json, null);
    const page = app.pagesOf(node.id)[0];
    expect(page?.background).toBeUndefined();
    expect(app.data.content.elements).toHaveLength(1);
    expect(app.data.content.elements[0]).toMatchObject({
      kind: 'note',
      text: 'kept',
      pageId: page?.id,
    });
    expect(app.data.content.elements[0]?.groupId).toBe(page?.groups?.[0]?.id);
  });
});

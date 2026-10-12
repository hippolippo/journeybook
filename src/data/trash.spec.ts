import { beforeEach, describe, expect, it } from 'vitest';
import { localBackend } from './backend';
import { loadData, saveData } from './storage';
import type { AppData, MediaAsset, ScrapNode, TrashItem } from './types';

function emptyData(): AppData {
  return {
    version: 1,
    content: { nodes: [], pages: [], elements: [], media: [] },
    room: { wallId: 'w', floorId: 'f', dayNightMode: 'auto', referenceTz: 'UTC' },
    roomItems: [],
    events: [],
  };
}

const book: ScrapNode = {
  id: 'n1',
  type: 'scrapbook',
  title: 'Our summer',
  parentId: null,
  tags: [],
  order: 0,
};
const photo: MediaAsset = { id: 'm1', bookId: 'n1', name: 'beach.jpg', created: 0 };

function group(records: TrashItem['records']): TrashItem {
  return { id: 'trash1', kind: 'media', label: 'beach.jpg', deletedAt: Date.now(), records };
}

beforeEach(() => localStorage.clear());

describe('local trash', () => {
  it('moves records out of the live data and lists them', async () => {
    const data = emptyData();
    data.content.nodes.push(book);
    data.content.media.push(photo);
    saveData(data);

    const item = group([
      { collection: 'nodes', id: book.id, record: book },
      { collection: 'media', id: photo.id, record: photo },
    ]);
    localBackend.trash(item);

    const trash = await localBackend.listTrash();
    expect(trash).toHaveLength(1);
    expect(trash[0].label).toBe('beach.jpg');
  });

  it('restores trashed records into the live data', async () => {
    // Start from live data that no longer contains the deleted records.
    const data = emptyData();
    saveData(data);
    const item = group([
      { collection: 'nodes', id: book.id, record: book },
      { collection: 'media', id: photo.id, record: photo },
    ]);
    localBackend.trash(item);

    await localBackend.restoreTrash(item);

    const restored = loadData();
    expect(restored?.content.nodes.some((n) => n.id === 'n1')).toBe(true);
    expect(restored?.content.media.some((m) => m.id === 'm1')).toBe(true);
    expect(await localBackend.listTrash()).toHaveLength(0);
  });

  it('purges a trash item without touching other items', async () => {
    const first = group([{ collection: 'media', id: 'm1', record: photo }]);
    const second = { ...group([{ collection: 'nodes', id: 'n1', record: book }]), id: 'trash2' };
    localBackend.trash(first);
    localBackend.trash(second);

    await localBackend.purgeTrash(first);

    const trash = await localBackend.listTrash();
    expect(trash).toHaveLength(1);
    expect(trash[0].id).toBe('trash2');
  });

  it('does not duplicate records when restoring an already-present one', async () => {
    const data = emptyData();
    data.content.nodes.push(book);
    saveData(data);
    const item = group([{ collection: 'nodes', id: book.id, record: book }]);

    await localBackend.restoreTrash(item);

    expect(loadData()?.content.nodes.filter((n) => n.id === 'n1')).toHaveLength(1);
  });
});

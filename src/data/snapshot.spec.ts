import { beforeEach, describe, expect, it } from 'vitest';
import { clearRemoteSnapshot, readRemoteSnapshot, updateRemoteSnapshot } from './snapshot';
import type { AppData, Note } from './types';

const data: AppData = {
  version: 1,
  content: { nodes: [], pages: [], elements: [], media: [] },
  room: { wallId: 'w', floorId: 'f', dayNightMode: 'auto', referenceTz: 'UTC' },
  roomItems: [],
  events: [],
};

const note: Note = {
  id: 'n1',
  authorId: 'a',
  recipientId: 'b',
  status: 'draft',
  body: { v: 1, blocks: [] },
  paper: 'lined',
  pageHeight: 380,
  envelope: { tint: '#fff', seal: '#b44', stamp: 'bird', initial: 'A' },
  createdAt: 1,
  updatedAt: 1,
  sentAt: 0,
  openedAt: 0,
  emailedAt: 0,
};

beforeEach(() => localStorage.clear());

describe('remote snapshot', () => {
  it('merges successful slices without dropping private notes', () => {
    updateRemoteSnapshot({ notes: [note], ownerId: 'a' });
    const first = readRemoteSnapshot();
    expect(first?.notes).toHaveLength(1);
    expect(first?.ownerId).toBe('a');

    updateRemoteSnapshot({ data });
    const second = readRemoteSnapshot();
    expect(second?.data).toEqual(data);
    expect(second?.notes).toHaveLength(1);
  });

  it('clears on logout', () => {
    updateRemoteSnapshot({ data });
    clearRemoteSnapshot();
    expect(readRemoteSnapshot()).toBeNull();
  });
});

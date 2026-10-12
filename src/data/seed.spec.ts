import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM } from '@/catalog/defaultLayout';
import { createEmptyData } from './seed';

describe('createEmptyData', () => {
  it('starts with no books, pages, elements, media or room items', () => {
    const data = createEmptyData();
    expect(data.content.nodes).toEqual([]);
    expect(data.content.pages).toEqual([]);
    expect(data.content.elements).toEqual([]);
    expect(data.content.media).toEqual([]);
    expect(data.roomItems).toEqual([]);
    expect(data.events).toEqual([]);
  });

  it('keeps the default room so the stage still renders', () => {
    expect(createEmptyData().room).toEqual(DEFAULT_ROOM);
  });
});

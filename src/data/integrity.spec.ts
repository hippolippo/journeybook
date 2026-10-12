import { describe, expect, it } from 'vitest';
import { auditIntegrity } from './integrity';
import type { AppData } from './types';

function data(partial: Partial<AppData['content']>): AppData {
  return {
    version: 1,
    content: { nodes: [], pages: [], elements: [], media: [], ...partial },
    room: { wallId: 'w', floorId: 'f', dayNightMode: 'auto', referenceTz: 'UTC' },
    roomItems: [],
    events: [],
  };
}

describe('auditIntegrity', () => {
  it('reports no problems for a consistent library', () => {
    const d = data({
      nodes: [{ id: 'n1', type: 'scrapbook', title: 'Us', parentId: null, tags: [], order: 0 }],
      pages: [{ id: 'p1', bookId: 'n1', index: 0 }],
      elements: [
        {
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
          text: 'hi',
        },
      ],
      media: [{ id: 'm1', bookId: 'n1', name: 'a.jpg', created: 0 }],
    });
    expect(auditIntegrity(d).total).toBe(0);
  });

  it('counts pages, elements and photos with a missing parent', () => {
    const d = data({
      pages: [{ id: 'p1', bookId: 'gone', index: 0 }],
      elements: [
        {
          id: 'e1',
          pageId: 'gone',
          kind: 'note',
          x: 0,
          y: 0,
          w: 1,
          h: 1,
          rotation: 0,
          z: 1,
          opacity: 1,
          text: 'x',
        },
      ],
      media: [{ id: 'm1', bookId: 'gone', name: 'a.jpg', created: 0 }],
    });
    const report = auditIntegrity(d);
    expect(report.orphanPages).toBe(1);
    expect(report.orphanElements).toBe(1);
    expect(report.orphanMedia).toBe(1);
    expect(report.total).toBe(3);
  });
});

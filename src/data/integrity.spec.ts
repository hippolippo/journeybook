import { describe, expect, it } from 'vitest';
import { auditIntegrity, auditNotes } from './integrity';
import type { AppData, Note } from './types';

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

  it('finds image and room attachment references without a parent', () => {
    const d = data({
      nodes: [{ id: 'n1', type: 'scrapbook', title: 'Us', parentId: null, tags: [], order: 0 }],
      pages: [{ id: 'p1', bookId: 'n1', index: 0 }],
      elements: [
        {
          id: 'e1',
          pageId: 'p1',
          kind: 'image',
          mediaId: 'gone-media',
          x: 0,
          y: 0,
          w: 1,
          h: 1,
          rotation: 0,
          z: 1,
          opacity: 1,
        },
      ],
    });
    d.roomItems = [
      {
        id: 'r1',
        catalogId: 'floor-lamp',
        layer: 'surface',
        z: 1,
        attachTo: 'gone-host',
        color: {},
        desktop: { x: 0.5, y: 0.5, scale: 0.2, rotation: 0, flip: false },
      },
    ];
    const report = auditIntegrity(d);
    expect(report.danglingMediaRefs).toBe(1);
    expect(report.danglingAttachments).toBe(1);
    expect(report.total).toBe(2);
  });

  it('finds notes whose people no longer exist', () => {
    const note: Note = {
      id: 'n1',
      authorId: 'gone-a',
      recipientId: 'gone-b',
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
    expect(auditNotes([note], ['a', 'b']).orphanNotes).toBe(1);
    expect(auditNotes([{ ...note, authorId: 'a', recipientId: 'b' }], ['a', 'b']).orphanNotes).toBe(
      0,
    );
  });
});

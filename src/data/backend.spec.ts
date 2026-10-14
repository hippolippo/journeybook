import { describe, expect, it } from 'vitest';
import type { RecordModel } from 'pocketbase';
import type {
  ImageElement,
  NoteElement,
  PhotoElement,
  RoomItem,
  StickerElement,
  TapeElement,
} from './types';
import { elementBody, mapElement, mapRoomItem, roomItemBody, coalescePbOps } from './backend';

/** Wrap a record body the way PocketBase hands it back, adding the id. */
function asRecord(body: Record<string, unknown>, id: string): RecordModel {
  return { id, ...body } as unknown as RecordModel;
}

function roundTripElement<T extends { id: string }>(el: T): T {
  return mapElement(asRecord(elementBody(el as never), el.id)) as unknown as T;
}

function roundTripItem(item: RoomItem): RoomItem {
  return mapRoomItem(asRecord(roomItemBody(item), item.id));
}

const base = {
  pageId: 'p00000000000000',
  x: 0.1,
  y: 0.25,
  w: 0.5,
  h: 0.33,
  rotation: -4,
  z: 7,
  opacity: 0.85,
  locked: true,
  aspectLocked: false,
  groupId: 'g-photos',
  name: 'Named element',
  scale: 1.3,
  dropShadow: true,
  shadowStrength: 0.65,
};

describe('element round-trip', () => {
  it('preserves every note field, including typography', () => {
    const note: NoteElement = {
      ...base,
      id: 'e00000000000001',
      kind: 'note',
      text: 'Dear you,',
      color: '#fef3c7',
      ink: '#4a3b2e',
      font: 'cursive',
      size: 24,
      bold: true,
      italic: true,
      align: 'right',
      valign: 'bottom',
      lineHeight: 1.6,
      paper: 'kraft',
      uppercase: true,
      shadow: true,
    };
    expect(roundTripElement(note)).toEqual(note);
  });

  it('preserves every image field, including effects and crop', () => {
    const image: ImageElement = {
      ...base,
      id: 'e00000000000002',
      kind: 'image',
      mediaId: 'm00000000000000',
      caption: 'Us',
      frame: 'polaroid',
      frameColor: '#ffffff',
      frameColors: { frame: '#ffffff', mat: '#e5e7eb' },
      zoom: 1.75,
      focusX: 0.32,
      focusY: 0.66,
      preset: 'custom',
      effects: {
        brightness: 1.1,
        contrast: 0.9,
        saturation: 1.2,
        warmth: 0.3,
        fade: 0.15,
        vignette: 0.4,
        grain: 0.2,
      },
    };
    expect(roundTripElement(image)).toEqual(image);
  });

  it('preserves sticker, tape and photo fields', () => {
    const sticker: StickerElement = {
      ...base,
      id: 'e00000000000003',
      kind: 'sticker',
      icon: 'heart',
      color: '#ef4444',
      colors: { body: '#ef4444', outline: '#991b1b' },
    };
    const tape: TapeElement = {
      ...base,
      id: 'e00000000000004',
      kind: 'tape',
      style: 'washi',
      color: '#22c55e',
      colors: { base: '#22c55e' },
    };
    const photo: PhotoElement = {
      ...base,
      id: 'e00000000000005',
      kind: 'photo',
      photo: 'sunset',
      caption: 'Sky',
    };
    expect(roundTripElement(sticker)).toEqual(sticker);
    expect(roundTripElement(tape)).toEqual(tape);
    expect(roundTripElement(photo)).toEqual(photo);
  });

  it('keeps the drop-shadow fields that had no column', () => {
    const note: NoteElement = {
      ...base,
      id: 'e00000000000006',
      kind: 'note',
      text: 'x',
      dropShadow: true,
      shadowStrength: 0.2,
    };
    const restored = roundTripElement(note);
    expect(restored.dropShadow).toBe(true);
    expect(restored.shadowStrength).toBe(0.2);
  });

  it('still maps legacy rows whose payload held only a kind subset', () => {
    const rec = asRecord(
      {
        page: 'p1',
        kind: 'note',
        x: 0.2,
        y: 0.3,
        w: 0.5,
        h: 0.3,
        rotation: 0,
        z: 1,
        opacity: 1,
        locked: false,
        aspectLocked: true,
        group: '',
        name: '',
        scale: 1,
        payload: { text: 'legacy', color: '#abc' },
      },
      'legacyid00000000',
    );
    expect(mapElement(rec)).toMatchObject({
      kind: 'note',
      text: 'legacy',
      color: '#abc',
      x: 0.2,
      y: 0.3,
    });
  });
});

describe('room item round-trip', () => {
  it('preserves every field, including lightLevel', () => {
    const item: RoomItem = {
      id: 'r00000000000001',
      catalogId: 'floor-lamp',
      layer: 'surface',
      z: 3,
      attachTo: 'h00000000000000',
      color: { shade: '#fff7e6', base: '#7c5c3b' },
      desktop: { x: 0.42, y: 0.58, scale: 0.31, rotation: 12, flip: true, ax: 0.2, ay: 0.4 },
      mobile: { x: 0.5, y: 0.5, scale: 0.2, rotation: 0, flip: false },
      hideMobile: true,
      locked: true,
      lightLevel: 1.4,
      shadow: 0.7,
    };
    expect(roundTripItem(item)).toEqual(item);
  });

  it('keeps lightLevel that has no dedicated column', () => {
    const item: RoomItem = {
      id: 'r00000000000002',
      catalogId: 'candle',
      layer: 'surface',
      z: 1,
      color: {},
      desktop: { x: 0.5, y: 0.5, scale: 0.2, rotation: 0, flip: false },
      lightLevel: 0.3,
    };
    expect(roundTripItem(item).lightLevel).toBe(0.3);
  });
});

describe('coalescePbOps', () => {
  it('folds an update into a pending create for the same record', () => {
    const created = coalescePbOps([], {
      t: 'create',
      collection: 'nodes',
      id: 'n1',
      body: { title: 'a' },
    });
    const next = coalescePbOps(created, {
      t: 'update',
      collection: 'nodes',
      id: 'n1',
      body: { title: 'b' },
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ t: 'create', body: { title: 'b' } });
  });

  it('keeps only the latest update for a record', () => {
    const first = coalescePbOps([], {
      t: 'update',
      collection: 'nodes',
      id: 'n1',
      body: { title: 'a' },
    });
    const next = coalescePbOps(first, {
      t: 'update',
      collection: 'nodes',
      id: 'n1',
      body: { title: 'b' },
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ t: 'update', body: { title: 'b' } });
  });

  it('drops a create followed by a delete entirely', () => {
    const created = coalescePbOps([], { t: 'create', collection: 'nodes', id: 'n1', body: {} });
    const next = coalescePbOps(created, { t: 'delete', collection: 'nodes', id: 'n1' });
    expect(next).toHaveLength(0);
  });

  it('turns update then delete into a single delete', () => {
    const updated = coalescePbOps([], { t: 'update', collection: 'nodes', id: 'n1', body: {} });
    const next = coalescePbOps(updated, { t: 'delete', collection: 'nodes', id: 'n1' });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ t: 'delete', id: 'n1' });
  });

  it('keeps operations for different records', () => {
    const a = coalescePbOps([], { t: 'update', collection: 'nodes', id: 'n1', body: {} });
    const both = coalescePbOps(a, { t: 'update', collection: 'nodes', id: 'n2', body: {} });
    expect(both).toHaveLength(2);
  });
});

import PocketBase, { type RecordModel } from 'pocketbase';
import type {
  AppData,
  CalendarEvent,
  ImagePreset,
  MediaAsset,
  PageElement,
  PageGroup,
  Room,
  RoomItem,
  ScrapNode,
  ScrapPage,
  StoredLayout,
  TrashItem,
} from './types';
import {
  loadData,
  loadLayouts,
  loadPresets,
  loadTrashItems,
  saveData,
  saveLayouts,
  savePresets,
  saveTrashItems,
} from './storage';
import { createSeedData } from './seed';
import { createOutbox } from './outbox';
import { idbDelete } from './mediaStore';
import { clone } from '@/utils/clone';

export const PB_URL = ((import.meta.env.VITE_PB_URL as string | undefined) ?? '').trim();
export const pbEnabled = PB_URL.length > 0;
export const pb: PocketBase | null = pbEnabled ? new PocketBase(PB_URL) : null;

export interface Backend {
  kind: 'local' | 'pocketbase';
  fetchAll(): Promise<AppData | null>;
  persistLocal(data: AppData): void;
  nodeCreate(node: ScrapNode): void;
  nodeUpdate(node: ScrapNode): void;
  nodeDelete(id: string): void;
  pageCreate(page: ScrapPage): void;
  pageUpdate(page: ScrapPage): void;
  pageDelete(id: string): void;
  elementCreate(el: PageElement): void;
  elementUpdate(el: PageElement): void;
  elementDelete(id: string): void;
  roomUpdate(room: Room): void;
  roomItemCreate(item: RoomItem): void;
  roomItemUpdate(item: RoomItem): void;
  roomItemDelete(id: string): void;
  applyRoomLayout(room: Room, items: RoomItem[]): void;
  eventSave(event: CalendarEvent): void;
  eventDelete(id: string): void;
  listLayouts(): Promise<StoredLayout[]>;
  saveLayout(layout: StoredLayout): Promise<void>;
  deleteLayout(id: string): Promise<void>;
  listImagePresets(): Promise<ImagePreset[]>;
  saveImagePreset(preset: ImagePreset): Promise<void>;
  deleteImagePreset(id: string): Promise<void>;
  /** Soft-delete a group of records so they can be recovered from the trash. */
  trash(item: TrashItem): void;
  listTrash(): Promise<TrashItem[]>;
  restoreTrash(item: TrashItem): Promise<void>;
  purgeTrash(item: TrashItem): Promise<void>;
  subscribe(onChange: () => void): void;
}

const noop = () => {};

export const localBackend: Backend = {
  kind: 'local',
  async fetchAll() {
    return null;
  },
  persistLocal(data) {
    saveData(data);
  },
  nodeCreate: noop,
  nodeUpdate: noop,
  nodeDelete: noop,
  pageCreate: noop,
  pageUpdate: noop,
  pageDelete: noop,
  elementCreate: noop,
  elementUpdate: noop,
  elementDelete: noop,
  roomUpdate: noop,
  roomItemCreate: noop,
  roomItemUpdate: noop,
  roomItemDelete: noop,
  applyRoomLayout: noop,
  eventSave: noop,
  eventDelete: noop,
  async listLayouts() {
    return loadLayouts();
  },
  async saveLayout(layout) {
    const list = loadLayouts().filter((l) => l.id !== layout.id);
    list.push(layout);
    saveLayouts(list);
  },
  async deleteLayout(id) {
    saveLayouts(loadLayouts().filter((l) => l.id !== id));
  },
  async listImagePresets() {
    return loadPresets();
  },
  async saveImagePreset(preset) {
    const list = loadPresets().filter((p) => p.id !== preset.id);
    list.push(preset);
    savePresets(list);
  },
  async deleteImagePreset(id) {
    savePresets(loadPresets().filter((p) => p.id !== id));
  },
  trash(item) {
    saveTrashItems([...loadTrashItems(), item]);
  },
  async listTrash() {
    return loadTrashItems();
  },
  async restoreTrash(item) {
    const data = loadData();
    if (data) {
      for (const ref of item.records) {
        if (!ref.record) continue;
        switch (ref.collection) {
          case 'nodes':
            if (!data.content.nodes.some((r) => r.id === ref.id))
              data.content.nodes.push(ref.record as ScrapNode);
            break;
          case 'pages':
            if (!data.content.pages.some((r) => r.id === ref.id))
              data.content.pages.push(ref.record as ScrapPage);
            break;
          case 'elements':
            if (!data.content.elements.some((r) => r.id === ref.id))
              data.content.elements.push(ref.record as PageElement);
            break;
          case 'media':
            if (!data.content.media.some((r) => r.id === ref.id))
              data.content.media.push(ref.record as MediaAsset);
            break;
          case 'events':
            if (!data.events.some((r) => r.id === ref.id))
              data.events.push(ref.record as CalendarEvent);
            break;
          default:
            break;
        }
      }
      saveData(data);
    }
    saveTrashItems(loadTrashItems().filter((t) => t.id !== item.id));
  },
  async purgeTrash(item) {
    for (const ref of item.records.filter((r) => r.collection === 'media')) {
      await idbDelete(ref.id);
    }
    saveTrashItems(loadTrashItems().filter((t) => t.id !== item.id));
  },
  subscribe: noop,
};

// ---------------------------------------------------------------------------
// PocketBase mapping
// ---------------------------------------------------------------------------

function field<T>(rec: RecordModel, key: string, fallback: T): T {
  const value = (rec as unknown as Record<string, unknown>)[key];
  return (value === undefined || value === null ? fallback : value) as T;
}

function mapNode(rec: RecordModel): ScrapNode {
  const cover = field<string>(rec, 'cover', '');
  return {
    id: rec.id,
    type: field<'folder' | 'scrapbook'>(rec, 'type', 'folder'),
    title: field<string>(rec, 'title', ''),
    parentId: field<string>(rec, 'parent', '') || null,
    tags: field<string[]>(rec, 'tags', []),
    order: field<number>(rec, 'order', 0),
    cover: cover ? (cover as ScrapNode['cover']) : undefined,
    published: field<boolean>(rec, 'published', false),
  };
}

function mapPage(rec: RecordModel): ScrapPage {
  const groups = field<PageGroup[]>(rec, 'groups', []);
  const paperColors = field<Record<string, string>>(rec, 'paperColors', {});
  return {
    id: rec.id,
    bookId: field<string>(rec, 'book', ''),
    index: field<number>(rec, 'index', 0),
    background: field<string>(rec, 'background', '') || undefined,
    paperColors: Object.keys(paperColors).length ? paperColors : undefined,
    groups: Array.isArray(groups) && groups.length ? groups : undefined,
  };
}

/**
 * Rebuild an element from its record. The `payload` column stores the complete
 * element (minus identity), so every field — including ones added later — is
 * preserved. Columns supply defaults for legacy rows whose payload held only a
 * per-kind subset, then the payload is overlaid so nothing is dropped.
 */
export function mapElement(rec: RecordModel): PageElement {
  const payload = field<Record<string, unknown>>(rec, 'payload', {});
  const base = {
    id: rec.id,
    pageId: field<string>(rec, 'page', ''),
    kind: field<PageElement['kind']>(rec, 'kind', 'note'),
    x: field<number>(rec, 'x', 0.5),
    y: field<number>(rec, 'y', 0.5),
    w: field<number>(rec, 'w', 0.5),
    h: field<number>(rec, 'h', 0.5),
    rotation: field<number>(rec, 'rotation', 0),
    z: field<number>(rec, 'z', 1),
    opacity: field<number>(rec, 'opacity', 1),
    locked: field<boolean>(rec, 'locked', false),
    aspectLocked: field<boolean>(rec, 'aspectLocked', true),
    groupId: field<string>(rec, 'group', '') || undefined,
    name: field<string>(rec, 'name', '') || undefined,
    scale: field<number>(rec, 'scale', 1),
  };
  return { ...base, ...payload, id: rec.id, pageId: base.pageId } as unknown as PageElement;
}

function mapMedia(rec: RecordModel): MediaAsset {
  const created = Date.parse(field<string>(rec, 'created', ''));
  return {
    id: rec.id,
    bookId: field<string>(rec, 'book', ''),
    name: field<string>(rec, 'name', ''),
    fileName: field<string>(rec, 'file', '') || undefined,
    created: Number.isNaN(created) ? Date.now() : created,
  };
}

function mapRoom(rec: RecordModel): Room {
  return {
    wallId: field<string>(rec, 'wallId', 'stripes-cream'),
    floorId: field<string>(rec, 'floorId', 'wood-warm'),
    dayNightMode: field<Room['dayNightMode']>(rec, 'dayNightMode', 'auto'),
    referenceTz: field<string>(rec, 'referenceTz', 'America/Chicago'),
  };
}

export function mapRoomItem(rec: RecordModel): RoomItem {
  const mobile = field<Record<string, unknown> | null>(rec, 'mobile', null);
  const data = field<Record<string, unknown> | null>(rec, 'data', null);
  const base = {
    id: rec.id,
    catalogId: field<string>(rec, 'catalogId', ''),
    layer: field<RoomItem['layer']>(rec, 'layer', 'wall'),
    z: field<number>(rec, 'z', 1),
    attachTo: field<string>(rec, 'attachTo', '') || undefined,
    color: field<Record<string, string>>(rec, 'color', {}),
    desktop: field<RoomItem['desktop']>(rec, 'desktop', {
      x: 0.5,
      y: 0.5,
      scale: 0.2,
      rotation: 0,
      flip: false,
    }),
    mobile: mobile ? (mobile as unknown as RoomItem['desktop']) : undefined,
    hideMobile: field<boolean>(rec, 'hideMobile', false),
    locked: field<boolean>(rec, 'locked', false),
  };
  return { ...base, ...(data ?? {}), id: rec.id } as unknown as RoomItem;
}

function mapLayout(rec: RecordModel): StoredLayout {
  const data = field<{ room: Room; items: RoomItem[] }>(rec, 'data', {
    room: {
      wallId: 'stripes-cream',
      floorId: 'wood-warm',
      dayNightMode: 'auto',
      referenceTz: 'America/Chicago',
    },
    items: [],
  });
  return {
    id: rec.id,
    name: field<string>(rec, 'name', 'Untitled'),
    room: data.room,
    items: data.items ?? [],
  };
}

function nodeBody(node: ScrapNode): Record<string, unknown> {
  return {
    type: node.type,
    title: node.title,
    parent: node.parentId ?? '',
    tags: node.tags,
    order: node.order,
    cover: node.cover ?? '',
    published: node.published ?? false,
  };
}
function pageBody(page: ScrapPage): Record<string, unknown> {
  return {
    book: page.bookId,
    index: page.index,
    background: page.background ?? '',
    paperColors: page.paperColors ?? {},
    groups: page.groups ?? [],
  };
}

function mapPreset(rec: RecordModel): ImagePreset {
  return {
    id: rec.id,
    name: field<string>(rec, 'name', 'Untitled'),
    effects: field(rec, 'effects', {}),
  };
}
function mapEvent(rec: RecordModel): CalendarEvent {
  const data = field<CalendarEvent>(rec, 'data', {
    id: rec.id,
    kind: 'occasion',
    title: '',
    startsAt: '',
    recurrence: 'none',
  });
  return { ...data, id: rec.id };
}
function eventBody(event: CalendarEvent): Record<string, unknown> {
  return { kind: event.kind, title: event.title, data: event };
}
function mapTrash(rec: RecordModel): TrashItem {
  const records = field<TrashItem['records']>(rec, 'records', []);
  return {
    id: rec.id,
    kind: field<TrashItem['kind']>(rec, 'kind', 'book'),
    label: field<string>(rec, 'label', 'Deleted item'),
    detail: field<string>(rec, 'detail', '') || undefined,
    deletedAt: field<number>(rec, 'deletedAt', 0),
    records: Array.isArray(records) ? records : [],
  };
}
export function elementBody(el: PageElement): Record<string, unknown> {
  return {
    page: el.pageId,
    kind: el.kind,
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    rotation: el.rotation,
    z: el.z,
    opacity: el.opacity,
    locked: el.locked ?? false,
    aspectLocked: el.aspectLocked ?? true,
    group: el.groupId ?? '',
    name: el.name ?? '',
    scale: el.scale ?? 1,
    // Full element so no field (present or future) is lost on the round-trip.
    payload: clone(el),
  };
}
function roomBody(room: Room): Record<string, unknown> {
  return {
    wallId: room.wallId,
    floorId: room.floorId,
    dayNightMode: room.dayNightMode,
    referenceTz: room.referenceTz,
  };
}
export function roomItemBody(item: RoomItem): Record<string, unknown> {
  return {
    catalogId: item.catalogId,
    layer: item.layer,
    z: item.z,
    attachTo: item.attachTo ?? '',
    color: item.color,
    desktop: item.desktop,
    mobile: item.mobile ?? null,
    hideMobile: item.hideMobile ?? false,
    locked: item.locked ?? false,
    // Full item so fields without a column (e.g. lightLevel) survive.
    data: clone(item),
  };
}

async function seedIfEmpty(client: PocketBase): Promise<void> {
  // Only ever seed demo content in development or when explicitly asked: never
  // pour sample books into a real (possibly just-emptied) library.
  const seedDemo = import.meta.env.DEV || import.meta.env.VITE_SEED_DEMO === '1';
  if (!seedDemo) return;
  const nodes = await client.collection('nodes').getFullList();
  if (nodes.length === 0) {
    const content = createSeedData().content;
    const idMap = new Map<string, string>();
    for (const node of content.nodes) {
      const rec = await client.collection('nodes').create({
        ...nodeBody(node),
        parent: node.parentId ? (idMap.get(node.parentId) ?? '') : '',
      });
      idMap.set(node.id, rec.id);
    }
    const pageMap = new Map<string, string>();
    for (const page of content.pages) {
      const rec = await client
        .collection('pages')
        .create({ ...pageBody(page), book: idMap.get(page.bookId) ?? '' });
      pageMap.set(page.id, rec.id);
    }
    for (const el of content.elements) {
      await client
        .collection('elements')
        .create({ ...elementBody(el), page: pageMap.get(el.pageId) ?? '' });
    }
  }
}

async function ensureRoom(client: PocketBase): Promise<{ room: Room; items: RoomItem[] }> {
  let roomRecs = await client.collection('room').getFullList();
  if (roomRecs.length === 0) {
    const seed = createSeedData();
    await client.collection('room').create(roomBody(seed.room));
    const idMap = new Map<string, string>();
    for (const item of seed.roomItems) {
      const rec = await client.collection('room_items').create({
        ...roomItemBody(item),
        attachTo: item.attachTo ? (idMap.get(item.attachTo) ?? '') : '',
      });
      idMap.set(item.id, rec.id);
    }
    roomRecs = await client.collection('room').getFullList();
  }
  const itemRecs = await client.collection('room_items').getFullList();
  return { room: mapRoom(roomRecs[0]), items: itemRecs.map(mapRoomItem) };
}

// ---------------------------------------------------------------------------
// Durable writes
//
// PocketBase mutations are expressed as plain, serializable operations and fed
// through a persistent outbox so a dropped connection or a restart never loses
// an edit. See src/data/outbox.ts.
// ---------------------------------------------------------------------------

type PbOp =
  | { t: 'create'; collection: string; id: string; body: Record<string, unknown> }
  | { t: 'update'; collection: string; id: string; body: Record<string, unknown> }
  | { t: 'upsert'; collection: string; id: string; body: Record<string, unknown> }
  | { t: 'delete'; collection: string; id: string }
  | { t: 'updateFirst'; collection: string; body: Record<string, unknown> }
  | { t: 'deleteNode'; id: string }
  | { t: 'applyRoomLayout'; room: Room; items: RoomItem[] }
  | { t: 'trashGroup'; item: TrashItem };

async function runPbOp(op: PbOp): Promise<void> {
  const client = pb;
  if (!client) return;
  switch (op.t) {
    case 'create':
      await client.collection(op.collection).create({ id: op.id, ...op.body });
      return;
    case 'update':
      await client.collection(op.collection).update(op.id, op.body);
      return;
    case 'upsert':
      try {
        await client.collection(op.collection).update(op.id, op.body);
      } catch {
        await client.collection(op.collection).create({ id: op.id, ...op.body });
      }
      return;
    case 'delete':
      await client.collection(op.collection).delete(op.id);
      return;
    case 'updateFirst': {
      const recs = await client.collection(op.collection).getFullList();
      if (recs[0]) await client.collection(op.collection).update(recs[0].id, op.body);
      return;
    }
    case 'deleteNode': {
      const nodes = await client.collection('nodes').getFullList();
      const doomed = new Set<string>();
      const collect = (rootId: string) => {
        doomed.add(rootId);
        nodes
          .filter((n) => field<string>(n, 'parent', '') === rootId)
          .forEach((n) => collect(n.id));
      };
      collect(op.id);
      const pages = await client.collection('pages').getFullList();
      const pageIds = pages
        .filter((p) => doomed.has(field<string>(p, 'book', '')))
        .map((p) => p.id);
      const elements = await client.collection('elements').getFullList();
      for (const el of elements.filter((e) => pageIds.includes(field<string>(e, 'page', '')))) {
        await client.collection('elements').delete(el.id);
      }
      for (const pid of pageIds) await client.collection('pages').delete(pid);
      for (const nid of doomed) await client.collection('nodes').delete(nid);
      return;
    }
    case 'applyRoomLayout': {
      const recs = await client.collection('room').getFullList();
      if (recs[0]) await client.collection('room').update(recs[0].id, roomBody(op.room));
      const existing = await client.collection('room_items').getFullList();
      const keep = new Set(op.items.map((i) => i.id));
      for (const r of existing.filter((row) => !keep.has(row.id))) {
        await client.collection('room_items').delete(r.id);
      }
      for (const item of op.items) {
        const body = roomItemBody(item);
        try {
          await client.collection('room_items').update(item.id, body);
        } catch {
          await client.collection('room_items').create({ id: item.id, ...body });
        }
      }
      return;
    }
    case 'trashGroup': {
      const { item } = op;
      for (const ref of item.records) {
        await client.collection(ref.collection).update(ref.id, { deletedAt: item.deletedAt });
      }
      await client.collection('trash').create({
        id: item.id,
        kind: item.kind,
        label: item.label,
        detail: item.detail ?? '',
        records: item.records.map((ref) => ({ collection: ref.collection, id: ref.id })),
        deletedAt: item.deletedAt,
      });
      return;
    }
  }
}

/** Coalesce redundant operations so rapid edits don't flood the queue. */
export function coalescePbOps(queue: PbOp[], op: PbOp): PbOp[] {
  const isWriteTo = (o: PbOp, collection: string, id: string): boolean =>
    (o.t === 'create' || o.t === 'update' || o.t === 'upsert') &&
    o.collection === collection &&
    o.id === id;
  if (op.t === 'update' || op.t === 'upsert') {
    const createIdx = queue.findIndex(
      (o) => o.t === 'create' && o.collection === op.collection && o.id === op.id,
    );
    if (createIdx >= 0) {
      const create = queue[createIdx];
      if (create.t === 'create') {
        queue[createIdx] = { ...create, body: op.body };
        return queue;
      }
    }
    const idx = queue.findIndex(
      (o) =>
        (o.t === 'update' || o.t === 'upsert') && o.collection === op.collection && o.id === op.id,
    );
    if (idx >= 0) {
      queue[idx] = op;
      return queue;
    }
  }
  if (op.t === 'delete') {
    const hadCreate = queue.some(
      (o) => o.t === 'create' && o.collection === op.collection && o.id === op.id,
    );
    const kept = queue.filter(
      (o) =>
        !isWriteTo(o, op.collection, op.id) &&
        !(o.t === 'delete' && o.collection === op.collection && o.id === op.id),
    );
    // A record that never reached the server need not be deleted.
    return hadCreate ? kept : [...kept, op];
  }
  if (op.t === 'updateFirst') {
    const idx = queue.findIndex((o) => o.t === 'updateFirst' && o.collection === op.collection);
    if (idx >= 0) {
      queue[idx] = op;
      return queue;
    }
  }
  return [...queue, op];
}

export const pbOutbox = pbEnabled
  ? createOutbox<PbOp>({
      run: runPbOp,
      storageKey: 'journeybook:outbox:v1',
      coalesce: coalescePbOps,
    })
  : null;

export const pbBackend: Backend = {
  kind: 'pocketbase',
  async fetchAll(): Promise<AppData | null> {
    const client = pb;
    if (!client) return null;
    await seedIfEmpty(client);
    const [nodes, pages, elements, media, events] = await Promise.all([
      client.collection('nodes').getFullList({ filter: 'deletedAt = 0' }),
      client.collection('pages').getFullList({ filter: 'deletedAt = 0' }),
      client.collection('elements').getFullList({ filter: 'deletedAt = 0' }),
      client.collection('media').getFullList({ filter: 'deletedAt = 0' }),
      client.collection('events').getFullList({ filter: 'deletedAt = 0' }),
    ]);
    const { room, items } = await ensureRoom(client);
    return {
      version: 1,
      content: {
        nodes: nodes.map(mapNode),
        pages: pages.map(mapPage),
        elements: elements.map(mapElement),
        media: media.map(mapMedia),
      },
      room,
      roomItems: items,
      events: events.map(mapEvent),
    };
  },
  persistLocal: noop,
  nodeCreate(node) {
    pbOutbox?.enqueue({
      t: 'create',
      collection: 'nodes',
      id: node.id,
      body: clone(nodeBody(node)),
    });
  },
  nodeUpdate(node) {
    pbOutbox?.enqueue({
      t: 'update',
      collection: 'nodes',
      id: node.id,
      body: clone(nodeBody(node)),
    });
  },
  nodeDelete(id) {
    pbOutbox?.enqueue({ t: 'deleteNode', id });
  },
  pageCreate(page) {
    pbOutbox?.enqueue({
      t: 'create',
      collection: 'pages',
      id: page.id,
      body: clone(pageBody(page)),
    });
  },
  pageUpdate(page) {
    pbOutbox?.enqueue({
      t: 'update',
      collection: 'pages',
      id: page.id,
      body: clone(pageBody(page)),
    });
  },
  pageDelete(id) {
    pbOutbox?.enqueue({ t: 'delete', collection: 'pages', id });
  },
  elementCreate(el) {
    pbOutbox?.enqueue({
      t: 'create',
      collection: 'elements',
      id: el.id,
      body: clone(elementBody(el)),
    });
  },
  elementUpdate(el) {
    pbOutbox?.enqueue({
      t: 'update',
      collection: 'elements',
      id: el.id,
      body: clone(elementBody(el)),
    });
  },
  elementDelete(id) {
    pbOutbox?.enqueue({ t: 'delete', collection: 'elements', id });
  },
  roomUpdate(room) {
    pbOutbox?.enqueue({ t: 'updateFirst', collection: 'room', body: clone(roomBody(room)) });
  },
  roomItemCreate(item) {
    pbOutbox?.enqueue({
      t: 'create',
      collection: 'room_items',
      id: item.id,
      body: clone(roomItemBody(item)),
    });
  },
  roomItemUpdate(item) {
    pbOutbox?.enqueue({
      t: 'update',
      collection: 'room_items',
      id: item.id,
      body: clone(roomItemBody(item)),
    });
  },
  roomItemDelete(id) {
    pbOutbox?.enqueue({ t: 'delete', collection: 'room_items', id });
  },
  applyRoomLayout(room, items) {
    pbOutbox?.enqueue({ t: 'applyRoomLayout', room: clone(room), items: clone(items) });
  },
  eventSave(event) {
    pbOutbox?.enqueue({
      t: 'upsert',
      collection: 'events',
      id: event.id,
      body: clone(eventBody(event)),
    });
  },
  eventDelete(id) {
    pbOutbox?.enqueue({ t: 'delete', collection: 'events', id });
  },
  async listLayouts() {
    const client = pb;
    if (!client) return [];
    const recs = await client.collection('room_layouts').getFullList();
    return recs.map(mapLayout);
  },
  async saveLayout(layout) {
    pbOutbox?.enqueue({
      t: 'upsert',
      collection: 'room_layouts',
      id: layout.id,
      body: { name: layout.name, data: { room: layout.room, items: layout.items } },
    });
  },
  async deleteLayout(id) {
    pbOutbox?.enqueue({ t: 'delete', collection: 'room_layouts', id });
  },
  async listImagePresets() {
    const client = pb;
    if (!client) return [];
    const recs = await client.collection('image_presets').getFullList();
    return recs.map(mapPreset);
  },
  async saveImagePreset(preset) {
    pbOutbox?.enqueue({
      t: 'upsert',
      collection: 'image_presets',
      id: preset.id,
      body: { name: preset.name, effects: preset.effects },
    });
  },
  async deleteImagePreset(id) {
    pbOutbox?.enqueue({ t: 'delete', collection: 'image_presets', id });
  },
  trash(item) {
    pbOutbox?.enqueue({ t: 'trashGroup', item });
  },
  async listTrash() {
    const client = pb;
    if (!client) return [];
    const recs = await client.collection('trash').getFullList();
    return recs.map(mapTrash).sort((a, b) => b.deletedAt - a.deletedAt);
  },
  async restoreTrash(item) {
    const client = pb;
    if (!client) return;
    for (const ref of item.records) {
      try {
        await client.collection(ref.collection).update(ref.id, { deletedAt: 0 });
      } catch (e) {
        console.error('restoreTrash', e);
      }
    }
    try {
      await client.collection('trash').delete(item.id);
    } catch (e) {
      console.error('restoreTrash', e);
    }
  },
  async purgeTrash(item) {
    const client = pb;
    if (!client) return;
    for (const ref of item.records) {
      try {
        await client.collection(ref.collection).delete(ref.id);
      } catch (e) {
        console.error('purgeTrash', e);
      }
    }
    try {
      await client.collection('trash').delete(item.id);
    } catch (e) {
      console.error('purgeTrash', e);
    }
  },
  subscribe(onChange) {
    const client = pb;
    if (!client) return;
    for (const name of [
      'nodes',
      'pages',
      'elements',
      'media',
      'room',
      'room_items',
      'room_layouts',
      'image_presets',
      'events',
      'trash',
    ]) {
      void client
        .collection(name)
        .subscribe('*', () => onChange())
        .catch((e) => console.error('subscribe', e));
    }
  },
};

export const backend: Backend = pbEnabled ? pbBackend : localBackend;

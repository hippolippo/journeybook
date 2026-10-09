import PocketBase, { type RecordModel } from 'pocketbase';
import type { AppData, PageElement, PhotoStyle, Room, RoomItem, ScrapNode, ScrapPage } from './types';
import { saveData } from './storage';
import { createSeedData } from './seed';

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
  elementCreate(el: PageElement): void;
  elementUpdate(el: PageElement): void;
  elementDelete(id: string): void;
  roomUpdate(room: Room): void;
  roomItemCreate(item: RoomItem): void;
  roomItemUpdate(item: RoomItem): void;
  roomItemDelete(id: string): void;
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
  elementCreate: noop,
  elementUpdate: noop,
  elementDelete: noop,
  roomUpdate: noop,
  roomItemCreate: noop,
  roomItemUpdate: noop,
  roomItemDelete: noop,
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
  };
}

function mapPage(rec: RecordModel): ScrapPage {
  return {
    id: rec.id,
    bookId: field<string>(rec, 'book', ''),
    index: field<number>(rec, 'index', 0),
    background: field<string>(rec, 'background', '') || undefined,
  };
}

function mapElement(rec: RecordModel): PageElement {
  const payload = field<Record<string, unknown>>(rec, 'payload', {});
  const base = {
    id: rec.id,
    pageId: field<string>(rec, 'page', ''),
    x: field<number>(rec, 'x', 0.5),
    y: field<number>(rec, 'y', 0.5),
    w: field<number>(rec, 'w', 0.5),
    h: field<number>(rec, 'h', 0.5),
    rotation: field<number>(rec, 'rotation', 0),
    z: field<number>(rec, 'z', 1),
    opacity: field<number>(rec, 'opacity', 1),
  };
  const kind = field<'photo' | 'note' | 'sticker'>(rec, 'kind', 'note');
  if (kind === 'photo') {
    return { ...base, kind: 'photo', photo: (payload.photo as PhotoStyle) ?? 'sunset', caption: payload.caption as string | undefined };
  }
  if (kind === 'sticker') {
    return { ...base, kind: 'sticker', icon: (payload.icon as 'heart' | 'star' | 'sparkle') ?? 'heart' };
  }
  return { ...base, kind: 'note', text: (payload.text as string) ?? '' };
}

function mapRoom(rec: RecordModel): Room {
  return {
    wallId: field<string>(rec, 'wallId', 'stripes-cream'),
    floorId: field<string>(rec, 'floorId', 'wood-warm'),
    dayNightMode: field<Room['dayNightMode']>(rec, 'dayNightMode', 'auto'),
    referenceTz: field<string>(rec, 'referenceTz', 'America/Chicago'),
  };
}

function mapRoomItem(rec: RecordModel): RoomItem {
  const mobile = field<Record<string, unknown> | null>(rec, 'mobile', null);
  return {
    id: rec.id,
    catalogId: field<string>(rec, 'catalogId', ''),
    layer: field<RoomItem['layer']>(rec, 'layer', 'wall'),
    z: field<number>(rec, 'z', 1),
    attachTo: field<string>(rec, 'attachTo', '') || undefined,
    color: field<Record<string, string>>(rec, 'color', {}),
    desktop: field<RoomItem['desktop']>(rec, 'desktop', { x: 0.5, y: 0.5, scale: 0.2, rotation: 0, flip: false }),
    mobile: mobile ? (mobile as unknown as RoomItem['desktop']) : undefined,
    hideMobile: field<boolean>(rec, 'hideMobile', false),
  };
}

function nodeBody(node: ScrapNode): Record<string, unknown> {
  return { type: node.type, title: node.title, parent: node.parentId ?? '', tags: node.tags, order: node.order, cover: node.cover ?? '' };
}
function pageBody(page: ScrapPage): Record<string, unknown> {
  return { book: page.bookId, index: page.index, background: page.background ?? '' };
}
function elementBody(el: PageElement): Record<string, unknown> {
  const payload =
    el.kind === 'photo' ? { photo: el.photo, caption: el.caption } : el.kind === 'note' ? { text: el.text } : { icon: el.icon };
  return { page: el.pageId, kind: el.kind, payload, x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation, z: el.z, opacity: el.opacity };
}
function roomBody(room: Room): Record<string, unknown> {
  return { wallId: room.wallId, floorId: room.floorId, dayNightMode: room.dayNightMode, referenceTz: room.referenceTz };
}
function roomItemBody(item: RoomItem): Record<string, unknown> {
  return {
    catalogId: item.catalogId,
    layer: item.layer,
    z: item.z,
    attachTo: item.attachTo ?? '',
    color: item.color,
    desktop: item.desktop,
    mobile: item.mobile ?? null,
    hideMobile: item.hideMobile ?? false,
  };
}

async function seedIfEmpty(client: PocketBase): Promise<void> {
  const nodes = await client.collection('nodes').getFullList();
  if (nodes.length === 0) {
    const content = createSeedData().content;
    const idMap = new Map<string, string>();
    for (const node of content.nodes) {
      const rec = await client.collection('nodes').create({ ...nodeBody(node), parent: node.parentId ? idMap.get(node.parentId) ?? '' : '' });
      idMap.set(node.id, rec.id);
    }
    const pageMap = new Map<string, string>();
    for (const page of content.pages) {
      const rec = await client.collection('pages').create({ ...pageBody(page), book: idMap.get(page.bookId) ?? '' });
      pageMap.set(page.id, rec.id);
    }
    for (const el of content.elements) {
      await client.collection('elements').create({ ...elementBody(el), page: pageMap.get(el.pageId) ?? '' });
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
      const rec = await client.collection('room_items').create({ ...roomItemBody(item), attachTo: item.attachTo ? idMap.get(item.attachTo) ?? '' : '' });
      idMap.set(item.id, rec.id);
    }
    roomRecs = await client.collection('room').getFullList();
  }
  const itemRecs = await client.collection('room_items').getFullList();
  return { room: mapRoom(roomRecs[0]), items: itemRecs.map(mapRoomItem) };
}

export const pbBackend: Backend = {
  kind: 'pocketbase',
  async fetchAll(): Promise<AppData | null> {
    const client = pb;
    if (!client) return null;
    await seedIfEmpty(client);
    const [nodes, pages, elements] = await Promise.all([
      client.collection('nodes').getFullList(),
      client.collection('pages').getFullList(),
      client.collection('elements').getFullList(),
    ]);
    const { room, items } = await ensureRoom(client);
    return {
      version: 1,
      content: { nodes: nodes.map(mapNode), pages: pages.map(mapPage), elements: elements.map(mapElement) },
      room,
      roomItems: items,
    };
  },
  persistLocal: noop,
  nodeCreate(node) {
    void pb?.collection('nodes').create({ id: node.id, ...nodeBody(node) }).catch((e) => console.error('nodeCreate', e));
  },
  nodeUpdate(node) {
    void pb?.collection('nodes').update(node.id, nodeBody(node)).catch((e) => console.error('nodeUpdate', e));
  },
  nodeDelete(id) {
    void (async () => {
      const client = pb;
      if (!client) return;
      const nodes = await client.collection('nodes').getFullList();
      const doomed = new Set<string>();
      const collect = (rootId: string) => {
        doomed.add(rootId);
        nodes.filter((n) => field<string>(n, 'parent', '') === rootId).forEach((n) => collect(n.id));
      };
      collect(id);
      const pages = await client.collection('pages').getFullList();
      const pageIds = pages.filter((p) => doomed.has(field<string>(p, 'book', ''))).map((p) => p.id);
      const elements = await client.collection('elements').getFullList();
      await Promise.all(
        elements.filter((el) => pageIds.includes(field<string>(el, 'page', ''))).map((el) => client.collection('elements').delete(el.id)),
      );
      await Promise.all(pageIds.map((pid) => client.collection('pages').delete(pid)));
      await Promise.all([...doomed].map((nid) => client.collection('nodes').delete(nid)));
    })().catch((e) => console.error('nodeDelete', e));
  },
  pageCreate(page) {
    void pb?.collection('pages').create({ id: page.id, ...pageBody(page) }).catch((e) => console.error('pageCreate', e));
  },
  elementCreate(el) {
    void pb?.collection('elements').create({ id: el.id, ...elementBody(el) }).catch((e) => console.error('elementCreate', e));
  },
  elementUpdate(el) {
    void pb?.collection('elements').update(el.id, elementBody(el)).catch((e) => console.error('elementUpdate', e));
  },
  elementDelete(id) {
    void pb?.collection('elements').delete(id).catch((e) => console.error('elementDelete', e));
  },
  roomUpdate(room) {
    void (async () => {
      const client = pb;
      if (!client) return;
      const recs = await client.collection('room').getFullList();
      if (recs[0]) await client.collection('room').update(recs[0].id, roomBody(room));
    })().catch((e) => console.error('roomUpdate', e));
  },
  roomItemCreate(item) {
    void pb?.collection('room_items').create({ id: item.id, ...roomItemBody(item) }).catch((e) => console.error('roomItemCreate', e));
  },
  roomItemUpdate(item) {
    void pb?.collection('room_items').update(item.id, roomItemBody(item)).catch((e) => console.error('roomItemUpdate', e));
  },
  roomItemDelete(id) {
    void pb?.collection('room_items').delete(id).catch((e) => console.error('roomItemDelete', e));
  },
  subscribe(onChange) {
    const client = pb;
    if (!client) return;
    for (const name of ['nodes', 'pages', 'elements', 'room', 'room_items']) {
      void client.collection(name).subscribe('*', () => onChange()).catch((e) => console.error('subscribe', e));
    }
  },
};

export const backend: Backend = pbEnabled ? pbBackend : localBackend;

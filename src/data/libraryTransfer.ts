import type {
  CalendarEvent,
  ImagePreset,
  MediaAsset,
  PageElement,
  Room,
  RoomItem,
  ScrapNode,
  ScrapPage,
  StoredLayout,
} from './types';
import { useAppStore } from '@/stores/app';
import { blobToDataUrl, dataUrlToFile } from './bookTransfer';
import { deleteMedia, getMediaBlob, uploadMedia } from './media';
import { backend } from './backend';
import { newId } from '@/utils/id';
import { clone } from '@/utils/clone';
import { getCatalogItem } from '@/catalog/catalog';
import { PAPERS } from '@/scrapbook/paper';
import { cleanImportedElement, isFiniteNumber } from './importSanitize';

export const LIBRARY_FORMAT = 'journeybook.library';
export const LIBRARY_VERSION = 1;

interface LibraryMedia {
  id: string;
  name: string;
  dataUrl: string;
}

interface LibraryData {
  content: {
    nodes: ScrapNode[];
    pages: ScrapPage[];
    elements: PageElement[];
    media: MediaAsset[];
  };
  room: Room;
  roomItems: RoomItem[];
  events: CalendarEvent[];
  layouts: StoredLayout[];
  presets: ImagePreset[];
}

interface LibraryFile {
  format: string;
  version: number;
  exportedAt: string;
  data: LibraryData;
  media: LibraryMedia[];
}

interface PreparedLibraryMedia {
  asset: MediaAsset;
  name: string;
  dataUrl: string;
}

export interface PreparedLibraryImport {
  data: LibraryData;
  media: PreparedLibraryMedia[];
  skipped: number;
}

const COVERS = new Set(['rose', 'sage', 'mustard', 'terracotta', 'sky', 'kraft']);
const PAPER_IDS = new Set([...PAPERS.map((paper) => paper.id), 'none']);

function uniqueIds(items: Array<{ id: string }>, label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.id || seen.has(item.id)) throw new Error(`Invalid ${label} IDs`);
    seen.add(item.id);
  }
}

/**
 * Re-key a library on import and rewrite every reference. This avoids collisions
 * with live/soft-deleted IDs and guarantees no imported element points at a
 * missing page or photo.
 */
export function prepareLibraryImport(file: LibraryFile): PreparedLibraryImport {
  const content = file.data.content;
  const nodes = content.nodes;
  const pages = content.pages;
  const elements = content.elements;
  uniqueIds(nodes, 'node');
  uniqueIds(pages, 'page');
  uniqueIds(elements, 'element');
  uniqueIds(content.media, 'media');
  uniqueIds(file.data.roomItems, 'room item');
  uniqueIds(file.data.events, 'event');
  uniqueIds(file.data.layouts, 'layout');
  uniqueIds(file.data.presets, 'preset');

  const nodeMap = new Map(nodes.map((node) => [node.id, newId()]));
  const bookMap = new Map<string, string>();
  const remappedNodes = nodes.map((node) => {
    const id = nodeMap.get(node.id)!;
    const parentId = node.parentId ? (nodeMap.get(node.parentId) ?? null) : null;
    const next = {
      ...node,
      id,
      parentId,
      type: node.type === 'folder' ? ('folder' as const) : ('scrapbook' as const),
      cover: node.cover && COVERS.has(node.cover) ? node.cover : undefined,
      tags: Array.isArray(node.tags) ? node.tags : [],
      order: isFiniteNumber(node.order) ? node.order : 0,
    };
    if (node.type !== 'folder') bookMap.set(node.id, id);
    return next;
  });

  const presetMap = new Map(file.data.presets.map((preset) => [preset.id, newId()]));
  const pageMap = new Map(pages.map((page) => [page.id, newId()]));
  const groupMaps = new Map<string, Map<string, string>>();
  const remappedPages: ScrapPage[] = [];
  const validPageIds = new Set<string>();
  let skipped = 0;
  for (const page of pages) {
    const bookId = bookMap.get(page.bookId);
    if (!bookId) {
      skipped++;
      continue;
    }
    const id = pageMap.get(page.id)!;
    const groups = Array.isArray(page.groups) ? page.groups : [];
    const groupMap = new Map(groups.map((group) => [group.id, newId()]));
    groupMaps.set(page.id, groupMap);
    const nextGroups = groups.map((group) => ({
      ...group,
      id: groupMap.get(group.id)!,
    }));
    validPageIds.add(page.id);
    remappedPages.push({
      ...page,
      id,
      bookId,
      index: isFiniteNumber(page.index) ? page.index : remappedPages.length,
      background: page.background && PAPER_IDS.has(page.background) ? page.background : undefined,
      groups: nextGroups.length ? nextGroups : undefined,
    });
  }

  const storedById = new Map((file.media ?? []).map((item) => [item.id, item]));
  const mediaMap = new Map<string, string>();
  const preparedMedia: PreparedLibraryMedia[] = [];
  for (const asset of content.media) {
    const bookId = bookMap.get(asset.bookId);
    const stored = storedById.get(asset.id);
    if (!bookId || !stored?.dataUrl) {
      skipped++;
      continue;
    }
    const id = newId();
    mediaMap.set(asset.id, id);
    preparedMedia.push({
      asset: { ...asset, id, bookId, fileName: undefined },
      name: stored.name || asset.name || 'photo',
      dataUrl: stored.dataUrl,
    });
  }

  const remappedElements: PageElement[] = [];
  for (const element of elements) {
    const pageId = pageMap.get(element.pageId);
    if (!pageId || !validPageIds.has(element.pageId)) {
      skipped++;
      continue;
    }
    const pageOldId = pages.find((page) => pageMap.get(page.id) === pageId)?.id;
    const clean = cleanImportedElement(
      element,
      pageId,
      mediaMap,
      pageOldId ? (groupMaps.get(pageOldId) ?? new Map()) : new Map(),
      presetMap,
    );
    if (clean) remappedElements.push(clean);
    else skipped++;
  }

  const roomItemMap = new Map(file.data.roomItems.map((item) => [item.id, newId()]));
  const validRoomItemIds = new Set(
    file.data.roomItems.filter((item) => !!getCatalogItem(item.catalogId)).map((item) => item.id),
  );
  const remappedRoomItems: RoomItem[] = [];
  for (const item of file.data.roomItems) {
    if (!validRoomItemIds.has(item.id)) {
      skipped++;
      continue;
    }
    remappedRoomItems.push({
      ...item,
      id: roomItemMap.get(item.id)!,
      attachTo:
        item.attachTo && validRoomItemIds.has(item.attachTo)
          ? roomItemMap.get(item.attachTo)
          : undefined,
    });
  }

  const remappedLayouts: StoredLayout[] = [];
  for (const layout of file.data.layouts) {
    const layoutItems = Array.isArray(layout.items) ? layout.items : [];
    const validItems = layoutItems.filter((item) => !!getCatalogItem(item.catalogId));
    skipped += layoutItems.length - validItems.length;
    const itemMap = new Map(validItems.map((item) => [item.id, newId()]));
    remappedLayouts.push({
      ...layout,
      id: newId(),
      items: validItems.map((item) => ({
        ...item,
        id: itemMap.get(item.id)!,
        attachTo:
          item.attachTo && itemMap.has(item.attachTo) ? itemMap.get(item.attachTo) : undefined,
      })),
    });
  }

  return {
    data: {
      content: {
        nodes: remappedNodes,
        pages: remappedPages,
        elements: remappedElements,
        media: preparedMedia.map((item) => item.asset),
      },
      room: file.data.room,
      roomItems: remappedRoomItems,
      events: file.data.events.map((event) => ({ ...event, id: newId() })),
      layouts: remappedLayouts,
      presets: file.data.presets.map((preset) => ({
        ...preset,
        id: presetMap.get(preset.id)!,
      })),
    },
    media: preparedMedia,
    skipped,
  };
}

/** Serialize the whole library — every book, photo, entry and layout — into one file. */
export async function exportLibrary(): Promise<string> {
  const app = useAppStore();
  const media: LibraryMedia[] = [];
  for (const asset of app.data.content.media) {
    const blob = await getMediaBlob(asset);
    if (blob) media.push({ id: asset.id, name: asset.name, dataUrl: await blobToDataUrl(blob) });
  }
  const file: LibraryFile = {
    format: LIBRARY_FORMAT,
    version: LIBRARY_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      content: app.data.content,
      room: app.data.room,
      roomItems: app.data.roomItems,
      events: app.data.events,
      layouts: await app.listLayouts(),
      presets: app.imagePresets,
    },
    media,
  };
  return JSON.stringify(file);
}

function isLibraryFile(value: unknown): value is LibraryFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<LibraryFile>;
  const data = file.data;
  return (
    file.format === LIBRARY_FORMAT &&
    file.version === LIBRARY_VERSION &&
    !!data &&
    !!data.content &&
    Array.isArray(data.content.nodes) &&
    Array.isArray(data.content.pages) &&
    Array.isArray(data.content.elements) &&
    Array.isArray(data.content.media) &&
    !!data.room &&
    Array.isArray(data.roomItems) &&
    Array.isArray(data.events) &&
    Array.isArray(data.layouts) &&
    Array.isArray(data.presets) &&
    Array.isArray(file.media)
  );
}

/**
 * Replace the entire library with an exported file. The current contents are
 * moved to the trash first, so the import can be undone. Affects both users.
 */
export async function importLibrary(json: string): Promise<void> {
  const app = useAppStore();
  const file = JSON.parse(json) as unknown;
  if (!isLibraryFile(file)) throw new Error('Not a Journeybook library file');
  const prepared = prepareLibraryImport(file);

  app.setSyncPaused(true);
  const uploaded: MediaAsset[] = [];
  let applied = false;
  try {
    // Upload the re-keyed bytes before touching the live library. If any image
    // cannot be restored, leave the current library exactly as it was.
    for (const item of prepared.media) {
      try {
        const fileName = await uploadMedia(
          item.asset,
          dataUrlToFile(item.dataUrl, item.name || 'photo.jpg'),
        );
        if (fileName) item.asset.fileName = fileName;
        uploaded.push(item.asset);
      } catch (error) {
        console.error('importLibrary media', error);
      }
    }
    if (uploaded.length !== prepared.media.length) {
      for (const asset of uploaded) await deleteMedia(asset);
      throw new Error('Not every photo could be restored');
    }

    // Make the change reversible: send everything currently here to the trash.
    // The room itself is a singleton, so keep a named layout snapshot of it
    // alongside the old layouts/presets.
    const oldLayouts = await app.listLayouts();
    const oldPresets = [...app.imagePresets];
    const roomSnapshot = await app.saveNamedLayout(
      `Before import ${new Date().toISOString().slice(0, 10)}`,
      clone(app.data.room),
      clone(app.data.roomItems),
    );
    app.trashRecords('layout', roomSnapshot.name, [
      { collection: 'room_layouts', id: roomSnapshot.id, record: clone(roomSnapshot) },
    ]);
    for (const layout of oldLayouts) {
      app.trashRecords('layout', layout.name, [
        { collection: 'room_layouts', id: layout.id, record: clone(layout) },
      ]);
    }
    for (const preset of oldPresets) {
      app.trashRecords('preset', preset.name, [
        { collection: 'image_presets', id: preset.id, record: clone(preset) },
      ]);
    }
    app.imagePresets = [];
    for (const node of app.data.content.nodes.filter((n) => !n.parentId)) app.deleteNode(node.id);
    for (const event of [...app.data.events]) app.deleteEvent(event.id);
    app.data.content = { nodes: [], pages: [], elements: [], media: [] };
    app.data.events = [];
    app.save();

    const { content, room, roomItems, events, layouts, presets } = prepared.data;
    app.data.content = content;
    app.data.room = room;
    app.data.roomItems = roomItems;
    app.data.events = events;
    app.save();
    applied = true;

    for (const node of content.nodes) backend.nodeCreate(node);
    for (const page of content.pages) backend.pageCreate(page);
    for (const element of content.elements) backend.elementCreate(element);
    for (const event of events) backend.eventSave(event);
    backend.applyRoomLayout(room, roomItems);
    for (const layout of layouts) await backend.saveLayout(layout);
    for (const preset of presets) await backend.saveImagePreset(preset);

    await app.resolveMedia();
    await app.loadImagePresets();
    await app.loadTrash();
    if (prepared.skipped > 0) {
      console.warn(`importLibrary skipped ${prepared.skipped} invalid record(s)`);
    }
  } catch (error) {
    if (!applied) {
      for (const asset of uploaded) await deleteMedia(asset);
    }
    throw error;
  } finally {
    app.setSyncPaused(false);
  }
}

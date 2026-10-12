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
import { getMediaBlob, uploadMedia } from './media';
import { backend } from './backend';

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
  return (
    file.format === LIBRARY_FORMAT && !!file.data?.content && Array.isArray(file.data.content.nodes)
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
  const { content, room, roomItems, events, layouts, presets } = file.data;

  app.setSyncPaused(true);
  try {
    // Make the change reversible: send everything currently here to the trash.
    for (const node of app.data.content.nodes.filter((n) => !n.parentId)) app.deleteNode(node.id);
    for (const event of [...app.data.events]) app.deleteEvent(event.id);
    app.data.content = { nodes: [], pages: [], elements: [], media: [] };
    app.data.events = [];
    app.save();

    // Re-upload the photos, keeping their ids so element references stay valid.
    for (const stored of file.media) {
      const asset = content.media.find((m) => m.id === stored.id);
      if (!asset) continue;
      try {
        const fileName = await uploadMedia(
          asset,
          dataUrlToFile(stored.dataUrl, stored.name || 'photo.jpg'),
        );
        if (fileName) asset.fileName = fileName;
      } catch (e) {
        console.error('importLibrary media', e);
      }
    }

    app.data.content = { ...content };
    app.data.room = room;
    app.data.roomItems = roomItems;
    app.data.events = events;
    app.save();

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
  } finally {
    app.setSyncPaused(false);
  }
}

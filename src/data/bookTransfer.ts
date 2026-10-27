import type { PageElement, PageGroup, ScrapNode } from './types';
import { useAppStore } from '@/stores/app';
import { getMediaBlob } from './media';
import { cleanImportedElement } from './importSanitize';
import { PAPERS } from '@/scrapbook/paper';
import { newId } from '@/utils/id';

export const BOOK_FILE_FORMAT = 'journeybook.book';
export const BOOK_FILE_VERSION = 1;

interface BookFileMedia {
  id: string;
  name: string;
  dataUrl: string;
}

interface BookFilePage {
  id: string;
  index: number;
  background?: string;
  paperColors?: Record<string, string>;
  groups?: PageGroup[];
}

interface BookFile {
  format: string;
  version: number;
  exportedAt: string;
  book: { title: string; cover?: string };
  pages: BookFilePage[];
  elements: PageElement[];
  media: BookFileMedia[];
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToFile(dataUrl: string, name: string): File {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

/** Serialize one book — pages, elements and the album images — into a self-contained file. */
export async function exportBookData(bookId: string): Promise<string> {
  const app = useAppStore();
  const node = app.node(bookId);
  if (!node) throw new Error('Book not found');
  const pages = app.pagesOf(bookId);
  const pageIds = new Set(pages.map((p) => p.id));
  const elements = app.data.content.elements
    .filter((e) => pageIds.has(e.pageId))
    .map((e) => ({ ...e }));

  const media: BookFileMedia[] = [];
  for (const asset of app.mediaFor(bookId)) {
    const blob = await getMediaBlob(asset);
    if (blob) media.push({ id: asset.id, name: asset.name, dataUrl: await blobToDataUrl(blob) });
  }

  const file: BookFile = {
    format: BOOK_FILE_FORMAT,
    version: BOOK_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    book: { title: node.title, cover: node.cover },
    pages: pages.map((p, i) => ({
      id: p.id,
      index: i,
      background: p.background,
      paperColors: p.paperColors,
      groups: p.groups,
    })),
    elements,
    media,
  };
  return JSON.stringify(file);
}

/** Create a new book from an exported file, under `parentId`. */
function isBookFile(value: unknown): value is BookFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<BookFile>;
  return (
    file.format === BOOK_FILE_FORMAT &&
    file.version === BOOK_FILE_VERSION &&
    Array.isArray(file.pages) &&
    Array.isArray(file.elements) &&
    Array.isArray(file.media)
  );
}

export async function importBookData(json: string, parentId: string | null): Promise<ScrapNode> {
  const app = useAppStore();
  const parsed = JSON.parse(json) as unknown;
  if (!isBookFile(parsed)) throw new Error('Not a Journeybook book file');
  const data = parsed;

  const pageIds = new Set<string>();
  const pages = [...data.pages]
    .filter((page) => {
      if (!page || typeof page.id !== 'string' || !page.id || pageIds.has(page.id)) return false;
      pageIds.add(page.id);
      return true;
    })
    .sort(
      (a, b) => (Number.isFinite(a.index) ? a.index : 0) - (Number.isFinite(b.index) ? b.index : 0),
    );

  const node = app.createNode('scrapbook', parentId, data.book?.title ?? 'Imported book');
  const cover = data.book?.cover;
  if (cover && ['rose', 'sage', 'mustard', 'terracotta', 'sky', 'kraft'].includes(cover)) {
    app.updateNode(node.id, { cover: cover as ScrapNode['cover'] });
  }

  const mediaMap = new Map<string, string>();
  for (const media of data.media) {
    if (!media || typeof media.id !== 'string' || typeof media.dataUrl !== 'string') continue;
    try {
      const asset = await app.addMedia(
        node.id,
        dataUrlToFile(media.dataUrl, media.name || 'photo.jpg'),
      );
      mediaMap.set(media.id, asset.id);
    } catch (e) {
      console.error('import media', e);
    }
  }

  const pageMap = new Map<string, string>();
  const groupMaps = new Map<string, Map<string, string>>();
  for (const source of pages) {
    const page = app.addPage(node.id);
    pageMap.set(source.id, page.id);
    const groups = Array.isArray(source.groups) ? source.groups : [];
    const groupMap = new Map(groups.map((group) => [group.id, newId()]));
    groupMaps.set(source.id, groupMap);
    const nextGroups = groups.map((group) => ({
      ...group,
      id: groupMap.get(group.id)!,
    }));
    const background =
      source.background && PAPERS.some((paper) => paper.id === source.background)
        ? source.background
        : undefined;
    if (background || nextGroups.length || source.paperColors) {
      app.updatePage(page.id, {
        background,
        paperColors: source.paperColors,
        groups: nextGroups.length ? nextGroups : undefined,
      });
    }
  }

  for (const element of data.elements) {
    const pageId = pageMap.get(element.pageId);
    if (!pageId) continue;
    const sourcePageId = pages.find((page) => pageMap.get(page.id) === pageId)?.id;
    const clean = cleanImportedElement(
      element,
      pageId,
      mediaMap,
      sourcePageId ? (groupMaps.get(sourcePageId) ?? new Map()) : new Map(),
      new Map(),
    );
    if (clean) app.putElement(clean);
  }

  return node;
}

/** Deep-copy a book (including its images) next to the original. */
export async function duplicateBook(bookId: string): Promise<ScrapNode> {
  const app = useAppStore();
  const node = app.node(bookId);
  const json = await exportBookData(bookId);
  const copy = await importBookData(json, node?.parentId ?? null);
  app.updateNode(copy.id, { title: `${node?.title ?? 'Book'} (copy)` });
  return copy;
}

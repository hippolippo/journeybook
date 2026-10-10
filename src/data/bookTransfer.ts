import type { PageElement, PageGroup, ScrapNode } from './types';
import { useAppStore } from '@/stores/app';
import { getMediaBlob } from './media';
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToFile(dataUrl: string, name: string): File {
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
  const elements = app.data.content.elements.filter((e) => pageIds.has(e.pageId)).map((e) => ({ ...e }));

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
export async function importBookData(json: string, parentId: string | null): Promise<ScrapNode> {
  const app = useAppStore();
  const data = JSON.parse(json) as Partial<BookFile>;
  if (!data || data.format !== BOOK_FILE_FORMAT || !Array.isArray(data.pages)) {
    throw new Error('Not a Journeybook book file');
  }

  const node = app.createNode('scrapbook', parentId, data.book?.title ?? 'Imported book');
  if (data.book?.cover) app.updateNode(node.id, { cover: data.book.cover as ScrapNode['cover'] });

  const mediaMap = new Map<string, string>();
  for (const m of data.media ?? []) {
    try {
      const asset = await app.addMedia(node.id, dataUrlToFile(m.dataUrl, m.name || 'photo.jpg'));
      mediaMap.set(m.id, asset.id);
    } catch (e) {
      console.error('import media', e);
    }
  }

  const pageMap = new Map<string, string>();
  const sorted = [...(data.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const p of sorted) {
    const page = app.addPage(node.id);
    pageMap.set(p.id, page.id);
    if (p.background || p.groups || p.paperColors)
      app.updatePage(page.id, { background: p.background, paperColors: p.paperColors, groups: p.groups });
  }

  for (const el of data.elements ?? []) {
    const pageId = pageMap.get(el.pageId);
    if (!pageId) continue;
    const copy = { ...el, id: newId(), pageId } as PageElement;
    if (copy.kind === 'image' && copy.mediaId) copy.mediaId = mediaMap.get(copy.mediaId) ?? copy.mediaId;
    app.putElement(copy);
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

import type { MediaAsset } from './types';
import { PB_URL, pb, pbEnabled } from './backend';

const DB_NAME = 'journeybook-media';
const STORE = 'blobs';

/** Runtime object URLs for locally stored blobs (local mode only). */
const urls = new Map<string, string>();

function isPbMedia(): boolean {
  return pbEnabled && PB_URL.length > 0;
}

function idbSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(id: string, blob: Blob): Promise<void> {
  if (!idbSupported()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(id: string): Promise<Blob | undefined> {
  if (!idbSupported()) return undefined;
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

async function idbDelete(id: string): Promise<void> {
  if (!idbSupported()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const pending = new Set<string>();

/** Build object URLs for locally stored album images so they render. */
export async function hydrateMedia(assets: MediaAsset[]): Promise<void> {
  if (isPbMedia()) return;
  for (const asset of assets) {
    await ensureMedia(asset);
  }
}

/**
 * Ensure a single asset has an object URL. Idempotent and safe to call from
 * render code, so images recover if the in-memory cache is ever dropped.
 */
export async function ensureMedia(asset: MediaAsset): Promise<void> {
  if (isPbMedia() || urls.has(asset.id) || pending.has(asset.id)) return;
  pending.add(asset.id);
  try {
    const blob = await idbGet(asset.id);
    if (blob) urls.set(asset.id, URL.createObjectURL(blob));
  } catch (e) {
    console.error('ensureMedia', e);
  } finally {
    pending.delete(asset.id);
  }
}

/** Store the bytes; returns the PocketBase file name (undefined in local mode). */
export async function uploadMedia(asset: MediaAsset, file: File): Promise<string | undefined> {
  if (isPbMedia() && pb) {
    const rec = await pb.collection('media').create({
      id: asset.id,
      book: asset.bookId,
      name: asset.name,
      file,
    });
    return (rec as unknown as { file: string }).file;
  }
  await idbPut(asset.id, file);
  urls.set(asset.id, URL.createObjectURL(file));
  return undefined;
}

export async function deleteMedia(asset: MediaAsset): Promise<void> {
  const url = urls.get(asset.id);
  if (url) {
    URL.revokeObjectURL(url);
    urls.delete(asset.id);
  }
  if (isPbMedia() && pb) {
    try {
      await pb.collection('media').delete(asset.id);
    } catch (e) {
      console.error('deleteMedia', e);
    }
    return;
  }
  await idbDelete(asset.id);
}

/** Read the raw bytes of an album image (for export). */
export async function getMediaBlob(asset: MediaAsset): Promise<Blob | undefined> {
  if (isPbMedia() && pb) {
    const url = mediaUrl(asset);
    if (!url) return undefined;
    try {
      const res = await fetch(url);
      return await res.blob();
    } catch (e) {
      console.error('getMediaBlob', e);
      return undefined;
    }
  }
  try {
    return await idbGet(asset.id);
  } catch (e) {
    console.error('getMediaBlob', e);
    return undefined;
  }
}

export function mediaUrl(asset: MediaAsset | undefined): string {
  if (!asset) return '';
  if (isPbMedia() && pb) {
    if (!asset.fileName) return '';
    return pb.files.getURL({ id: asset.id, collectionName: 'media' }, asset.fileName);
  }
  return urls.get(asset.id) ?? '';
}

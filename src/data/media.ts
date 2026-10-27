import type { MediaAsset } from './types';
import { PB_URL, pb, pbEnabled } from './backend';
import { idbDelete, idbGet, idbPut } from './mediaStore';

/** PocketBase thumbnail sizes requested by the UI (must exist in the media field). */
export const MEDIA_THUMB_SMALL = '480x480';
export const MEDIA_THUMB_LARGE = '1200x1200f';

/** Runtime object URLs for locally stored blobs (local mode only). */
const urls = new Map<string, string>();
let fileToken = '';
let tokenTimer: ReturnType<typeof setInterval> | undefined;

function isPbMedia(): boolean {
  return pbEnabled && PB_URL.length > 0;
}

/** Refresh the short-lived token required by Protected media files. */
export async function refreshMediaToken(): Promise<void> {
  if (!isPbMedia() || !pb) return;
  try {
    fileToken = await pb.files.getToken();
  } catch (e) {
    console.error('refreshMediaToken', e);
    fileToken = '';
  }
}

export function clearMediaToken(): void {
  fileToken = '';
  if (tokenTimer) clearInterval(tokenTimer);
  tokenTimer = undefined;
}

/** PocketBase file tokens expire; refresh well before a long-open tab breaks. */
export function startMediaTokenRefresh(): void {
  if (!isPbMedia() || tokenTimer) return;
  tokenTimer = setInterval(() => void refreshMediaToken(), 30 * 60 * 1000);
}

export function mediaToken(): string {
  return fileToken;
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
    const fileName = (rec as unknown as { file?: string }).file;
    if (!fileName) throw new Error('Upload did not store a file');
    return fileName;
  }
  await idbPut(asset.id, file);
  urls.set(asset.id, URL.createObjectURL(file));
  return undefined;
}

export function releaseMediaUrl(id: string): void {
  const url = urls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urls.delete(id);
  }
}

/** Drop object URLs for media that is no longer live (after purge/reload). */
export function pruneMediaUrls(activeIds: Set<string>): void {
  for (const id of [...urls.keys()]) {
    if (!activeIds.has(id)) releaseMediaUrl(id);
  }
}

export async function deleteMedia(asset: MediaAsset): Promise<void> {
  releaseMediaUrl(asset.id);
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
    if (!fileToken) await refreshMediaToken();
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

export function mediaUrl(asset: MediaAsset | undefined, thumb?: string): string {
  if (!asset) return '';
  if (isPbMedia() && pb) {
    if (!asset.fileName) return '';
    return pb.files.getURL({ id: asset.id, collectionName: 'media' }, asset.fileName, {
      ...(thumb ? { thumb } : {}),
      ...(fileToken ? { token: fileToken } : {}),
    });
  }
  return urls.get(asset.id) ?? '';
}

import type { AppData, ImagePreset, Note, StoredLayout, TrashItem } from './types';

const KEY = 'journeybook:remote-snapshot:v1';

export interface RemoteSnapshot {
  version: 1;
  savedAt: number;
  /** The account that owned the cached private notes. */
  ownerId?: string;
  data?: AppData;
  notes?: Note[];
  trash?: TrashItem[];
  layouts?: StoredLayout[];
  presets?: ImagePreset[];
}

export function readRemoteSnapshot(): RemoteSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const snapshot = parsed as Partial<RemoteSnapshot>;
    if (snapshot.version !== 1 || typeof snapshot.savedAt !== 'number') return null;
    return snapshot as RemoteSnapshot;
  } catch {
    return null;
  }
}

/** Merge one successful remote slice into the on-device fallback. */
export function updateRemoteSnapshot(patch: Partial<RemoteSnapshot>): void {
  const previous = readRemoteSnapshot();
  const next: RemoteSnapshot = {
    ...(previous ?? { version: 1, savedAt: Date.now() }),
    ...patch,
    version: 1,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* A full browser must not block live data. */
  }
}

export function clearRemoteSnapshot(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

import type { AppData, ImagePreset, StoredLayout, TrashItem } from './types';

const KEY = 'journeybook:v1';
const LAYOUTS_KEY = 'journeybook:layouts:v1';
const PRESETS_KEY = 'journeybook:image-presets:v1';
const TRASH_KEY = 'journeybook:trash:v1';
const QUARANTINE_PREFIX = 'journeybook:v1.corrupt:';

/**
 * Preserve an unreadable payload under a timestamped key instead of letting the
 * next save overwrite it. The original bytes stay recoverable by hand.
 */
function quarantine(raw: string): void {
  try {
    localStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
  } catch {
    /* nothing more we can do */
  }
}

export function loadData(): AppData | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: AppData | null = null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || (value as AppData).version !== 1) {
      quarantine(raw);
      return null;
    }
    parsed = value as AppData;
  } catch {
    quarantine(raw);
    return null;
  }
  if (!parsed.content.media) parsed.content.media = [];
  if (!Array.isArray(parsed.events)) parsed.events = [];
  return parsed;
}

/**
 * Persist local data. Throws on failure (e.g. quota exceeded) so the caller can
 * surface it rather than losing the write silently.
 */
export function saveData(data: AppData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearData(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function loadLayouts(): StoredLayout[] {
  try {
    const raw = localStorage.getItem(LAYOUTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredLayout[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLayouts(list: StoredLayout[]): void {
  try {
    localStorage.setItem(LAYOUTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function loadPresets(): ImagePreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImagePreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePresets(list: ImagePreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function loadTrashItems(): TrashItem[] {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrashItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrashItems(items: TrashItem[]): void {
  try {
    if (items.length) localStorage.setItem(TRASH_KEY, JSON.stringify(items));
    else localStorage.removeItem(TRASH_KEY);
  } catch {
    /* ignore */
  }
}

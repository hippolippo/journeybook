import type { AppData, ImagePreset, StoredLayout } from './types';

const KEY = 'journeybook:v1';
const LAYOUTS_KEY = 'journeybook:layouts:v1';
const PRESETS_KEY = 'journeybook:image-presets:v1';

export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null;
    if (!parsed.content.media) parsed.content.media = [];
    if (!Array.isArray(parsed.events)) parsed.events = [];
    return parsed;
  } catch {
    return null;
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable */
  }
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

import type { Band, CatalogItem, Category, ColorPreset, EffectDef } from './types';
import type { Layer } from '@/data/types';
import type { StickerDef, TapeDef } from '@/scrapbook/decor';

/**
 * Artist-facing definition. Provide it either as a sidecar JSON file next to the
 * SVG (same basename + `.json`), or embedded in the SVG inside a
 * `<metadata>{ … }</metadata>` block. No application code needs changing.
 */
export interface AssetDefinition {
  kind?: 'room' | 'sticker' | 'tape';
  id?: string;
  label?: string;
  category?: Category;
  layer?: Layer;
  band?: Band;
  aspect?: number;
  defaultScale?: number;
  defaultRotation?: number;
  attach?: CatalogItem['attach'];
  tint?: boolean;
  defaultColor?: string;
  colorSlots?: CatalogItem['colorSlots'];
  presets?: ColorPreset[];
  effect?: EffectDef | EffectDef[] | null;
  art?: { day?: string; night?: string };
  raw?: boolean;
  /** room: tile the art across the band — "x" | "y" | "both". */
  repeat?: 'x' | 'y' | 'both';
  /** tape opacity (0–1). */
  opacity?: number;
}

const urls = import.meta.glob('/src/assets/svg/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const raws = import.meta.glob('/src/assets/svg/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const defFiles = import.meta.glob('/src/assets/svg/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const DIR = '/src/assets/svg/';
function fileOf(path: string): string {
  return path.slice(DIR.length);
}
function baseName(path: string): string {
  return fileOf(path).replace(/\.svg$/, '');
}
function urlOf(name?: string): string | undefined {
  return name ? urls[`${DIR}${name}`] : undefined;
}
function rawOf(name?: string): string | undefined {
  return name ? raws[`${DIR}${name}`] : undefined;
}
function hasSvg(name: string): boolean {
  return `${DIR}${name}` in urls;
}

function parseEmbedded(raw: string): AssetDefinition | null {
  const match = /<metadata[^>]*>([\s\S]*?)<\/metadata>/i.exec(raw);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as AssetDefinition;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Merge embedded SVG metadata with a same-named sidecar JSON (sidecar wins). */
function collect(): AssetDefinition[] {
  const byId = new Map<string, AssetDefinition>();

  // embedded metadata in any SVG
  for (const [path, raw] of Object.entries(raws)) {
    const meta = parseEmbedded(raw);
    if (!meta) continue;
    const base = baseName(path);
    const id = meta.id ?? base;
    byId.set(id, { ...meta, id, art: { day: meta.art?.day ?? `${base}.svg`, ...meta.art } });
  }

  // sidecar JSON files (may contain one object or an array)
  for (const [path, value] of Object.entries(defFiles)) {
    const list = Array.isArray(value) ? value : [value];
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const meta = entry as AssetDefinition;
      const base = fileOf(path).replace(/\.json$/, '');
      const id = meta.id ?? base;
      const existing = byId.get(id) ?? {};
      byId.set(id, {
        ...existing,
        ...meta,
        id,
        art: { day: meta.art?.day ?? existing.art?.day ?? `${base}.svg`, ...existing.art, ...meta.art },
      });
    }
  }

  return [...byId.values()];
}

function toCatalogItem(def: AssetDefinition): CatalogItem | null {
  const id = def.id as string;
  const dayName = def.art?.day ?? `${id}.svg`;
  const day = urlOf(dayName);
  if (!day) return null;
  const nightName = def.art?.night ?? (hasSvg(`${id}-night.svg`) ? `${id}-night.svg` : undefined);
  const colorSlots = def.colorSlots ?? [];
  const raw = def.raw || colorSlots.length > 0 ? rawOf(dayName) : undefined;
  return {
    id,
    label: def.label ?? id,
    category: def.category ?? 'trinket',
    layer: def.layer ?? 'surface',
    band: def.band ?? 'floor',
    aspect: def.aspect ?? 1,
    defaultScale: def.defaultScale ?? 0.2,
    defaultRotation: def.defaultRotation ?? 0,
    art: { day, night: urlOf(nightName) },
    colorSlots,
    attach: def.attach,
    effect: def.effect ?? null,
    presets: def.presets,
    repeat: def.repeat,
    raw,
  };
}

function toSticker(def: AssetDefinition): StickerDef | null {
  const id = def.id as string;
  const dayName = def.art?.day ?? `${id}.svg`;
  const art = urlOf(dayName);
  if (!art) return null;
  return {
    id,
    label: def.label ?? id,
    art,
    tint: def.tint ?? false,
    aspect: def.aspect ?? 1,
    defaultColor: def.defaultColor,
  };
}

function toTape(def: AssetDefinition): TapeDef | null {
  const id = def.id as string;
  const dayName = def.art?.day ?? `${id}.svg`;
  const mask = urlOf(dayName);
  if (!mask) return null;
  return {
    id,
    label: def.label ?? id,
    mask,
    aspect: def.aspect ?? 3.4,
    defaultColor: def.defaultColor ?? '#f2e3c0',
    opacity: def.opacity ?? 0.9,
  };
}

const defs = collect();

export const loadedRoomItems: CatalogItem[] = defs
  .filter((d) => (d.kind ?? 'room') === 'room')
  .map(toCatalogItem)
  .filter((d): d is CatalogItem => !!d);

export const loadedStickers: StickerDef[] = defs
  .filter((d) => d.kind === 'sticker')
  .map(toSticker)
  .filter((d): d is StickerDef => !!d);

export const loadedTapes: TapeDef[] = defs
  .filter((d) => d.kind === 'tape')
  .map(toTape)
  .filter((d): d is TapeDef => !!d);

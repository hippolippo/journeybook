import type { ArtVariantVisuals, Band, CatalogItem, Category, ColorPreset, ColorSlot, EffectDef } from './types';
import type { AnimationDef } from './animation';
import type { ParticleDef } from './particles';
import type { Layer } from '@/data/types';
import type { StickerDef, TapeDef } from '@/scrapbook/decor';
import type { FrameDef, FrameInsets } from '@/scrapbook/frames';
import type { Paper, PaperLayer } from '@/scrapbook/paper';

/** One time-of-day art variant: a source file plus optional visuals. */
export interface ArtVariantDef {
  src?: string;
  animations?: AnimationDef[];
  particles?: ParticleDef[];
}

type ArtValue = string | ArtVariantDef;

/** One paper layer: a tile, an edge band, or corner motifs. */
export interface PaperLayerDef {
  art?: string;
  colorSlots?: ColorSlot[];
  presets?: ColorPreset[];
  opacity?: number;
  scale?: number;
}

/**
 * Artist-facing definition. Provide it either as a sidecar JSON file next to the
 * SVG (same basename + `.json`), or embedded in the SVG inside a
 * `<metadata>{ … }</metadata>` block. No application code needs changing.
 */
export interface AssetDefinition {
  kind?: 'room' | 'sticker' | 'tape' | 'frame' | 'paper';
  id?: string;
  label?: string;
  category?: Category;
  layer?: Layer;
  band?: Band;
  aspect?: number;
  defaultScale?: number;
  defaultRotation?: number;
  attach?: CatalogItem['attach'];
  /** Can hold surface items (a resting surface: desk, shelf, …). */
  host?: boolean;
  tint?: boolean;
  defaultColor?: string;
  colorSlots?: CatalogItem['colorSlots'];
  presets?: ColorPreset[];
  effect?: EffectDef | EffectDef[] | null;
  /** Generic, data-defined animations (all variants). */
  animations?: AnimationDef[];
  /** Generic, data-defined particle systems (all variants). */
  particles?: ParticleDef[];
  /** Day/night art; each may be a file name or a variant with its own visuals. */
  art?: { day?: ArtValue; night?: ArtValue };
  raw?: boolean;
  /** room: tile the art across the band — "x" | "y" | "both". */
  repeat?: 'x' | 'y' | 'both';
  /** tape opacity (0–1). */
  opacity?: number;
  /** frame: crop-window insets as fractions of the element box (0–1). */
  insets?: FrameInsets;
  contentAspect?: number;
  radius?: number;
  clip?: 'circle' | 'arch';
  caption?: boolean;
  bg?: string;
  colorable?: boolean;
  /** paper: base colour, ruled-line ink, whether to draw rules, dark pages. */
  color?: string;
  ink?: string;
  lined?: boolean;
  dark?: boolean;
  fill?: PaperLayerDef;
  border?: PaperLayerDef;
  corners?: PaperLayerDef;
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

/** Resolve a bare `assets/svg` file name referenced inside a definition. */
function resolveSvgRef(svg: string | undefined): string | undefined {
  if (!svg) return svg;
  const isBareName = !svg.includes('/') && !svg.startsWith('data:') && /\.svg$/i.test(svg);
  return isBareName ? (urlOf(svg) ?? svg) : svg;
}

function mapParticles(list: ParticleDef[] | undefined): ParticleDef[] | undefined {
  if (!list) return list;
  return list.map((p) => (p.shape?.svg ? { ...p, shape: { ...p.shape, svg: resolveSvgRef(p.shape.svg) } } : p));
}

function artSrc(value: ArtValue | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : value.src;
}

function artVisuals(value: ArtValue | undefined): ArtVariantVisuals {
  if (value == null || typeof value === 'string') return {};
  return { animations: value.animations, particles: mapParticles(value.particles) };
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
  const dayName = artSrc(def.art?.day) ?? `${id}.svg`;
  const day = urlOf(dayName);
  if (!day) return null;
  const nightName = artSrc(def.art?.night) ?? (hasSvg(`${id}-night.svg`) ? `${id}-night.svg` : undefined);
  const colorSlots = def.colorSlots ?? [];
  const raw = def.raw || colorSlots.length > 0 ? rawOf(dayName) : undefined;
  const dayVisuals = artVisuals(def.art?.day);
  const nightVisuals = artVisuals(def.art?.night);
  const hasVariants = !!(dayVisuals.animations || dayVisuals.particles || nightVisuals.animations || nightVisuals.particles);
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
    host: def.host,
    effect: def.effect ?? null,
    presets: def.presets,
    animations: def.animations,
    particles: mapParticles(def.particles),
    artVariants: hasVariants ? { day: dayVisuals, night: nightVisuals } : undefined,
    repeat: def.repeat,
    raw,
  };
}

function toSticker(def: AssetDefinition): StickerDef | null {
  const id = def.id as string;
  const dayName = artSrc(def.art?.day) ?? `${id}.svg`;
  const art = urlOf(dayName);
  if (!art) return null;
  const colorSlots = def.colorSlots ?? [];
  return {
    id,
    label: def.label ?? id,
    art,
    tint: def.tint ?? false,
    aspect: def.aspect ?? 1,
    defaultColor: def.defaultColor,
    raw: colorSlots.length ? rawOf(dayName) : undefined,
    colorSlots: colorSlots.length ? colorSlots : undefined,
    presets: def.presets,
    animations: def.animations,
    particles: mapParticles(def.particles),
  };
}

function toTape(def: AssetDefinition): TapeDef | null {
  const id = def.id as string;
  const dayName = artSrc(def.art?.day) ?? `${id}.svg`;
  const mask = urlOf(dayName);
  if (!mask) return null;
  const colorSlots = def.colorSlots ?? [];
  return {
    id,
    label: def.label ?? id,
    mask,
    aspect: def.aspect ?? 3.4,
    defaultColor: def.defaultColor ?? '#f2e3c0',
    opacity: def.opacity ?? 0.9,
    raw: colorSlots.length ? rawOf(dayName) : undefined,
    colorSlots: colorSlots.length ? colorSlots : undefined,
    presets: def.presets,
    animations: def.animations,
    particles: mapParticles(def.particles),
  };
}

function toFrame(def: AssetDefinition): FrameDef | null {
  if (!def.insets) return null;
  const id = def.id as string;
  const dayName = artSrc(def.art?.day) ?? `${id}.svg`;
  const art = urlOf(dayName);
  if (!art) return null;
  const colorSlots = def.colorSlots ?? [];
  return {
    id,
    label: def.label ?? id,
    insets: def.insets,
    contentAspect: def.contentAspect,
    radius: def.radius,
    clip: def.clip,
    caption: def.caption,
    bg: def.bg,
    colorable: def.colorable,
    art,
    raw: colorSlots.length ? rawOf(dayName) : undefined,
    colorSlots: colorSlots.length ? colorSlots : undefined,
    presets: def.presets,
    animations: def.animations,
    particles: mapParticles(def.particles),
  };
}

function resolveLayer(def: PaperLayerDef | undefined): PaperLayer | undefined {
  if (!def?.art) return undefined;
  const colorSlots = def.colorSlots ?? [];
  return {
    art: resolveSvgRef(def.art) ?? def.art,
    raw: colorSlots.length ? rawOf(def.art) : undefined,
    colorSlots: colorSlots.length ? colorSlots : undefined,
    presets: def.presets,
    opacity: def.opacity,
    scale: def.scale,
  };
}

function toPaper(def: AssetDefinition): Paper | null {
  const id = def.id as string;
  const fill = resolveLayer(def.fill);
  const border = resolveLayer(def.border);
  const corners = resolveLayer(def.corners);
  const colorSlots = [...(fill?.colorSlots ?? []), ...(border?.colorSlots ?? []), ...(corners?.colorSlots ?? [])];
  const presets = [...(fill?.presets ?? []), ...(border?.presets ?? []), ...(corners?.presets ?? [])];
  return {
    id,
    label: def.label ?? id,
    color: def.color ?? '#fdf8ef',
    ink: def.ink ?? 'rgba(74,59,46,0.05)',
    lined: def.lined ?? false,
    dark: def.dark,
    fill,
    border,
    corners,
    colorSlots: colorSlots.length ? colorSlots : undefined,
    presets: presets.length ? presets : undefined,
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

export const loadedFrames: FrameDef[] = defs
  .filter((d) => d.kind === 'frame')
  .map(toFrame)
  .filter((d): d is FrameDef => !!d);

export const loadedPapers: Paper[] = defs
  .filter((d) => d.kind === 'paper')
  .map(toPaper)
  .filter((d): d is Paper => !!d);

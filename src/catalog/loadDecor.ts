import type { ArtVariantVisuals, Band, CatalogItem, Category, ColorPreset, ColorSlot, EffectDef, LightDef } from './types';
import type { AnimationDef } from './animation';
import type { ParticleDef } from './particles';
import type { Layer } from '@/data/types';
import type { StickerDef, TapeDef } from '@/scrapbook/decor';
import type { FrameDef, FrameInsets } from '@/scrapbook/frames';
import type { Paper, PaperLayer } from '@/scrapbook/paper';
import type { NotePaper, NotePaperLines } from '@/scrapbook/notes';
import { svgToDataUri } from './svgColor';

/** One time-of-day art variant: a source file plus optional visuals. */
export interface ArtVariantDef {
  src?: string;
  /** Relative-size offset (default 1); lets day/night share one merged frame. */
  scale?: number;
  animations?: AnimationDef[];
  particles?: ParticleDef[];
}

/**
 * How the day and night boxes are overlaid inside the merged frame:
 * `<vertical>-<horizontal>` (or just `center`). Default `bottom-center`.
 */
export type ArtAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

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
  kind?: 'room' | 'sticker' | 'tape' | 'frame' | 'paper' | 'notePaper';
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
  /** Invisible hit-area extension, as fractions of the item box. */
  hitbox?: CatalogItem['hitbox'];
  /** Point inside the item box that pins it to a host (default bottom-centre). */
  attachAnchor?: CatalogItem['attachAnchor'];
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
  /** How the day/night boxes overlay in the merged frame. Default `bottom-center`. */
  artAnchor?: ArtAnchor;
  raw?: boolean;
  /** room: tile the art across the band — "x" | "y" | "both". */
  repeat?: 'x' | 'y' | 'both';
  /** room: emissive light sources this item casts. */
  lights?: LightDef[];
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
  /** notePaper: ruled pattern, tint palette and styling. */
  lines?: NotePaperLines;
  shadow?: boolean;
  sheen?: boolean;
  texture?: string;
  margin?: string;
  lineColor?: string;
  spacing?: number;
  palette?: string[];
  order?: number;
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

/** Resolve a bare `assets/svg` file name to its built URL (e.g. effect textures). */
export function assetSrc(name: string): string | undefined {
  return urlOf(name);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Parse a `viewBox` (x y w h) from an SVG string. */
function viewBoxOf(raw: string): Box | null {
  const m = /viewBox\s*=\s*["']\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*["']/.exec(raw);
  if (!m) return null;
  const [x, y, w, h] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/** Return a copy of the SVG with its viewBox and intrinsic size rewritten. */
function withViewBox(raw: string, box: Box): string {
  const vb = `${round(box.x)} ${round(box.y)} ${round(box.w)} ${round(box.h)}`;
  const w = `${round(box.w)}`;
  const h = `${round(box.h)}`;
  const set = (svg: string, attr: string, value: string): string =>
    new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`).test(svg)
      ? svg.replace(new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`), ` ${attr}="${value}"`)
      : svg.replace(/<svg\b/, `<svg ${attr}="${value}"`);
  // Build the frame first, then width/height, so attribute insertion is stable.
  let svg = /viewBox\s*=\s*["'][^"']*["']/.test(raw)
    ? raw.replace(/viewBox\s*=\s*["'][^"']*["']/, `viewBox="${vb}"`)
    : raw.replace(/<svg\b/, `<svg viewBox="${vb}"`);
  svg = set(svg, 'width', w);
  svg = set(svg, 'height', h);
  return svg;
}

/** Per-variant scale offset (plain-string/absent art means 1). */
function artScale(value: ArtValue | undefined): number {
  if (value == null || typeof value === 'string') return 1;
  const s = value.scale;
  return typeof s === 'number' && s > 0 ? s : 1;
}

/** Resolve an anchor to 0/0.5/1 fractions (default `bottom-center`). */
function anchorFractions(anchor: ArtAnchor | undefined): { ax: number; ay: number } {
  const raw = (anchor ?? 'bottom-center').toLowerCase().trim();
  const [a, b] = raw.includes('-') ? raw.split('-') : ['center', raw];
  const ay = a === 'top' ? 0 : a === 'bottom' ? 1 : 0.5;
  const ax = b === 'left' ? 0 : b === 'right' ? 1 : 0.5;
  return { ax, ay };
}

function sameBox(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3 && Math.abs(a.w - b.w) < 1e-3 && Math.abs(a.h - b.h) < 1e-3;
}

/**
 * Merge two variant viewBoxes into one shared frame. Each variant keeps the size
 * baked into its own SVG (multiplied by its scale offset); the union of those
 * boxes becomes the item's frame, with both variants overlaid by `anchor`.
 */
export function mergeArtFrame(
  dayRaw: string,
  nightRaw: string,
  dayScale: number,
  nightScale: number,
  anchor?: ArtAnchor,
): { aspect: number; day: Box; night: Box } | null {
  const d = viewBoxOf(dayRaw);
  const n = viewBoxOf(nightRaw);
  if (!d || !n) return null;
  const { ax, ay } = anchorFractions(anchor);
  const W = Math.max(d.w * dayScale, n.w * nightScale);
  const H = Math.max(d.h * dayScale, n.h * nightScale);
  // Place each variant so the chosen anchor point of its box lands on the same
  // spot; the frame is the tight union of the two placed boxes (size W×H).
  const fit = (b: Box, s: number): Box => {
    const ox = ax * (W - b.w * s);
    const oy = ay * (H - b.h * s);
    return { x: b.x - ox / s, y: b.y - oy / s, w: W / s, h: H / s };
  };
  return { aspect: W / H, day: fit(d, dayScale), night: fit(n, nightScale) };
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
  const dayUrl = urlOf(dayName);
  if (!dayUrl) return null;
  const nightName = artSrc(def.art?.night) ?? (hasSvg(`${id}-night.svg`) ? `${id}-night.svg` : undefined);
  const nightUrl = urlOf(nightName);
  const colorSlots = def.colorSlots ?? [];

  const dayRawSrc = rawOf(dayName);
  const nightRawSrc = rawOf(nightName);
  const useRaw = !!(def.raw || colorSlots.length > 0);

  // Merge the day/night viewBoxes into one shared frame so both variants keep
  // their baked relative size (nudged by each variant's scale offset).
  let aspect = def.aspect ?? 1;
  let day = dayUrl;
  let night = nightUrl;
  let dayRaw = dayRawSrc;
  let nightRaw = nightRawSrc;
  if (dayRawSrc && nightRawSrc) {
    const frame = mergeArtFrame(
      dayRawSrc,
      nightRawSrc,
      artScale(def.art?.day),
      artScale(def.art?.night),
      def.artAnchor,
    );
    if (frame) {
      aspect = frame.aspect;
      const natural = viewBoxOf(dayRawSrc)!;
      const naturalNight = viewBoxOf(nightRawSrc)!;
      if (!sameBox(frame.day, natural) || !sameBox(frame.night, naturalNight)) {
        day = svgToDataUri(withViewBox(dayRawSrc, frame.day));
        night = svgToDataUri(withViewBox(nightRawSrc, frame.night));
        dayRaw = withViewBox(dayRawSrc, frame.day);
        nightRaw = withViewBox(nightRawSrc, frame.night);
      }
    }
  }

  const dayVisuals = artVisuals(def.art?.day);
  const nightVisuals = artVisuals(def.art?.night);
  const hasVariants = !!(dayVisuals.animations || dayVisuals.particles || nightVisuals.animations || nightVisuals.particles);
  return {
    id,
    label: def.label ?? id,
    category: def.category ?? 'trinket',
    layer: def.layer ?? 'surface',
    band: def.band ?? 'floor',
    aspect,
    defaultScale: def.defaultScale ?? 0.2,
    defaultRotation: def.defaultRotation ?? 0,
    art: { day, night },
    colorSlots,
    attach: def.attach,
    host: def.host,
    hitbox: def.hitbox,
    attachAnchor: def.attachAnchor,
    effect: def.effect ?? null,
    presets: def.presets,
    animations: def.animations,
    particles: mapParticles(def.particles),
    artVariants: hasVariants ? { day: dayVisuals, night: nightVisuals } : undefined,
    repeat: def.repeat,
    lights: def.lights,
    raw: useRaw ? dayRaw : undefined,
    rawNight: useRaw ? nightRaw : undefined,
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

function toNotePaper(def: AssetDefinition): NotePaper | null {
  if (!def.id) return null;
  return {
    id: def.id,
    label: def.label ?? def.id,
    bg: def.color ?? '#ffffff',
    radius: def.radius ?? 3,
    shadow: def.shadow ?? true,
    lines: def.lines,
    colorable: def.colorable ?? false,
    sheen: def.sheen ?? false,
    texture: def.texture ? (resolveSvgRef(def.texture) ?? def.texture) : undefined,
    margin: def.margin,
    lineColor: def.lineColor,
    spacing: def.spacing,
    palette: def.palette,
    order: def.order,
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

export const loadedNotePapers: NotePaper[] = defs
  .filter((d) => d.kind === 'notePaper')
  .map(toNotePaper)
  .filter((d): d is NotePaper => !!d);

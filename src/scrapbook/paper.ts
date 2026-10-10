import type { ColorPreset, ColorSlot } from '@/catalog/types';
import { colorizeSvg, svgToDataUrl } from '@/catalog/svgColor';
import { slotVars } from './elementStyle';
import { loadedPapers } from '@/catalog/loadDecor';

/** One optional paper layer (a repeating tile, a border band, or corner motifs). */
export interface PaperLayer {
  /** Resolved SVG url. */
  art: string;
  /** Inlined SVG for multi-slot recolouring (`var(--c-<slot>, …)`). */
  raw?: string;
  colorSlots?: ColorSlot[];
  presets?: ColorPreset[];
  opacity?: number;
  /** fill only: tile size as a fraction of the page (default 0.12). */
  scale?: number;
}

export interface Paper {
  id: string;
  label: string;
  color: string;
  ink: string;
  lined: boolean;
  dark?: boolean;
  /** A repeating pattern tiled across the whole page. */
  fill?: PaperLayer;
  /** A decorative band drawn around the page edge (transparent centre). */
  border?: PaperLayer;
  /** A motif drawn in each corner of the page. */
  corners?: PaperLayer;
  /** All recolourable slots across the paper's layers. */
  colorSlots?: ColorSlot[];
  presets?: ColorPreset[];
}

export const BUILTIN_PAPERS: Paper[] = [
  { id: 'cream', label: 'Cream', color: '#fdf8ef', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'blush', label: 'Blush', color: '#f7e6e2', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'mint', label: 'Mint', color: '#e6efe4', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'sky', label: 'Sky', color: '#e4eef4', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'mustard', label: 'Mustard', color: '#f6eccb', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'kraft', label: 'Kraft', color: '#e8d9c0', ink: 'rgba(74,59,46,0.05)', lined: false },
  { id: 'lilac', label: 'Lilac', color: '#ebe3f1', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'charcoal', label: 'Charcoal', color: '#3b3a44', ink: 'rgba(255,255,255,0.06)', lined: true, dark: true },
];

/** Built-in papers plus any loaded from artist asset definitions (`kind: "paper"`). */
export const PAPERS: Paper[] = [...BUILTIN_PAPERS, ...loadedPapers];

export function paperById(id?: string): Paper {
  return PAPERS.find((p) => p.id === id) ?? PAPERS[0];
}

export function paperCss(p: Paper, colors?: Record<string, string>): Record<string, string> {
  const images: string[] = [];
  const repeats: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  if (p.lined) {
    images.push(`linear-gradient(${p.ink} 1px, transparent 1px)`);
    repeats.push('repeat');
    sizes.push('100% 34px');
    positions.push('0 2.2rem');
  }
  if (p.fill) {
    // Tiles are external SVG images, so recolour must be baked into a data URL.
    const fillArt =
      p.fill.raw && p.fill.colorSlots?.length
        ? svgToDataUrl(colorizeSvg(p.fill.raw, colors ?? {}, p.fill.colorSlots))
        : `url("${p.fill.art}")`;
    images.push(fillArt);
    repeats.push('repeat');
    const scale = (p.fill.scale ?? 0.12) * 100;
    sizes.push(`${scale.toFixed(2)}% ${scale.toFixed(2)}%`);
    positions.push('0 0');
  }
  const style: Record<string, string> = {
    background: p.color,
    backgroundImage: images.length ? images.join(', ') : 'none',
    '--page-ink': p.dark ? '#f4efe6' : '#4a3b2e',
  };
  if (images.length) {
    style.backgroundRepeat = repeats.join(', ');
    style.backgroundSize = sizes.join(', ');
    style.backgroundPosition = positions.join(', ');
  }
  Object.assign(style, slotVars(p.colorSlots, colors));
  return style;
}

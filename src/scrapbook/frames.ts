import type { ColorPreset, ColorSlot } from '@/catalog/types';
import type { AnimationDef } from '@/catalog/animation';
import type { ParticleDef } from '@/catalog/particles';
import { loadedFrames } from '@/catalog/loadDecor';

export interface FrameInsets {
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface FrameDef {
  id: string;
  label: string;
  insets: FrameInsets;
  /** Crop-window aspect (w/h). Undefined = the window matches the element box. */
  contentAspect?: number;
  radius?: number;
  bg?: string;
  colorable?: boolean;
  caption?: boolean;
  clip?: 'circle' | 'arch';
  sprockets?: boolean;
  stack?: boolean;
  tape?: 'corners' | 'tabs' | 'mounts';
  ring?: boolean;
  shadow?: boolean;
  /** Asset overlay drawn over the window (transparent window in the art). */
  art?: string;
  /** Inlined overlay SVG for multi-slot recolouring (`var(--c-<slot>, …)`). */
  raw?: string;
  colorSlots?: ColorSlot[];
  presets?: ColorPreset[];
  animations?: AnimationDef[];
  particles?: ParticleDef[];
}

const noInset: FrameInsets = { l: 0, r: 0, t: 0, b: 0 };

export const BUILTIN_FRAMES: FrameDef[] = [
  { id: 'none', label: 'None', insets: noInset },
  { id: 'rounded', label: 'Rounded', insets: noInset, radius: 14 },
  { id: 'thin', label: 'Thin', insets: { l: 0.025, r: 0.025, t: 0.025, b: 0.025 }, radius: 3, bg: '#fdf8ef', colorable: true },
  { id: 'chunky', label: 'Chunky', insets: { l: 0.08, r: 0.08, t: 0.08, b: 0.08 }, radius: 5, bg: '#fdf8ef', colorable: true },
  { id: 'square', label: 'Square', insets: { l: 0.04, r: 0.04, t: 0.04, b: 0.04 }, contentAspect: 1, radius: 2, bg: '#fdf8ef', colorable: true },
  { id: 'polaroid', label: 'Polaroid', insets: { l: 0.055, r: 0.055, t: 0.055, b: 0.24 }, contentAspect: 1, radius: 2, bg: '#fdf8ef', colorable: true, caption: true },
  { id: 'instant', label: 'Instant', insets: { l: 0.05, r: 0.05, t: 0.05, b: 0.14 }, contentAspect: 1, radius: 2, bg: '#fdf8ef', colorable: true, caption: true },
  { id: 'circle', label: 'Circle', insets: { l: 0.02, r: 0.02, t: 0.02, b: 0.02 }, contentAspect: 1, radius: 999, bg: '#fdf8ef', colorable: true, clip: 'circle' },
  { id: 'film', label: 'Film', insets: { l: 0.02, r: 0.02, t: 0.12, b: 0.12 }, contentAspect: 1.5, radius: 2, bg: '#2f3134', sprockets: true },
  { id: 'arch', label: 'Arch', insets: { l: 0.02, r: 0.02, t: 0.05, b: 0.02 }, contentAspect: 0.8, radius: 0, bg: '#fdf8ef', colorable: true, clip: 'arch' },
  { id: 'double', label: 'Double', insets: { l: 0.045, r: 0.045, t: 0.045, b: 0.045 }, radius: 2, bg: '#fdf8ef', colorable: true, ring: true },
  { id: 'taped-corners', label: 'Taped corners', insets: noInset, tape: 'corners' },
  { id: 'washi-tabs', label: 'Washi tabs', insets: noInset, tape: 'tabs' },
  { id: 'mount', label: 'Corner mounts', insets: noInset, tape: 'mounts' },
  { id: 'stack', label: 'Stack', insets: { l: 0.05, r: 0.05, t: 0.05, b: 0.05 }, radius: 2, bg: '#fdf8ef', colorable: true, stack: true },
];

/** Built-in frames plus any loaded from artist asset definitions (`kind: "frame"`). */
export const FRAMES: FrameDef[] = [...BUILTIN_FRAMES, ...loadedFrames];

export function frameById(id?: string): FrameDef {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

/** Overall element aspect (w/h) required so the crop window hits `contentAspect`. */
export function frameAspect(f: FrameDef): number | undefined {
  if (f.contentAspect === undefined) return undefined;
  const { l, r, t, b } = f.insets;
  return (f.contentAspect * (1 - t - b)) / (1 - l - r);
}

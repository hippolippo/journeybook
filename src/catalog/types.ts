import type { Layer } from '@/data/types';
import type { AnimationDef } from './animation';
import type { ParticleDef } from './particles';

export type Category = 'wallpaper' | 'flooring' | 'furniture' | 'wallDecor' | 'trinket' | 'pet';
/** Which band an item's position is measured in. `both` = the whole stage. */
export type Band = 'wall' | 'floor' | 'both';

/**
 * Physical character of a light source. Each type carries sensible defaults
 * (reach, brightness, falloff, flicker) so a candle and a window feel different
 * without per-asset tuning — assets only override what they need.
 */
export type LightType = 'lamp' | 'candle' | 'firefly' | 'string' | 'window' | 'screen' | 'moon';

/**
 * How a light spreads through space (its photometric character), independent of
 * the fixture `type`:
 *  - `point`   — bare point source: omni, hot core, steep falloff
 *  - `semi`    — semi-diffuse: omni with a gentle hotspot (shaded lamp)
 *  - `diffuse` — soft area emitter: omni, broad, low peak, no hotspot
 *  - `spot`    — directional cone (angle + soft edge)
 *  - `wash`    — wide directional flood / wall-wash
 *  - `ambient` — flat, distance-independent fill (moonlight, screen)
 */
export type LightDistribution = 'point' | 'semi' | 'diffuse' | 'spot' | 'wash' | 'ambient';

/**
 * A light source declared by an asset. Position and radius are percentages of
 * the asset's own box, so an asset can have several lights and only light up
 * the parts it wants. `slot` binds the emitted colour to a recolourable slot.
 */
export interface LightDef {
  id?: string;
  type?: LightType;
  /** How the light spreads (default from the fixture type). */
  distribution?: LightDistribution;
  /** Centre, % of the item box (default 50 / 50). */
  x?: number;
  y?: number;
  /** Reach, % of the item box height (default from the type). */
  radius?: number;
  /** Multiplier on the type's default brightness (default 1). */
  intensity?: number;
  /** Literal colour (used when `slot` is absent). */
  color?: string;
  /** Recolour slot whose value drives the emitted colour. */
  slot?: string;
  /** Override the type's flicker amount (0–1). */
  flicker?: boolean;
  /**
   * Tile this light with the art of a `repeat` item, along the given axis.
   * `x`/`y` are then positions within one tile rather than the whole item.
   */
  repeat?: 'x' | 'y' | 'both';
  /** Directional types (`spot`/`wash`): cone full angle in degrees. */
  angle?: number;
  /** Directional types: aim in degrees (0 = right, 90 = down, 180 = left, 270 = up). */
  direction?: number;
  /** Directional types: edge softness, 0 (hard) – 1 (very soft). */
  penumbra?: number;
}

export interface ColorSlot {
  id: string;
  label: string;
  default: string;
  palette: string[];
  allowCustom: boolean;
}

/** Animated decor effects, configured per asset (no code change needed). */
export type EffectType = 'sway' | 'glow' | 'smoke' | 'float' | 'flicker' | 'twinkle';

export interface EffectDef {
  type: EffectType;
  /** sway: swing angle in degrees · float: vertical travel in px. */
  amplitude?: number;
  /** Seconds. */
  duration?: number;
  /** Seconds. */
  delay?: number;
  /** glow / smoke colour. */
  color?: string;
  /** Use a colour slot's value as the effect colour (e.g. the lit glass). */
  slot?: string;
  count?: number;
  /** sway origin. */
  origin?: 'top' | 'bottom';
}

/** A named multi-slot colour configuration. */
export interface ColorPreset {
  id: string;
  label: string;
  colors: Record<string, string>;
}

/** Data-defined visuals attached to one time-of-day variant. */
export interface ArtVariantVisuals {
  animations?: AnimationDef[];
  particles?: ParticleDef[];
}

export interface CatalogItem {
  id: string;
  label: string;
  category: Category;
  layer: Layer;
  band: Band;
  aspect: number;
  defaultScale: number;
  defaultRotation: number;
  art: { day: string; night?: string };
  colorSlots: ColorSlot[];
  attach?: 'furniture' | 'shelf' | 'any';
  /** Can hold surface items (a resting surface: desk, shelf, …). */
  host?: boolean;
  /** Invisible hit-area extension, as fractions of the item box. */
  hitbox?: { bottom?: number };
  /** Point inside the item box that pins it to a host (default bottom-centre). */
  attachAnchor?: { x: number; y: number };
  component?: 'clock';
  raw?: string;
  /** Inlined night-variant SVG (recolourable assets with a day/night pair). */
  rawNight?: string;
  effect?: EffectDef | EffectDef[] | null;
  presets?: ColorPreset[];
  /** Generic, data-defined whole-object animations (all variants). */
  animations?: AnimationDef[];
  /** Generic, data-defined particle systems (all variants). */
  particles?: ParticleDef[];
  /** Optional per time-of-day animation/particle overrides and additions. */
  artVariants?: { day?: ArtVariantVisuals; night?: ArtVariantVisuals };
  /** Tile the art across the band instead of drawing a single instance. */
  repeat?: 'x' | 'y' | 'both';
  /** Emissive light sources this item casts. */
  lights?: LightDef[];
}

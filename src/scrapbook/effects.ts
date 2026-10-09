import type { ImageEffects, ImagePreset } from '@/data/types';

export interface EffectPreset {
  id: string;
  label: string;
  values: ImageEffects;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'original', label: 'Original', values: {} },
  { id: 'warm', label: 'Warm', values: { warmth: 0.5, saturation: 0.1 } },
  { id: 'cool', label: 'Cool', values: { warmth: -0.5 } },
  { id: 'vintage', label: 'Vintage', values: { fade: 0.4, warmth: 0.3, contrast: -0.1, saturation: -0.2, grain: 0.3 } },
  { id: 'faded', label: 'Faded', values: { fade: 0.55, contrast: -0.2, brightness: 0.08 } },
  { id: 'bw', label: 'B&W', values: { saturation: -1 } },
  { id: 'sepia', label: 'Sepia', values: { warmth: 1, saturation: -0.3, contrast: 0.05 } },
  { id: 'vivid', label: 'Vivid', values: { saturation: 0.4, contrast: 0.15 } },
  { id: 'dreamy', label: 'Dreamy', values: { brightness: 0.1, fade: 0.2, saturation: 0.12 } },
  { id: 'film', label: 'Film', values: { grain: 0.4, fade: 0.2, contrast: 0.1, warmth: 0.12 } },
];

export interface EffectSlider {
  key: keyof ImageEffects;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const EFFECT_SLIDERS: EffectSlider[] = [
  { key: 'brightness', label: 'Brightness', min: -0.5, max: 0.5, step: 0.01 },
  { key: 'contrast', label: 'Contrast', min: -0.5, max: 0.5, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: -1, max: 1, step: 0.01 },
  { key: 'warmth', label: 'Warmth', min: -1, max: 1, step: 0.01 },
  { key: 'fade', label: 'Fade', min: 0, max: 1, step: 0.01 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01 },
  { key: 'grain', label: 'Grain', min: 0, max: 1, step: 0.01 },
];

export const BUILTIN_PRESETS: ImagePreset[] = EFFECT_PRESETS.map((p) => ({ id: p.id, name: p.label, effects: p.values }));

export function isBuiltinPreset(id: string): boolean {
  return EFFECT_PRESETS.some((p) => p.id === id);
}

/** Built-ins first, then saved presets; a saved preset with the same id overrides a built-in. */
export function mergedPresets(custom: ImagePreset[]): ImagePreset[] {
  const map = new Map<string, ImagePreset>();
  for (const b of BUILTIN_PRESETS) map.set(b.id, b);
  for (const c of custom) map.set(c.id, c);
  return [...map.values()];
}

/** Build the CSS `filter` string for a set of adjustments. */
export function effectsFilter(e: ImageEffects | undefined): string {
  const v = e ?? {};
  const brightness = 1 + (v.brightness ?? 0);
  const contrast = 1 + (v.contrast ?? 0);
  const sat = 1 + (v.saturation ?? 0);
  const fade = v.fade ?? 0;
  const warmth = v.warmth ?? 0;
  const parts = [
    `brightness(${(brightness * (1 + fade * 0.18)).toFixed(3)})`,
    `contrast(${(contrast * (1 - fade * 0.28)).toFixed(3)})`,
    `saturate(${(sat * (1 - fade * 0.25)).toFixed(3)})`,
  ];
  if (warmth > 0) parts.push(`sepia(${(warmth * 0.35).toFixed(3)})`);
  if (warmth) parts.push(`hue-rotate(${(warmth * -12).toFixed(1)}deg)`);
  return parts.join(' ');
}

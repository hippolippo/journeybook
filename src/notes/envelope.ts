import type { NoteEnvelope } from '@/data/types';
import { stickerById } from '@/scrapbook/decor';
import { toHex } from './richText';

/** Envelope paper tints, borrowed from the app's warm paper palette. */
export interface EnvelopeTint {
  id: string;
  label: string;
  color: string;
}

export const ENVELOPE_TINTS: EnvelopeTint[] = [
  { id: 'kraft', label: 'Kraft', color: '#d9b98c' },
  { id: 'cream', label: 'Cream', color: '#f4e6ca' },
  { id: 'blush', label: 'Blush', color: '#e8b4af' },
  { id: 'sage', label: 'Sage', color: '#cadcb9' },
  { id: 'sky', label: 'Sky', color: '#cfe0ea' },
  { id: 'lilac', label: 'Lilac', color: '#d8d3e8' },
  { id: 'terracotta', label: 'Terracotta', color: '#d59a79' },
  { id: 'charcoal', label: 'Charcoal', color: '#4d4640' },
];

/** The wax seal reuses the shipped sticker art and its recolour palette. */
export const SEAL_STICKER = stickerById('wax-seal-stamp');
export const STAMP_STICKER = stickerById('postage-stamp');

export interface SealColor {
  id: string;
  label: string;
  color: string;
}

export const SEAL_COLORS: SealColor[] = (SEAL_STICKER.colorSlots?.[0]?.palette ?? ['#D9482F']).map(
  (color, index) => ({
    id: `seal-${index + 1}`,
    label: `Seal ${index + 1}`,
    color,
  }),
);

export interface StampPreset {
  id: string;
  label: string;
  /** Stamp colour slot. */
  paper: string;
  /** Postmark colour slot. */
  waves: string;
}

/** Stamp colours are presets over the shipped postage stamp's two slots. */
export const STAMP_PRESETS: StampPreset[] = [
  { id: 'mint', label: 'Mint', paper: '#B5DFC5', waves: '#B6A4E4' },
  { id: 'rose', label: 'Rose', paper: '#F6C9D4', waves: '#B23A6A' },
  { id: 'sky', label: 'Sky', paper: '#8FB4C4', waves: '#6A97AD' },
  { id: 'mustard', label: 'Mustard', paper: '#F6E7C9', waves: '#D9A94E' },
  { id: 'terracotta', label: 'Terracotta', paper: '#E5966F', waves: '#C05A3A' },
];

export const DEFAULT_ENVELOPE: NoteEnvelope = {
  tint: ENVELOPE_TINTS[0].color,
  seal: SEAL_COLORS[0]?.color ?? '#D9482F',
  stamp: STAMP_PRESETS[0].id,
};

export function stampPresetById(id?: string): StampPreset {
  return STAMP_PRESETS.find((preset) => preset.id === id) ?? STAMP_PRESETS[0];
}

/** Validate a persisted envelope; unknown values fall back to the defaults. */
export function normalizeEnvelope(value: unknown): NoteEnvelope {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const tint = typeof source.tint === 'string' ? toHex(source.tint) : undefined;
  const seal = typeof source.seal === 'string' ? toHex(source.seal) : undefined;
  const stamp = typeof source.stamp === 'string' ? source.stamp : undefined;
  const stampPaper = typeof source.stampPaper === 'string' ? toHex(source.stampPaper) : undefined;
  const stampWaves = typeof source.stampWaves === 'string' ? toHex(source.stampWaves) : undefined;
  const initial =
    typeof source.initial === 'string'
      ? (Array.from(source.initial.trim())[0] ?? '').toUpperCase()
      : '';
  return {
    tint: tint ?? DEFAULT_ENVELOPE.tint,
    seal: seal ?? DEFAULT_ENVELOPE.seal,
    stamp: STAMP_PRESETS.some((preset) => preset.id === stamp) ? stamp! : DEFAULT_ENVELOPE.stamp,
    ...(stampPaper ? { stampPaper } : {}),
    ...(stampWaves ? { stampWaves } : {}),
    ...(initial ? { initial } : {}),
  };
}

/** Perceived luminance, so the address stays readable on charcoal envelopes. */
export function envelopeInk(tint: string): string {
  const hex = toHex(tint) ?? DEFAULT_ENVELOPE.tint;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? '#f7efdd' : '#4a3b2e';
}

export function stampVars(preset: StampPreset): Record<string, string> {
  return {
    '--c-paper': preset.paper,
    '--c-waves': preset.waves,
  };
}

export function sealVars(color: string): Record<string, string> {
  return { '--c-seal': color };
}

import type { Category } from '@/catalog/types';
import { normalizeAngle } from '@/scrapbook/transform';

/** On-screen rotation/flip of an item, used to level its contact shadow. */
export interface ItemPose {
  rotation: number;
  flip: boolean;
}

/** Compose a host's on-screen pose with an attached child's local pose. */
export function composePose(host: ItemPose, child: ItemPose): ItemPose {
  return {
    rotation: normalizeAngle(host.rotation + (host.flip ? -child.rotation : child.rotation)),
    flip: host.flip ? !child.flip : child.flip,
  };
}

/** Inverse of an item's pose, cancelling rotation/flip for the contact shadow. */
export function levelShadowTransform(pose: ItemPose): string {
  return `scaleX(${pose.flip ? -1 : 1}) rotate(${normalizeAngle(-pose.rotation)}deg)`;
}

/** Default shadow amount for items that cast one. */
export const DEFAULT_SHADOW = 0.5;

/** Heavier default shadow for big, flat, ground-hugging pieces. */
export const STRONG_SHADOW = 0.8;

/** Items that get the stronger shadow by default (shelves + desk). */
const STRONG_SHADOW_ITEMS = new Set([
  'desk',
  'short-shelf',
  'medium-shelf',
  'tall-shelf',
  'large-wall-shelf',
  'medium-wall-shelf',
]);

/** Items that never cast a shadow by default (postcards, rugs). */
const NO_DEFAULT_SHADOW = new Set([
  'postcard-01',
  'postcard-02',
  'postcard-03',
  'postcard-04',
  'circular-rug',
  'rectangle-rug',
]);

/** Categories whose items cast a shadow by default. */
const SHADOW_CATEGORIES = new Set<Category>(['trinket', 'furniture', 'wallDecor', 'pet']);

/** Categories that rest and get the contact (oval) shadow as well. */
const RESTING_CATEGORIES = new Set<Category>(['trinket', 'furniture', 'pet']);

/** True for items that rest (trinkets/furniture) rather than hang on the wall. */
export function isRestingCategory(category: Category): boolean {
  return RESTING_CATEGORIES.has(category);
}

/** Default shadow amount (0–1) for a catalog item. */
export function defaultShadowAmount(cat: { id: string; category: Category }): number {
  if (NO_DEFAULT_SHADOW.has(cat.id)) return 0;
  if (STRONG_SHADOW_ITEMS.has(cat.id)) return STRONG_SHADOW;
  return SHADOW_CATEGORIES.has(cat.category) ? DEFAULT_SHADOW : 0;
}

/** CSS `drop-shadow(...)` for an amount in 0–1 (0 / tiny = no shadow). */
export function shadowFilter(amount: number): string {
  const a = Math.max(0, Math.min(1, amount));
  if (a < 0.02) return 'none';
  const y = Math.round(4 + a * 12);
  const blur = Math.round(5 + a * 13);
  const alpha = (0.12 + a * 0.3).toFixed(2);
  return `drop-shadow(0 ${y}px ${blur}px rgba(63, 48, 36, ${alpha}))`;
}

/**
 * Inline style for the contact (oval) shadow of a resting item, or null when
 * the item isn't resting or has no shadow. The amount scales opacity + width.
 */
export function ovalShadowStyle(
  category: Category,
  amount: number,
): { width: string; opacity: string } | null {
  if (!RESTING_CATEGORIES.has(category)) return null;
  const a = Math.max(0, Math.min(1, amount));
  if (a < 0.02) return null;
  return { width: `${(60 + a * 32).toFixed(1)}%`, opacity: (0.18 + a * 0.4).toFixed(2) };
}

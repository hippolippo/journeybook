import type { PageElement } from '@/data/types';
import type { ColorSlot } from '@/catalog/types';
import { stickerById, tapeById } from './decor';

/** Content transform vars for an element (horizontal flip mirrors the content). */
export function flipVars(el: { flipX?: boolean }): Record<string, string> {
  return el.flipX ? { transform: 'scaleX(-1)' } : {};
}

/** Build `--c-<slot>` CSS variables from slot defaults and stored values. */
export function slotVars(
  slots: ColorSlot[] | undefined,
  values: Record<string, string> | undefined,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const slot of slots ?? []) vars[`--c-${slot.id}`] = values?.[slot.id] ?? slot.default;
  return vars;
}

/** Position/transform style for an element on the square page (fractions → %). */
export function elementStyle(el: PageElement): Record<string, string> {
  const s: Record<string, string> = {
    left: `${el.x * 100}%`,
    top: `${el.y * 100}%`,
    width: `${el.w * 100}%`,
    height: `${el.h * 100}%`,
    transform: `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.scale ?? 1})`,
    zIndex: String(el.z),
    '--el-opacity': String(el.opacity),
  };
  if (el.dropShadow) {
    const strength = el.shadowStrength ?? 0.5;
    const y = 3 + Math.round(strength * 8);
    const blur = 5 + Math.round(strength * 12);
    const alpha = (0.16 + strength * 0.34).toFixed(2);
    s.filter = `drop-shadow(0 ${y}px ${blur}px rgba(63, 48, 36, ${alpha}))`;
  }
  if (el.kind === 'sticker') {
    const def = stickerById(el.icon);
    if (def.raw && def.colorSlots?.length) {
      Object.assign(s, slotVars(def.colorSlots, el.colors));
    } else {
      s['--sticker'] = el.color ?? def.defaultColor ?? '#d98c8c';
      if (def.tint) s['--icon'] = `url("${def.art}")`;
    }
  }
  if (el.kind === 'tape') {
    const def = tapeById(el.style);
    if (def.raw && def.colorSlots?.length) {
      Object.assign(s, slotVars(def.colorSlots, el.colors));
    } else {
      s['--tape-color'] = el.color ?? def.defaultColor;
      s['--tape-mask'] = `url("${def.mask}")`;
      s['--tape-opacity'] = String(def.opacity);
    }
  }
  return s;
}

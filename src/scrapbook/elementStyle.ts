import type { PageElement } from '@/data/types';
import { stickerById, tapeById } from './decor';

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
  if (el.kind === 'note') s.background = el.color ?? '';
  if (el.kind === 'sticker') {
    const def = stickerById(el.icon);
    s['--sticker'] = el.color ?? def.defaultColor ?? '#d98c8c';
    if (def.tint) s['--icon'] = `url("${def.art}")`;
  }
  if (el.kind === 'tape') {
    s.background = el.color ?? tapeById(el.style).defaultColor;
    s['--tape-mask'] = `url("${tapeById(el.style).mask}")`;
  }
  return s;
}

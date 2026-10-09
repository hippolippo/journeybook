/**
 * Square-page pagination. Mobile shows one page at a time; wide screens show a
 * fixed two-page spread where the left page is always an odd index (page 1 is
 * always on the left, page 2 on the right, then 3–4, and so on).
 */
export function pagesPerView(isWide: boolean): number {
  return isWide ? 2 : 1;
}

export function lastStart(count: number, perView: number): number {
  if (count <= perView) return 0;
  return Math.floor((count - 1) / perView) * perView;
}

export function clampStart(start: number, count: number, perView: number): number {
  const max = lastStart(count, perView);
  return Math.min(Math.max(0, start), max);
}

export function pageRange(start: number, count: number, perView: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < perView; k++) {
    const i = start + k;
    if (i < count) out.push(i);
  }
  return out;
}

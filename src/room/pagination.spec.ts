import { describe, expect, it } from 'vitest';
import { clampStart, lastStart, pageRange, pagesPerView } from './pagination';

describe('pagination', () => {
  it('shows two pages wide, one on mobile', () => {
    expect(pagesPerView(true)).toBe(2);
    expect(pagesPerView(false)).toBe(1);
  });

  it('aligns the desktop spread to even starts (1-2, 3-4)', () => {
    expect(lastStart(4, 2)).toBe(2);
    expect(lastStart(5, 2)).toBe(4);
    expect(lastStart(1, 2)).toBe(0);
  });

  it('clamps and ranges', () => {
    expect(clampStart(5, 4, 2)).toBe(2);
    expect(pageRange(2, 5, 2)).toEqual([2, 3]);
    expect(pageRange(4, 5, 2)).toEqual([4]);
    expect(pageRange(0, 0, 2)).toEqual([]);
  });
});

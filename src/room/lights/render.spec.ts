import { describe, expect, it } from 'vitest';
import { flickerValue } from './render';

describe('flickerValue', () => {
  it('is steady when the amount is zero', () => {
    expect(flickerValue(0, 0)).toBe(1);
    expect(flickerValue(0, 12.34)).toBe(1);
  });

  it('wobbles around 1 and stays close to it', () => {
    for (const t of [0, 0.3, 1.1, 2.7, 5.5]) {
      const v = flickerValue(0.4, t);
      expect(v).toBeGreaterThan(0.5);
      expect(v).toBeLessThan(1.5);
    }
    expect(flickerValue(0.4, 0.7)).not.toBe(flickerValue(0.4, 0.9));
  });
});

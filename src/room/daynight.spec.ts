import { describe, expect, it } from 'vitest';
import { resolveTimeOfDay } from './daynight';

describe('resolveTimeOfDay', () => {
  it('honors manual overrides', () => {
    expect(resolveTimeOfDay('day', 'America/Chicago')).toBe('day');
    expect(resolveTimeOfDay('night', 'America/Chicago')).toBe('night');
  });

  it('follows the reference timezone in auto mode', () => {
    const noonCentral = new Date('2026-06-01T17:00:00Z'); // 12:00 CDT
    const oneAmCentral = new Date('2026-06-01T06:00:00Z'); // 01:00 CDT
    expect(resolveTimeOfDay('auto', 'America/Chicago', noonCentral)).toBe('day');
    expect(resolveTimeOfDay('auto', 'America/Chicago', oneAmCentral)).toBe('night');
  });
});

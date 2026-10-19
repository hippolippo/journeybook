import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_GLOW,
  LOCAL_ROOM_GLOW_KEY,
  clampRoomGlow,
  loadLocalRoomGlow,
  parseRoomGlow,
  saveLocalRoomGlow,
} from './roomGlow';

describe('room glow preference', () => {
  it('defaults to the original glow and clamps values', () => {
    expect(clampRoomGlow(undefined)).toBe(DEFAULT_ROOM_GLOW);
    expect(clampRoomGlow(Number.NaN)).toBe(DEFAULT_ROOM_GLOW);
    expect(clampRoomGlow(-1)).toBe(0);
    expect(clampRoomGlow(2)).toBe(1);
    expect(clampRoomGlow(0.4)).toBe(0.4);
  });

  it('treats an empty PocketBase value as the default, but keeps explicit zero', () => {
    expect(parseRoomGlow('')).toBe(DEFAULT_ROOM_GLOW);
    expect(parseRoomGlow('  ')).toBe(DEFAULT_ROOM_GLOW);
    expect(parseRoomGlow('0')).toBe(0);
    expect(parseRoomGlow('0.4')).toBe(0.4);
    expect(parseRoomGlow('nope')).toBe(DEFAULT_ROOM_GLOW);
    expect(parseRoomGlow(undefined)).toBe(DEFAULT_ROOM_GLOW);
  });

  it('round-trips the local fallback', () => {
    localStorage.removeItem(LOCAL_ROOM_GLOW_KEY);
    expect(loadLocalRoomGlow()).toBe(DEFAULT_ROOM_GLOW);
    saveLocalRoomGlow(0.25);
    expect(loadLocalRoomGlow()).toBe(0.25);
  });
});

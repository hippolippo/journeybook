import { beforeEach, describe, expect, it } from 'vitest';
import { loadData, saveData } from './storage';
import type { AppData } from './types';

const KEY = 'journeybook:v1';
const QUARANTINE = 'journeybook:v1.corrupt:';

function keysWithPrefix(prefix: string): string[] {
  const found: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) found.push(key);
  }
  return found;
}

beforeEach(() => localStorage.clear());

describe('loadData', () => {
  it('quarantines unreadable data instead of silently discarding it', () => {
    localStorage.setItem(KEY, '{ not valid json');
    expect(loadData()).toBeNull();
    const quarantined = keysWithPrefix(QUARANTINE);
    expect(quarantined).toHaveLength(1);
    expect(localStorage.getItem(quarantined[0])).toBe('{ not valid json');
  });

  it('quarantines data with an unexpected version', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 99, content: {} }));
    expect(loadData()).toBeNull();
    expect(keysWithPrefix(QUARANTINE)).toHaveLength(1);
  });

  it('loads valid data and backfills missing arrays', () => {
    const data = {
      version: 1,
      content: { nodes: [], pages: [], elements: [], media: [] },
      room: { wallId: 'w', floorId: 'f', dayNightMode: 'auto', referenceTz: 'UTC' },
      roomItems: [],
    } as unknown as AppData;
    localStorage.setItem(KEY, JSON.stringify(data));
    const loaded = loadData();
    expect(loaded).not.toBeNull();
    expect(loaded?.events).toEqual([]);
  });
});

describe('saveData', () => {
  it('round-trips data', () => {
    const data = {
      version: 1,
      content: { nodes: [], pages: [], elements: [], media: [] },
      room: { wallId: 'w', floorId: 'f', dayNightMode: 'auto', referenceTz: 'UTC' },
      roomItems: [],
      events: [],
    } as AppData;
    saveData(data);
    expect(loadData()).toEqual(data);
  });
});

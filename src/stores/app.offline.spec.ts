import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { AppData } from '@/data/types';

const data: AppData = {
  version: 1,
  content: { nodes: [], pages: [], elements: [], media: [] },
  room: { wallId: 'stripes-cream', floorId: 'wood-warm', dayNightMode: 'auto', referenceTz: 'UTC' },
  roomItems: [],
  events: [],
};

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.unstubAllEnvs();
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('remote offline fallback', () => {
  it('shows the last snapshot instead of the load-error gate', async () => {
    vi.stubEnv('VITE_PB_URL', 'http://127.0.0.1:1');
    const { updateRemoteSnapshot } = await import('@/data/snapshot');
    updateRemoteSnapshot({ data, notes: [], ownerId: 'me' });

    const { backend, pb } = await import('@/data/backend');
    vi.spyOn(pb!.files, 'getToken').mockRejectedValue(new Error('offline'));
    vi.spyOn(backend, 'fetchAll').mockRejectedValue(new Error('offline'));
    vi.spyOn(backend, 'listImagePresets').mockRejectedValue(new Error('offline'));
    vi.spyOn(backend, 'listTrash').mockRejectedValue(new Error('offline'));

    const { useAppStore } = await import('./app');
    const app = useAppStore();
    await app.initBackend();

    expect(app.loadError).toBe(false);
    expect(app.offline).toBe(true);
    expect(app.data.room.wallId).toBe('stripes-cream');
  });
});

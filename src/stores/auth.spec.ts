import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const AUTH_KEY = 'pocketbase_auth';
const SNAPSHOT_KEY = 'journeybook:remote-snapshot:v1';

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

describe('session restore', () => {
  it('signs out when the cached token is expired', async () => {
    vi.stubEnv('VITE_PB_URL', 'http://127.0.0.1:1');
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        token: 'expired-token',
        record: {
          id: 'user1',
          email: 'one@example.com',
          name: 'One',
          role: 'him',
          collectionId: '_pb_users_auth_',
          collectionName: 'users',
        },
      }),
    );
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ version: 1, savedAt: Date.now(), notes: [] }),
    );

    const { pb } = await import('@/data/backend');
    const { useAuthStore } = await import('./auth');
    const auth = useAuthStore();

    await auth.init();

    expect(auth.isAuthed).toBe(false);
    expect(auth.user).toBeNull();
    expect(pb?.authStore.record).toBeNull();
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });

  it('does not fetch shared data without a valid token', async () => {
    vi.stubEnv('VITE_PB_URL', 'http://127.0.0.1:1');
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: 'expired-token', record: null }));

    const { backend, pb } = await import('@/data/backend');
    const fetchAll = vi.spyOn(backend, 'fetchAll');
    const { useAppStore } = await import('./app');
    const app = useAppStore();

    await app.initBackend();

    expect(pb?.authStore.isValid).toBe(false);
    expect(fetchAll).not.toHaveBeenCalled();
    expect(app.loading).toBe(false);
    expect(app.loadError).toBe(false);
  });
});

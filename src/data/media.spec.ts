import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaAsset } from './types';

function asset(fileName?: string): MediaAsset {
  return { id: 'abc1234567890', bookId: 'book1', name: 'photo', fileName, created: 0 };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('mediaUrl', () => {
  it('builds a same-origin file URL (never protocol-relative //)', async () => {
    vi.stubEnv('VITE_PB_URL', '/');
    const { mediaUrl } = await import('./media');
    const url = mediaUrl(asset('pic.png'));
    expect(url).not.toMatch(/^\/\//);
    expect(url).toContain('/api/files/media/abc1234567890/pic.png');
    expect(url.startsWith(window.location.origin)).toBe(true);
  });

  it('builds an absolute file URL for a configured backend', async () => {
    vi.stubEnv('VITE_PB_URL', 'http://127.0.0.1:8090');
    const { mediaUrl } = await import('./media');
    expect(mediaUrl(asset('pic.png'))).toBe(
      'http://127.0.0.1:8090/api/files/media/abc1234567890/pic.png',
    );
  });

  it('returns an empty string when there is no file name', async () => {
    vi.stubEnv('VITE_PB_URL', '/');
    const { mediaUrl } = await import('./media');
    expect(mediaUrl(asset())).toBe('');
  });
});

import { beforeEach } from 'vitest';

/**
 * Node 25 defines an experimental global `localStorage` that is a non-functional
 * stub and shadows happy-dom's implementation, so tests need a working one.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(String(key), String(value));
  }
}

function ensureLocalStorage(): void {
  const current = globalThis.localStorage as unknown as { setItem?: unknown } | undefined;
  if (current && typeof current.setItem === 'function') return;
  const storage = new MemoryStorage();
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
  } catch {
    /* fall through to in-place patching below */
  }
  const target = globalThis.localStorage as unknown as Storage;
  if (typeof target.setItem === 'function') return;
  // Non-configurable stub: patch the methods onto the existing object.
  for (const method of ['clear', 'getItem', 'setItem', 'removeItem', 'key'] as const) {
    Object.defineProperty(target, method, {
      value: storage[method].bind(storage),
      configurable: true,
    });
  }
  Object.defineProperty(target, 'length', { get: () => storage.length, configurable: true });
}

ensureLocalStorage();

beforeEach(() => {
  globalThis.localStorage.clear();
});

import { notify, reportSync } from '@/utils/notify';

export interface OutboxOptions<T> {
  /** Perform one operation against the backend. Rejects on failure. */
  run: (op: T) => Promise<void>;
  /** localStorage key used to survive reloads. */
  storageKey: string;
  /** Optional coalescing: fold a new op into the pending queue. */
  coalesce?: (queue: T[], op: T) => T[];
  /** Initial retry delay; doubles each attempt up to maxBackoffMs. */
  baseBackoffMs?: number;
  /** Upper bound on retry backoff. */
  maxBackoffMs?: number;
}

export interface Outbox<T> {
  enqueue(op: T): void;
  size(): number;
  pending(): T[];
  /** Resolves once the queue drains (only useful in tests / known-online runs). */
  whenIdle(): Promise<void>;
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * A persistent, serial write queue. Operations are replayed in order with
 * exponential backoff, so a dropped connection or a server restart never loses
 * an edit — the queue is kept in localStorage and resumed on the next load.
 */
export function createOutbox<T>(options: OutboxOptions<T>): Outbox<T> {
  const { run, storageKey, coalesce, baseBackoffMs = 1000, maxBackoffMs = 30_000 } = options;

  let queue = read<T>(storageKey);
  let running = false;
  let attempts = 0;
  let lastErrorAt = 0;
  const idleWaiters: Array<() => void> = [];

  function persist(): void {
    try {
      if (queue.length) localStorage.setItem(storageKey, JSON.stringify(queue));
      else localStorage.removeItem(storageKey);
    } catch {
      notify(
        'error',
        "Couldn't stash unsaved changes",
        'Browser storage is full — keep this tab open until it saves.',
      );
    }
    reportSync({ pending: queue.length, working: running, failed: attempts > 0 });
  }

  function settleIdle(): void {
    if (queue.length === 0) {
      while (idleWaiters.length) idleWaiters.shift()?.();
    }
  }

  async function process(): Promise<void> {
    if (running || queue.length === 0) return;
    running = true;
    persist();
    while (queue.length) {
      // Re-read the head each pass: a coalesced op may have replaced it.
      const op = queue[0];
      const wasFailing = attempts > 0;
      try {
        await run(op);
        // Remove by identity — coalescing may have swapped the head meanwhile.
        queue = queue.filter((candidate) => candidate !== op);
        attempts = 0;
        persist();
        if (wasFailing) notify('success', 'Back in sync', 'Your queued changes are saved.');
      } catch {
        attempts++;
        const now = Date.now();
        if (now - lastErrorAt > 20_000) {
          lastErrorAt = now;
          notify(
            'error',
            "Can't reach the server",
            'Your changes are queued and will retry automatically.',
          );
        }
        reportSync({ pending: queue.length, working: true, failed: true });
        const wait = Math.min(maxBackoffMs, baseBackoffMs * 2 ** Math.min(attempts - 1, 5));
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
    running = false;
    persist();
    settleIdle();
  }

  function kick(): void {
    void process();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', kick);
    // Resume anything left over from a previous session.
    queueMicrotask(kick);
  }

  return {
    enqueue(op) {
      queue = coalesce ? coalesce(queue, op) : [...queue, op];
      persist();
      kick();
    },
    size: () => queue.length,
    pending: () => [...queue],
    whenIdle: () =>
      new Promise<void>((resolve) => {
        if (!running && queue.length === 0) resolve();
        else idleWaiters.push(resolve);
      }),
  };
}

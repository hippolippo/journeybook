import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOutbox } from './outbox';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

interface Op {
  id: string;
  v: number;
}

function lastWriteCoalesce(queue: Op[], op: Op): Op[] {
  const idx = queue.findIndex((o) => o.id === op.id);
  if (idx >= 0) {
    queue[idx] = op;
    return queue;
  }
  return [...queue, op];
}

describe('createOutbox', () => {
  it('runs enqueued operations in order and drains', async () => {
    const seen: string[] = [];
    const outbox = createOutbox<Op>({
      run: async (op) => {
        seen.push(`${op.id}:${op.v}`);
      },
      storageKey: 'test:order',
    });
    outbox.enqueue({ id: 'a', v: 1 });
    outbox.enqueue({ id: 'b', v: 1 });
    outbox.enqueue({ id: 'c', v: 1 });
    await outbox.whenIdle();
    expect(seen).toEqual(['a:1', 'b:1', 'c:1']);
    expect(outbox.size()).toBe(0);
  });

  it('retries a failing operation until it succeeds, without losing it', async () => {
    let tries = 0;
    const outbox = createOutbox<Op>({
      run: async () => {
        tries++;
        if (tries < 3) throw new Error('offline');
      },
      storageKey: 'test:retry',
      baseBackoffMs: 1,
      maxBackoffMs: 5,
    });
    outbox.enqueue({ id: 'a', v: 1 });
    await outbox.whenIdle();
    expect(tries).toBe(3);
    expect(outbox.size()).toBe(0);
  });

  it('resumes operations left over from a previous session', async () => {
    localStorage.setItem('test:resume', JSON.stringify([{ id: 'a', v: 7 }]));
    const seen: number[] = [];
    const outbox = createOutbox<Op>({
      run: async (op) => {
        seen.push(op.v);
      },
      storageKey: 'test:resume',
      baseBackoffMs: 1,
    });
    await outbox.whenIdle();
    expect(seen).toEqual([7]);
    expect(localStorage.getItem('test:resume')).toBeNull();
  });

  it('never loses a coalesced update that races an in-flight op', async () => {
    const order: string[] = [];
    const outbox = createOutbox<Op>({
      run: async (op) => {
        order.push(`${op.id}:${op.v}`);
      },
      storageKey: 'test:race',
      baseBackoffMs: 1,
      coalesce: lastWriteCoalesce,
    });
    outbox.enqueue({ id: 'a', v: 1 });
    outbox.enqueue({ id: 'a', v: 2 });
    outbox.enqueue({ id: 'b', v: 9 });
    await outbox.whenIdle();
    expect(order[order.length - 1]).toBe('b:9');
    expect(order).toContain('a:2');
    expect(outbox.size()).toBe(0);
  });
});

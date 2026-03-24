import { describe, it, expect, vi } from 'vitest';

import { SyncChannel } from '../../../../src/server/primitives/sync';

describe('SyncChannel server wiring', () => {
  it('immediate flush triggers listener synchronously', async () => {
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'immediate' },
    });

    const flushed: unknown[][] = [];
    channel.onFlush((patches) => flushed.push(patches));

    channel.enqueue([{ op: 'replace', path: '/x', value: 1 }]);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toEqual([{ op: 'replace', path: '/x', value: 1 }]);

    await channel.destroy();
  });

  it('batched flush accumulates and flushes at threshold', async () => {
    vi.useFakeTimers();
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'batched', maxBatchSize: 3, batchIntervalMs: 1000 },
    });

    const flushed: unknown[][] = [];
    channel.onFlush((patches) => flushed.push(patches));

    channel.enqueue([{ op: 'replace', path: '/a', value: 1 }]);
    channel.enqueue([{ op: 'replace', path: '/b', value: 2 }]);
    expect(flushed).toHaveLength(0);

    channel.enqueue([{ op: 'replace', path: '/c', value: 3 }]);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(3);

    await channel.destroy();
    vi.useRealTimers();
  });

  it('debounced flush waits for inactivity', async () => {
    vi.useFakeTimers();
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'debounced', debounceMs: 100 },
    });

    const flushed: unknown[][] = [];
    channel.onFlush((patches) => flushed.push(patches));

    channel.enqueue([{ op: 'replace', path: '/a', value: 1 }]);
    vi.advanceTimersByTime(50);
    channel.enqueue([{ op: 'replace', path: '/b', value: 2 }]);
    expect(flushed).toHaveLength(0);

    vi.advanceTimersByTime(100);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(2);

    await channel.destroy();
    vi.useRealTimers();
  });

  it('onFlush returns unsubscribe function', async () => {
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'immediate' },
    });

    const flushed: unknown[][] = [];
    const unsub = channel.onFlush((patches) => flushed.push(patches));
    channel.enqueue([{ op: 'replace', path: '/a', value: 1 }]);
    expect(flushed).toHaveLength(1);

    unsub();
    channel.enqueue([{ op: 'replace', path: '/b', value: 2 }]);
    expect(flushed).toHaveLength(1);

    await channel.destroy();
  });
});

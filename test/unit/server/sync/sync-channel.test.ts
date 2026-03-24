import { describe, it, expect, vi } from 'vitest';

import { SyncChannel } from '../../../../src/server/sync';

describe('SyncChannel', () => {
  it('flushes immediately with immediate strategy', () => {
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'immediate' },
    });
    const handler = vi.fn();
    channel.onFlush(handler);
    channel.enqueue([{ op: 'replace', path: '/count', value: 1 }]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith([{ op: 'replace', path: '/count', value: 1 }]);
    channel.destroy();
  });

  it('accumulates with batched strategy', async () => {
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'batched', batchIntervalMs: 50, maxBatchSize: 100 },
    });
    const handler = vi.fn();
    channel.onFlush(handler);
    channel.enqueue([{ op: 'replace', path: '/a', value: 1 }]);
    channel.enqueue([{ op: 'replace', path: '/b', value: 2 }]);
    expect(handler).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 100));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith([
      { op: 'replace', path: '/a', value: 1 },
      { op: 'replace', path: '/b', value: 2 },
    ]);
    channel.destroy();
  });

  it('immediate strategy flushes each enqueue independently', () => {
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'immediate' },
    });
    const handler = vi.fn();
    channel.onFlush(handler);
    channel.enqueue([{ op: 'replace', path: '/a', value: 1 }]);
    channel.enqueue([{ op: 'replace', path: '/b', value: 2 }]);
    expect(handler).toHaveBeenCalledTimes(2);
    channel.destroy();
  });

  it('destroy drains pending patches then clears listeners', async () => {
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'batched', batchIntervalMs: 50, maxBatchSize: 100 },
    });
    const handler = vi.fn();
    channel.onFlush(handler);
    channel.enqueue([{ op: 'replace', path: '/a', value: 1 }]);
    channel.destroy();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith([{ op: 'replace', path: '/a', value: 1 }]);

    // After destroy, further enqueues do not trigger the handler
    handler.mockClear();
    channel.enqueue([{ op: 'replace', path: '/b', value: 2 }]);
    await new Promise((r) => setTimeout(r, 100));
    expect(handler).not.toHaveBeenCalled();
  });

  it('enqueue with empty patch array does not flush', () => {
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'immediate' },
    });
    const handler = vi.fn();
    channel.onFlush(handler);
    channel.enqueue([]);
    expect(handler).not.toHaveBeenCalled();
    channel.destroy();
  });

  it('works without a flush handler registered', () => {
    const channel = new SyncChannel({
      key: 'test',
      direction: 'server-to-client',
      mode: 'json-patch',
      flush: { flushStrategy: 'immediate' },
    });
    expect(() => channel.enqueue([{ op: 'add', path: '/x', value: 1 }])).not.toThrow();
    channel.destroy();
  });
});

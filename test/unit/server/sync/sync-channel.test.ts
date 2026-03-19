import { describe, it, expect, vi } from 'vitest';

import { SyncChannel } from '../../../../src/server/sync';

describe('SyncChannel', () => {
  it('should flush immediately with immediate strategy', () => {
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

  it('should accumulate with batched strategy', async () => {
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
});

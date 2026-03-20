import { describe, it, expect } from 'vitest';

import { ThreadStrategy } from '../../../../src/server/concurrency/thread-strategy';

describe('ThreadStrategy', () => {
  it('assigns and releases workers', async () => {
    const strategy = new ThreadStrategy({ maxThreads: 4 });
    await strategy.initialize();

    const worker = await strategy.assignWorker('conn-1');
    expect(worker.isAlive()).toBe(true);
    expect(strategy.getConnectionCount()).toBe(1);

    await strategy.releaseWorker('conn-1');
    expect(strategy.getConnectionCount()).toBe(0);

    await strategy.shutdown();
  });

  it('enforces max thread limit', async () => {
    const strategy = new ThreadStrategy({ maxThreads: 2 });
    await strategy.initialize();

    await strategy.assignWorker('a');
    await strategy.assignWorker('b');
    await expect(strategy.assignWorker('c')).rejects.toThrow('Thread limit');

    await strategy.shutdown();
  });

  it('handles messages through worker', async () => {
    const strategy = new ThreadStrategy({ maxThreads: 4 });
    const messages: unknown[] = [];
    strategy.onMessage((msg) => messages.push(msg));
    await strategy.initialize();

    const worker = await strategy.assignWorker('conn-1');
    await worker.handleMessage('conn-1', new Uint8Array([1, 2, 3]));

    await new Promise((r) => setTimeout(r, 100));
    expect(messages.length).toBeGreaterThanOrEqual(1);

    await strategy.shutdown();
  });

  it('broadcast sends to all workers', async () => {
    const strategy = new ThreadStrategy({ maxThreads: 4 });
    const messages: unknown[] = [];
    strategy.onMessage((msg) => messages.push(msg));
    await strategy.initialize();

    await strategy.assignWorker('a');
    await strategy.assignWorker('b');

    await strategy.broadcast(new Uint8Array([9, 8, 7]));
    await new Promise((r) => setTimeout(r, 100));
    expect(messages.length).toBeGreaterThanOrEqual(2);

    await strategy.shutdown();
  });
});

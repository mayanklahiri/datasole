import { describe, it, expect } from 'vitest';

import { ThreadPoolStrategy } from '../../../../src/server/concurrency/thread-pool-strategy';

describe('ThreadPoolStrategy', () => {
  it('initializes pool workers', async () => {
    const strategy = new ThreadPoolStrategy({ poolSize: 2 });
    await strategy.initialize();
    expect(strategy.getActiveWorkerCount()).toBe(0);
    await strategy.shutdown();
  });

  it('assigns connections with least-connections routing', async () => {
    const strategy = new ThreadPoolStrategy({ poolSize: 2 });
    await strategy.initialize();

    await strategy.assignWorker('a');
    await strategy.assignWorker('b');
    expect(strategy.getConnectionCount()).toBe(2);

    await strategy.shutdown();
  });

  it('releases connections', async () => {
    const strategy = new ThreadPoolStrategy({ poolSize: 2 });
    await strategy.initialize();

    await strategy.assignWorker('a');
    expect(strategy.getConnectionCount()).toBe(1);

    await strategy.releaseWorker('a');
    expect(strategy.getConnectionCount()).toBe(0);

    await strategy.shutdown();
  });

  it('handles messages through pool', async () => {
    const strategy = new ThreadPoolStrategy({ poolSize: 2 });
    const messages: unknown[] = [];
    strategy.onMessage((msg) => messages.push(msg));
    await strategy.initialize();

    const worker = await strategy.assignWorker('conn-1');
    await worker.handleMessage('conn-1', new Uint8Array([4, 5, 6]));

    await new Promise((r) => setTimeout(r, 100));
    expect(messages.length).toBeGreaterThanOrEqual(1);

    await strategy.shutdown();
  });

  it('broadcast sends to all pool workers', async () => {
    const strategy = new ThreadPoolStrategy({ poolSize: 2 });
    const messages: unknown[] = [];
    strategy.onMessage((msg) => messages.push(msg));
    await strategy.initialize();

    await strategy.assignWorker('a');
    await strategy.assignWorker('b');

    await strategy.broadcast(new Uint8Array([1, 2]));
    await new Promise((r) => setTimeout(r, 100));
    expect(messages.length).toBeGreaterThanOrEqual(2);

    await strategy.shutdown();
  });
});

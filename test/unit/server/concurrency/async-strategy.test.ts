import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AsyncStrategy } from '../../../../src/server/concurrency/async-strategy';
import type { WorkerMessage } from '../../../../src/server/concurrency/types';

describe('AsyncStrategy', () => {
  let strategy: AsyncStrategy;

  beforeEach(() => {
    strategy = new AsyncStrategy();
  });

  describe('constructor', () => {
    it('creates with model "async"', () => {
      expect(strategy.model).toBe('async');
    });

    it('starts with zero connections', () => {
      expect(strategy.getConnectionCount()).toBe(0);
    });

    it('accepts optional options', () => {
      const s = new AsyncStrategy({ model: 'async', poolSize: 2 });
      expect(s.model).toBe('async');
    });
  });

  describe('initialize()', () => {
    it('resolves without error', async () => {
      await expect(strategy.initialize()).resolves.toBeUndefined();
    });
  });

  describe('assignWorker()', () => {
    it('creates a worker with matching id', async () => {
      const worker = await strategy.assignWorker('conn-1');
      expect(worker.id).toBe('conn-1');
      expect(worker.type).toBe('async');
    });

    it('increments connection count', async () => {
      await strategy.assignWorker('conn-1');
      await strategy.assignWorker('conn-2');
      expect(strategy.getConnectionCount()).toBe(2);
    });
  });

  describe('releaseWorker()', () => {
    it('removes the worker', async () => {
      await strategy.assignWorker('conn-1');
      expect(strategy.getConnectionCount()).toBe(1);
      await strategy.releaseWorker('conn-1');
      expect(strategy.getConnectionCount()).toBe(0);
    });

    it('is safe to release a non-existent worker', async () => {
      await expect(strategy.releaseWorker('no-such')).resolves.toBeUndefined();
    });
  });

  describe('onMessage()', () => {
    it('sets handler used by subsequently assigned workers', async () => {
      const handler = vi.fn();
      strategy.onMessage(handler);

      const worker = await strategy.assignWorker('conn-1');
      const payload = new Uint8Array([1, 2, 3]);
      await worker.handleMessage('conn-1', payload);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({
        type: 'frame',
        connectionId: 'conn-1',
        payload,
      } satisfies WorkerMessage);
    });
  });

  describe('Worker', () => {
    it('handleMessage calls the registered handler', async () => {
      const handler = vi.fn();
      strategy.onMessage(handler);
      const worker = await strategy.assignWorker('conn-1');

      const data = new Uint8Array([10, 20]);
      await worker.handleMessage('conn-1', data);

      expect(handler).toHaveBeenCalledWith({
        type: 'frame',
        connectionId: 'conn-1',
        payload: data,
      });
    });

    it('handleDisconnect is a no-op', async () => {
      const worker = await strategy.assignWorker('conn-1');
      await expect(worker.handleDisconnect('conn-1')).resolves.toBeUndefined();
    });

    it('terminate is a no-op', async () => {
      const worker = await strategy.assignWorker('conn-1');
      await expect(worker.terminate()).resolves.toBeUndefined();
    });

    it('isAlive returns true', async () => {
      const worker = await strategy.assignWorker('conn-1');
      expect(worker.isAlive()).toBe(true);
    });
  });

  describe('broadcast()', () => {
    it('calls handleMessage on all workers', async () => {
      const handler = vi.fn();
      strategy.onMessage(handler);

      await strategy.assignWorker('conn-1');
      await strategy.assignWorker('conn-2');

      const data = new Uint8Array([99]);
      await strategy.broadcast(data);

      expect(handler).toHaveBeenCalledTimes(2);

      const connIds = handler.mock.calls.map((c) => (c[0] as WorkerMessage).connectionId);
      expect(connIds).toContain('conn-1');
      expect(connIds).toContain('conn-2');
    });

    it('is safe with no workers', async () => {
      await expect(strategy.broadcast(new Uint8Array([1]))).resolves.toBeUndefined();
    });
  });

  describe('getActiveWorkerCount()', () => {
    it('always returns 1', async () => {
      expect(strategy.getActiveWorkerCount()).toBe(1);
      await strategy.assignWorker('conn-1');
      await strategy.assignWorker('conn-2');
      expect(strategy.getActiveWorkerCount()).toBe(1);
    });
  });

  describe('getConnectionCount()', () => {
    it('reflects workers map size', async () => {
      expect(strategy.getConnectionCount()).toBe(0);
      await strategy.assignWorker('a');
      expect(strategy.getConnectionCount()).toBe(1);
      await strategy.assignWorker('b');
      expect(strategy.getConnectionCount()).toBe(2);
      await strategy.releaseWorker('a');
      expect(strategy.getConnectionCount()).toBe(1);
    });
  });

  describe('shutdown()', () => {
    it('clears all workers', async () => {
      await strategy.assignWorker('conn-1');
      await strategy.assignWorker('conn-2');
      expect(strategy.getConnectionCount()).toBe(2);

      await strategy.shutdown();
      expect(strategy.getConnectionCount()).toBe(0);
    });
  });
});

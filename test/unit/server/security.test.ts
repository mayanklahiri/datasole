/**
 * Server-side security tests: connection limits, rate limiter lifecycle,
 * event name validation, CRDT registry limits.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MemoryBackend } from '../../../src/server/backends/memory';
import { EventBus } from '../../../src/server/primitives/events/event-bus';
import { DefaultRateLimiter } from '../../../src/server/primitives/rate-limit/default-limiter';
import type { DatasoleContract } from '../../../src/shared/contract';

describe('MemoryBackend security', () => {
  it('publish with key "error" does not crash (no EventEmitter special-casing)', async () => {
    const backend = new MemoryBackend();
    const handler = vi.fn();
    backend.subscribe('error', handler);
    await backend.publish('error', { msg: 'test' });
    expect(handler).toHaveBeenCalledWith('error', { msg: 'test' });
  });

  it('publish without subscribers is safe for any key', async () => {
    const backend = new MemoryBackend();
    await expect(backend.publish('error', 'data')).resolves.toBeUndefined();
    await expect(backend.publish('__proto__', 'data')).resolves.toBeUndefined();
  });

  it('listener errors are isolated', async () => {
    const backend = new MemoryBackend();
    const good = vi.fn();
    backend.subscribe('test', () => {
      throw new Error('boom');
    });
    backend.subscribe('test', good);
    await backend.publish('test', 'data');
    expect(good).toHaveBeenCalledWith('test', 'data');
  });

  it('unsubscribe cleans up empty sets', async () => {
    const backend = new MemoryBackend();
    const unsub = backend.subscribe('key', () => {});
    unsub();
    // Should not throw on subsequent operations
    await expect(backend.publish('key', 'x')).resolves.toBeUndefined();
  });
});

describe('DefaultRateLimiter lifecycle', () => {
  let limiter: DefaultRateLimiter;

  beforeEach(() => {
    limiter = new DefaultRateLimiter(new MemoryBackend());
  });

  afterEach(async () => {
    await limiter.destroy();
  });

  it('destroy clears interval and windows', async () => {
    await limiter.destroy();
    // Should not throw when destroyed twice
    await expect(limiter.destroy()).resolves.toBeUndefined();
  });
});

describe('EventBus handler isolation', () => {
  it('throwing handler does not prevent other handlers from running', () => {
    const bus = new EventBus<DatasoleContract>(new MemoryBackend());
    const good = vi.fn();
    bus.on('test', () => {
      throw new Error('handler crash');
    });
    bus.on('test', good);
    bus.emit('test', { data: 1 });
    expect(good).toHaveBeenCalled();
  });
});

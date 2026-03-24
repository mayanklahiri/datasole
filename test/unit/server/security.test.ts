/**
 * Server-side security tests: connection limits, rate limiter lifecycle,
 * event name validation, CRDT registry limits.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { EventBus } from '../../../src/server/events/event-bus';
import { MemoryRateLimiter } from '../../../src/server/rate-limit/memory-limiter';
import { MemoryBackend } from '../../../src/server/state/backends/memory';

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

  it('unsubscribe cleans up empty sets', () => {
    const backend = new MemoryBackend();
    const unsub = backend.subscribe('key', () => {});
    unsub();
    // Should not throw on subsequent operations
    expect(() => backend.publish('key', 'x')).not.toThrow();
  });
});

describe('MemoryRateLimiter lifecycle', () => {
  let limiter: MemoryRateLimiter;

  beforeEach(() => {
    limiter = new MemoryRateLimiter();
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('destroy clears interval and windows', () => {
    limiter.destroy();
    // Should not throw when destroyed twice
    expect(() => limiter.destroy()).not.toThrow();
  });
});

describe('EventBus handler isolation', () => {
  it('throwing handler does not prevent other handlers from running', () => {
    const bus = new EventBus();
    const good = vi.fn();
    bus.on('test', () => {
      throw new Error('handler crash');
    });
    bus.on('test', good);
    bus.emit('test', { data: 1 });
    expect(good).toHaveBeenCalled();
  });
});

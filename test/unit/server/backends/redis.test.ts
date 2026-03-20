import { describe, it, expect } from 'vitest';

import { RedisBackend } from '../../../../src/server/state/backends/redis';

describe('RedisBackend', () => {
  it('constructs with default options', () => {
    const backend = new RedisBackend();
    expect(backend).toBeDefined();
  });

  it('constructs with custom options', () => {
    const backend = new RedisBackend({ url: 'redis://custom:6380', keyPrefix: 'test:' });
    expect(backend).toBeDefined();
  });

  it('throws on get before connect', async () => {
    const backend = new RedisBackend();
    await expect(backend.get('key')).rejects.toThrow('not connected');
  });

  it('throws on set before connect', async () => {
    const backend = new RedisBackend();
    await expect(backend.set('key', 'value')).rejects.toThrow('not connected');
  });

  it('throws on delete before connect', async () => {
    const backend = new RedisBackend();
    await expect(backend.delete('key')).rejects.toThrow('not connected');
  });

  it('subscribe returns unsubscribe function', () => {
    const backend = new RedisBackend();
    const unsub = backend.subscribe('key', () => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });
});

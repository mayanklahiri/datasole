import { describe, it, expect, vi } from 'vitest';

import { MemoryBackend } from '../../../../src/server/state/backends';

describe('MemoryBackend', () => {
  it('get returns undefined for missing key', async () => {
    const backend = new MemoryBackend();
    expect(await backend.get('missing')).toBeUndefined();
  });

  it('set and get round-trip', async () => {
    const backend = new MemoryBackend();
    await backend.set('key1', { value: 42 });
    expect(await backend.get('key1')).toEqual({ value: 42 });
  });

  it('set overwrites existing value', async () => {
    const backend = new MemoryBackend();
    await backend.set('k', 'old');
    await backend.set('k', 'new');
    expect(await backend.get('k')).toBe('new');
  });

  it('delete returns true for existing key', async () => {
    const backend = new MemoryBackend();
    await backend.set('key1', 'value');
    expect(await backend.delete('key1')).toBe(true);
    expect(await backend.get('key1')).toBeUndefined();
  });

  it('delete returns false for non-existent key', async () => {
    const backend = new MemoryBackend();
    expect(await backend.delete('nope')).toBe(false);
  });

  it('subscribe + publish delivers value to handler', async () => {
    const backend = new MemoryBackend();
    const handler = vi.fn();
    backend.subscribe('ch', handler);

    await backend.publish('ch', { msg: 'hello' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith('ch', { msg: 'hello' });
  });

  it('subscribe delivers to multiple handlers', async () => {
    const backend = new MemoryBackend();
    const h1 = vi.fn();
    const h2 = vi.fn();
    backend.subscribe('ch', h1);
    backend.subscribe('ch', h2);

    await backend.publish('ch', 42);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('unsubscribe stops delivery', async () => {
    const backend = new MemoryBackend();
    const handler = vi.fn();
    const unsub = backend.subscribe('ch', handler);

    unsub();
    await backend.publish('ch', 'after-unsub');

    expect(handler).not.toHaveBeenCalled();
  });

  it('publish to channel with no subscribers is a no-op', async () => {
    const backend = new MemoryBackend();
    await expect(backend.publish('nobody', 'data')).resolves.toBeUndefined();
  });

  it('handler error does not prevent other handlers from running', async () => {
    const backend = new MemoryBackend();
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const safe = vi.fn();
    backend.subscribe('ch', throwing);
    backend.subscribe('ch', safe);

    await backend.publish('ch', 'data');

    expect(throwing).toHaveBeenCalledOnce();
    expect(safe).toHaveBeenCalledOnce();
  });

  it('"error" key works safely without crashing', async () => {
    const backend = new MemoryBackend();
    await backend.set('error', { critical: true });
    expect(await backend.get('error')).toEqual({ critical: true });

    const handler = vi.fn();
    backend.subscribe('error', handler);
    await backend.publish('error', 'err-value');
    expect(handler).toHaveBeenCalledWith('error', 'err-value');
  });
});

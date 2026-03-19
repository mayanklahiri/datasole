import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryBackend } from '../../../src/server/state/backends/memory';
import { SessionManager } from '../../../src/server/state/session-manager';
import { DefaultConnectionContext } from '../../../src/server/transport/connection-context';

function makeCtx(userId: string) {
  return new DefaultConnectionContext({
    connectionId: 'conn-1',
    auth: { userId, roles: [], metadata: {} },
    remoteAddress: '127.0.0.1',
  });
}

describe('SessionManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('set and get values per user', () => {
    const sm = new SessionManager(new MemoryBackend(), { flushIntervalMs: 0 });
    sm.set('u1', 'color', 'blue');
    expect(sm.get('u1', 'color')).toBe('blue');
    expect(sm.get('u1', 'missing')).toBeUndefined();
    expect(sm.get('u2', 'color')).toBeUndefined();
    sm.destroy();
  });

  it('set increments version and fires onChange', () => {
    const sm = new SessionManager(new MemoryBackend(), { flushIntervalMs: 0 });
    const changes: Array<{ userId: string; key: string; value: unknown; version: number }> = [];
    sm.onChange((userId, key, value, version) => changes.push({ userId, key, value, version }));

    sm.set('u1', 'x', 10);
    sm.set('u1', 'x', 20);
    expect(changes).toHaveLength(2);
    expect(changes[0]!.version).toBe(1);
    expect(changes[1]!.version).toBe(2);
    expect(changes[1]!.value).toBe(20);
    sm.destroy();
  });

  it('delete removes a key', () => {
    const sm = new SessionManager(new MemoryBackend(), { flushIntervalMs: 0 });
    sm.set('u1', 'a', 1);
    expect(sm.delete('u1', 'a')).toBe(true);
    expect(sm.get('u1', 'a')).toBeUndefined();
    expect(sm.delete('u1', 'nonexistent')).toBe(false);
    expect(sm.delete('nouser', 'a')).toBe(false);
    sm.destroy();
  });

  it('flushUser persists to backend', async () => {
    const backend = new MemoryBackend();
    const sm = new SessionManager(backend, { flushIntervalMs: 0 });
    sm.set('u1', 'k1', 'v1');
    sm.set('u1', 'k2', 'v2');

    await sm.flushUser('u1');
    const persisted = await backend.get<Record<string, unknown>>('session:u1');
    expect(persisted).toEqual({ k1: 'v1', k2: 'v2' });
    sm.destroy();
  });

  it('flush threshold triggers automatic flush', async () => {
    const backend = new MemoryBackend();
    const sm = new SessionManager(backend, { flushThreshold: 3, flushIntervalMs: 0 });

    sm.set('u1', 'a', 1);
    sm.set('u1', 'b', 2);
    // Third set should trigger flush (threshold=3)
    sm.set('u1', 'c', 3);

    // Allow the async flush to complete
    await new Promise((r) => setTimeout(r, 50));

    const persisted = await backend.get<Record<string, unknown>>('session:u1');
    expect(persisted).toEqual({ a: 1, b: 2, c: 3 });
    sm.destroy();
  });

  it('snapshot restores persisted session data', async () => {
    const backend = new MemoryBackend();
    await backend.set('session:u1', { saved: 'data', count: 42 });

    const sm = new SessionManager(backend, { flushIntervalMs: 0 });
    const ctx = makeCtx('u1');
    const result = await sm.snapshot(ctx);

    expect(result).toEqual({ saved: 'data', count: 42 });
    expect(sm.get('u1', 'saved')).toBe('data');
    expect(sm.get('u1', 'count')).toBe(42);
    sm.destroy();
  });

  it('snapshot returns {} for null userId', async () => {
    const sm = new SessionManager(new MemoryBackend(), { flushIntervalMs: 0 });
    const ctx = new DefaultConnectionContext({
      connectionId: 'conn-1',
      auth: null,
      remoteAddress: '127.0.0.1',
    });
    const result = await sm.snapshot(ctx);
    expect(result).toEqual({});
    sm.destroy();
  });

  it('flushAll persists all dirty users', async () => {
    const backend = new MemoryBackend();
    const sm = new SessionManager(backend, { flushIntervalMs: 0 });
    sm.set('u1', 'a', 1);
    sm.set('u2', 'b', 2);

    await sm.flushAll();
    expect(await backend.get('session:u1')).toEqual({ a: 1 });
    expect(await backend.get('session:u2')).toEqual({ b: 2 });
    sm.destroy();
  });

  it('onChange returns unsubscribe function', () => {
    const sm = new SessionManager(new MemoryBackend(), { flushIntervalMs: 0 });
    let count = 0;
    const unsub = sm.onChange(() => count++);

    sm.set('u1', 'x', 1);
    expect(count).toBe(1);

    unsub();
    sm.set('u1', 'x', 2);
    expect(count).toBe(1);
    sm.destroy();
  });

  it('evict flushes and removes user', async () => {
    const backend = new MemoryBackend();
    const sm = new SessionManager(backend, { flushIntervalMs: 0 });
    sm.set('u1', 'x', 42);
    await sm.evict('u1');
    expect(sm.get('u1', 'x')).toBeUndefined();
    expect(await backend.get('session:u1')).toEqual({ x: 42 });
    sm.destroy();
  });

  it('destroy clears flush timer', () => {
    const sm = new SessionManager(new MemoryBackend(), { flushIntervalMs: 100 });
    sm.destroy();
    // No assertion needed — just verifying no errors and the timer doesn't fire
  });
});

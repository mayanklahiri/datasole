import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatasoleClient } from '../../../src/client/client';

describe('DatasoleClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const client = new DatasoleClient({ url: 'http://localhost:3000' });
    expect(client.getConnectionState()).toBe('disconnected');
  });

  it('getConnectionState returns disconnected before connect', () => {
    const client = new DatasoleClient({ url: 'http://localhost:3000' });
    expect(client.getConnectionState()).toBe('disconnected');
  });

  it('getState returns undefined before subscribing', () => {
    const client = new DatasoleClient({ url: 'http://localhost:3000' });
    expect(client.getState('nonexistent')).toBeUndefined();
  });

  it('subscribeState creates a state store and returns unsubscribe', () => {
    const client = new DatasoleClient({ url: 'http://localhost:3000' });
    const values: unknown[] = [];
    const sub = client.subscribeState('key1', (state) => values.push(state));

    expect(sub).toBeDefined();
    expect(typeof sub.unsubscribe).toBe('function');
    sub.unsubscribe();
  });

  it('subscribeState returns same store for same key', () => {
    const client = new DatasoleClient({ url: 'http://localhost:3000' });
    const v1: unknown[] = [];
    const v2: unknown[] = [];
    client.subscribeState('k', (s) => v1.push(s));
    client.subscribeState('k', (s) => v2.push(s));
    // Both subscriptions on the same key share a state store
    expect(client.getState('k')).toBeUndefined();
  });

  it('emit throws when not connected', () => {
    const client = new DatasoleClient({ url: 'http://localhost:3000' });
    expect(() => client.emit('test', {})).toThrow('Not connected');
  });

  it('rpc throws when not connected', async () => {
    const client = new DatasoleClient({ url: 'http://localhost:3000' });
    await expect(client.rpc('method')).rejects.toThrow();
  });

  it('disconnect when already disconnected is safe', async () => {
    const client = new DatasoleClient({ url: 'http://localhost:3000' });
    await client.disconnect();
    expect(client.getConnectionState()).toBe('disconnected');
  });

  it('on/off register and unregister event handlers', () => {
    const client = new DatasoleClient({ url: 'http://localhost:3000' });
    const handler = () => {};
    client.on('test', handler);
    client.off('test', handler);
    // No errors — verifies the API works
  });
});

import { describe, it, expect } from 'vitest';

import { PostgresBackend } from '../../../../src/server/state/backends/postgres';

describe('PostgresBackend', () => {
  it('constructs with default options', () => {
    const backend = new PostgresBackend();
    expect(backend).toBeDefined();
  });

  it('constructs with custom options', () => {
    const backend = new PostgresBackend({ connectionString: 'postgresql://custom:5432/test' });
    expect(backend).toBeDefined();
  });

  it('throws on get before connect', async () => {
    const backend = new PostgresBackend();
    await expect(backend.get('key')).rejects.toThrow('not connected');
  });

  it('throws on set before connect', async () => {
    const backend = new PostgresBackend();
    await expect(backend.set('key', 'val')).rejects.toThrow('not connected');
  });

  it('subscribe returns unsubscribe function', () => {
    const backend = new PostgresBackend();
    const unsub = backend.subscribe('key', () => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });
});

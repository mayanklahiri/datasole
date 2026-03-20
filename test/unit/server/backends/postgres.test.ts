import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPoolInstance = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
}));

const mockPoolClient = vi.hoisted(() => ({
  query: vi.fn(),
  on: vi.fn(),
  release: vi.fn(),
}));

vi.mock('pg', () => {
  return {
    Pool: vi.fn(function () {
      return mockPoolInstance;
    }),
  };
});

import { PostgresBackend } from '../../../../src/server/state/backends/postgres';

describe('PostgresBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolInstance.query.mockResolvedValue({ rows: [] });
    mockPoolInstance.connect.mockResolvedValue(mockPoolClient);
    mockPoolInstance.end.mockResolvedValue(undefined);
    mockPoolClient.query.mockResolvedValue({ rows: [] });
  });

  it('constructs with default options', () => {
    const backend = new PostgresBackend();
    expect(backend).toBeDefined();
  });

  it('constructs with custom options', () => {
    const backend = new PostgresBackend({
      connectionString: 'postgresql://custom:5432/test',
      tableName: 'my_state',
      prefix: 'app:',
    });
    expect(backend).toBeDefined();
  });

  describe('connect()', () => {
    it('creates table and sets up LISTEN', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS'),
      );
      expect(mockPoolClient.query).toHaveBeenCalledWith('LISTEN datasole_state_change');
      expect(mockPoolClient.on).toHaveBeenCalledWith('notification', expect.any(Function));
    });

    it('uses custom table name', async () => {
      const backend = new PostgresBackend({ tableName: 'custom_table' });
      await backend.connect();
      expect(mockPoolInstance.query).toHaveBeenCalledWith(expect.stringContaining('custom_table'));
    });
  });

  describe('disconnect()', () => {
    it('releases listen client and ends pool', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      await backend.disconnect();
      expect(mockPoolClient.release).toHaveBeenCalled();
      expect(mockPoolInstance.end).toHaveBeenCalled();
    });

    it('handles disconnect when not connected', async () => {
      const backend = new PostgresBackend();
      await expect(backend.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('get()', () => {
    it('throws when not connected', async () => {
      const backend = new PostgresBackend();
      await expect(backend.get('key')).rejects.toThrow('not connected');
    });

    it('returns undefined for missing key', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      mockPoolInstance.query.mockResolvedValue({ rows: [] });
      const result = await backend.get('missing');
      expect(result).toBeUndefined();
    });

    it('returns value from row', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      mockPoolInstance.query.mockResolvedValue({ rows: [{ value: { foo: 'bar' } }] });
      const result = await backend.get('key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('uses prefix in key lookup', async () => {
      const backend = new PostgresBackend({ prefix: 'pfx:' });
      await backend.connect();
      mockPoolInstance.query.mockResolvedValue({ rows: [] });
      await backend.get('mykey');
      expect(mockPoolInstance.query).toHaveBeenCalledWith(expect.stringContaining('SELECT value'), [
        'pfx:mykey',
      ]);
    });

    it('passes unprefixed key when no prefix', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      mockPoolInstance.query.mockResolvedValue({ rows: [] });
      await backend.get('mykey');
      expect(mockPoolInstance.query).toHaveBeenCalledWith(expect.stringContaining('SELECT value'), [
        'mykey',
      ]);
    });
  });

  describe('set()', () => {
    it('throws when not connected', async () => {
      const backend = new PostgresBackend();
      await expect(backend.set('key', 'val')).rejects.toThrow('not connected');
    });

    it('upserts value', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      await backend.set('key', { data: 123 });
      expect(mockPoolInstance.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
        'key',
        JSON.stringify({ data: 123 }),
      ]);
    });

    it('upserts with prefixed key', async () => {
      const backend = new PostgresBackend({ prefix: 'pfx:' });
      await backend.connect();
      await backend.set('key', 'val');
      expect(mockPoolInstance.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
        'pfx:key',
        JSON.stringify('val'),
      ]);
    });
  });

  describe('delete()', () => {
    it('throws when not connected', async () => {
      const backend = new PostgresBackend();
      await expect(backend.delete('key')).rejects.toThrow('not connected');
    });

    it('returns true when row was deleted', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 1 });
      const result = await backend.delete('key');
      expect(result).toBe(true);
    });

    it('returns false when no row deleted', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await backend.delete('key');
      expect(result).toBe(false);
    });

    it('returns false when rowCount is undefined', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      mockPoolInstance.query.mockResolvedValue({ rows: [] });
      const result = await backend.delete('key');
      expect(result).toBe(false);
    });
  });

  describe('subscribe()', () => {
    it('returns unsubscribe function', () => {
      const backend = new PostgresBackend();
      const unsub = backend.subscribe('key', () => {});
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('delivers notifications to handler', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      const handler = vi.fn();
      backend.subscribe('mykey', handler);

      const notifyCallback = mockPoolClient.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'notification',
      )![1] as (msg: { payload: string }) => void;

      notifyCallback({ payload: JSON.stringify({ key: 'mykey', value: 42 }) });
      expect(handler).toHaveBeenCalledWith('mykey', 42);
    });

    it('ignores malformed notification payloads', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      const handler = vi.fn();
      backend.subscribe('mykey', handler);

      const notifyCallback = mockPoolClient.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'notification',
      )![1] as (msg: { payload: string }) => void;

      expect(() => notifyCallback({ payload: 'not-json' })).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('unsubscribe stops delivery', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      const handler = vi.fn();
      const unsub = backend.subscribe('mykey', handler);

      const notifyCallback = mockPoolClient.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'notification',
      )![1] as (msg: { payload: string }) => void;

      unsub();
      notifyCallback({ payload: JSON.stringify({ key: 'mykey', value: 42 }) });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('publish()', () => {
    it('throws when not connected', async () => {
      const backend = new PostgresBackend();
      await expect(backend.publish('key', 'val')).rejects.toThrow('not connected');
    });

    it('sends pg_notify with serialized payload', async () => {
      const backend = new PostgresBackend();
      await backend.connect();
      await backend.publish('key', { msg: 'hi' });
      expect(mockPoolInstance.query).toHaveBeenCalledWith(expect.stringContaining('pg_notify'), [
        JSON.stringify({ key: 'key', value: { msg: 'hi' } }),
      ]);
    });
  });
});

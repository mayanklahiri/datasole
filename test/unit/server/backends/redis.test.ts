import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedisInstance = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(),
  on: vi.fn(),
  quit: vi.fn(),
  duplicate: vi.fn(),
}));

vi.mock('ioredis', () => {
  return {
    default: vi.fn(function () {
      return mockRedisInstance;
    }),
  };
});

import { RedisBackend } from '../../../../src/server/backends/redis';

describe('RedisBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisInstance.get.mockResolvedValue(null);
    mockRedisInstance.set.mockResolvedValue('OK');
    mockRedisInstance.del.mockResolvedValue(1);
    mockRedisInstance.publish.mockResolvedValue(1);
    mockRedisInstance.subscribe.mockResolvedValue(undefined);
    mockRedisInstance.quit.mockResolvedValue('OK');
    mockRedisInstance.duplicate.mockReturnValue({
      on: vi.fn(),
      subscribe: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue('OK'),
    });
  });

  it('constructs with default options', () => {
    const backend = new RedisBackend();
    expect(backend).toBeDefined();
  });

  it('constructs with custom options', () => {
    const backend = new RedisBackend({ url: 'redis://custom:6380', keyPrefix: 'test:' });
    expect(backend).toBeDefined();
  });

  it('uses prefix option when keyPrefix not provided', () => {
    const backend = new RedisBackend({ prefix: 'pfx:' });
    expect(backend).toBeDefined();
  });

  describe('connect()', () => {
    it('creates client and subscriber', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      expect(mockRedisInstance.duplicate).toHaveBeenCalled();
    });

    it('sets up message listener on subscriber', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      const subscriber = mockRedisInstance.duplicate.mock.results[0]!.value;
      expect(subscriber.on).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('disconnect()', () => {
    it('quits both client and subscriber', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      const subscriber = mockRedisInstance.duplicate.mock.results[0]!.value;
      await backend.disconnect();
      expect(mockRedisInstance.quit).toHaveBeenCalled();
      expect(subscriber.quit).toHaveBeenCalled();
    });

    it('handles disconnect when not connected', async () => {
      const backend = new RedisBackend();
      await expect(backend.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('get()', () => {
    it('throws when not connected', async () => {
      const backend = new RedisBackend();
      await expect(backend.get('key')).rejects.toThrow('not connected');
    });

    it('returns undefined for missing key', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      mockRedisInstance.get.mockResolvedValue(null);
      const result = await backend.get('missing');
      expect(result).toBeUndefined();
      expect(mockRedisInstance.get).toHaveBeenCalledWith('ds:missing');
    });

    it('returns parsed JSON value', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ foo: 'bar' }));
      const result = await backend.get('key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('uses custom keyPrefix', async () => {
      const backend = new RedisBackend({ keyPrefix: 'custom:' });
      await backend.connect();
      mockRedisInstance.get.mockResolvedValue(null);
      await backend.get('mykey');
      expect(mockRedisInstance.get).toHaveBeenCalledWith('custom:mykey');
    });
  });

  describe('set()', () => {
    it('throws when not connected', async () => {
      const backend = new RedisBackend();
      await expect(backend.set('key', 'val')).rejects.toThrow('not connected');
    });

    it('serializes and sets value with prefix', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      await backend.set('key', { hello: 'world' });
      expect(mockRedisInstance.set).toHaveBeenCalledWith('ds:key', '{"hello":"world"}');
    });
  });

  describe('delete()', () => {
    it('throws when not connected', async () => {
      const backend = new RedisBackend();
      await expect(backend.delete('key')).rejects.toThrow('not connected');
    });

    it('returns true when key was deleted', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      mockRedisInstance.del.mockResolvedValue(1);
      const result = await backend.delete('key');
      expect(result).toBe(true);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('ds:key');
    });

    it('returns false when key did not exist', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      mockRedisInstance.del.mockResolvedValue(0);
      const result = await backend.delete('missing');
      expect(result).toBe(false);
    });
  });

  describe('subscribe()', () => {
    it('returns unsubscribe function', () => {
      const backend = new RedisBackend();
      const unsub = backend.subscribe('key', () => {});
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('subscribes to Redis channel on first subscription after connect', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      const subscriber = mockRedisInstance.duplicate.mock.results[0]!.value;
      backend.subscribe('mykey', () => {});
      expect(subscriber.subscribe).toHaveBeenCalledWith('ds:mykey');
    });

    it('does not re-subscribe to the same channel', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      const subscriber = mockRedisInstance.duplicate.mock.results[0]!.value;
      backend.subscribe('mykey', () => {});
      backend.subscribe('mykey', () => {});
      expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    });

    it('delivers messages to handlers via pub/sub', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      const handler = vi.fn();
      backend.subscribe('mykey', handler);

      const subscriber = mockRedisInstance.duplicate.mock.results[0]!.value;
      const messageCallback = subscriber.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )![1] as (channel: string, message: string) => void;

      messageCallback('ds:mykey', JSON.stringify({ data: 42 }));
      expect(handler).toHaveBeenCalledWith('mykey', { data: 42 });
    });

    it('delivers raw message when JSON parse fails', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      const handler = vi.fn();
      backend.subscribe('mykey', handler);

      const subscriber = mockRedisInstance.duplicate.mock.results[0]!.value;
      const messageCallback = subscriber.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )![1] as (channel: string, message: string) => void;

      messageCallback('ds:mykey', 'not-json');
      expect(handler).toHaveBeenCalledWith('mykey', 'not-json');
    });

    it('unsubscribe stops delivery', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      const handler = vi.fn();
      const unsub = backend.subscribe('mykey', handler);

      const subscriber = mockRedisInstance.duplicate.mock.results[0]!.value;
      const messageCallback = subscriber.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'message',
      )![1] as (channel: string, message: string) => void;

      unsub();
      messageCallback('ds:mykey', JSON.stringify('hello'));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('publish()', () => {
    it('throws when not connected', async () => {
      const backend = new RedisBackend();
      await expect(backend.publish('key', 'val')).rejects.toThrow('not connected');
    });

    it('publishes serialized value to prefixed channel', async () => {
      const backend = new RedisBackend();
      await backend.connect();
      await backend.publish('key', { msg: 'hi' });
      expect(mockRedisInstance.publish).toHaveBeenCalledWith('ds:key', '{"msg":"hi"}');
    });
  });
});

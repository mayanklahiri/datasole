import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedisInstance = vi.hoisted(() => ({
  get: vi.fn(),
  pttl: vi.fn(),
  del: vi.fn(),
  multi: vi.fn(),
  quit: vi.fn(),
}));

const mockPipeline = vi.hoisted(() => ({
  incr: vi.fn(),
  pexpire: vi.fn(),
  pttl: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('ioredis', () => {
  return {
    default: vi.fn(function () {
      return mockRedisInstance;
    }),
  };
});

import { RedisRateLimiter } from '../../../../src/server/rate-limit/redis-limiter';
import type { RateLimitRule } from '../../../../src/server/rate-limit/types';

describe('RedisRateLimiter', () => {
  const rule: RateLimitRule = { windowMs: 60_000, maxRequests: 10 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPipeline.incr.mockReturnValue(mockPipeline);
    mockPipeline.pexpire.mockReturnValue(mockPipeline);
    mockPipeline.pttl.mockReturnValue(mockPipeline);
    mockRedisInstance.multi.mockReturnValue(mockPipeline);
    mockRedisInstance.quit.mockResolvedValue('OK');
  });

  it('constructs with default options', () => {
    const limiter = new RedisRateLimiter();
    expect(limiter).toBeDefined();
  });

  it('constructs with custom options', () => {
    const limiter = new RedisRateLimiter({ prefix: 'rl:', url: 'redis://custom:6380' });
    expect(limiter).toBeDefined();
  });

  describe('connect()', () => {
    it('creates redis client', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
    });
  });

  describe('disconnect()', () => {
    it('quits client', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      await limiter.disconnect();
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('handles disconnect when not connected', async () => {
      const limiter = new RedisRateLimiter();
      await expect(limiter.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('check()', () => {
    it('throws when not connected', async () => {
      const limiter = new RedisRateLimiter();
      await expect(limiter.check('user:1', rule)).rejects.toThrow('not connected');
    });

    it('returns allowed when count below max', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockRedisInstance.get.mockResolvedValue('5');
      mockRedisInstance.pttl.mockResolvedValue(30000);

      const result = await limiter.check('user:1', rule);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('ds:rl:user:1');
    });

    it('returns not allowed when count at or above max', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockRedisInstance.get.mockResolvedValue('10');
      mockRedisInstance.pttl.mockResolvedValue(30000);

      const result = await limiter.check('user:1', rule);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('uses windowMs as resetAt when pttl is non-positive', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.pttl.mockResolvedValue(-1);

      const before = Date.now();
      const result = await limiter.check('user:1', rule);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.resetAt).toBeGreaterThanOrEqual(before + rule.windowMs);
    });

    it('uses custom prefix', async () => {
      const limiter = new RedisRateLimiter({ prefix: 'custom:' });
      await limiter.connect();
      mockRedisInstance.get.mockResolvedValue('0');
      mockRedisInstance.pttl.mockResolvedValue(5000);

      await limiter.check('k', rule);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('custom:k');
    });
  });

  describe('consume()', () => {
    it('throws when not connected', async () => {
      const limiter = new RedisRateLimiter();
      await expect(limiter.consume('user:1', rule)).rejects.toThrow('not connected');
    });

    it('returns allowed result when under limit', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockPipeline.exec.mockResolvedValue([
        [null, 3], // incr (cost=1)
        [null, 1], // pexpire
        [null, 55000], // pttl
      ]);

      const result = await limiter.consume('user:1', rule);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(7);
      expect(result.retryAfter).toBeUndefined();
      expect(mockPipeline.incr).toHaveBeenCalledWith('ds:rl:user:1');
      expect(mockPipeline.pexpire).toHaveBeenCalledWith('ds:rl:user:1', 60000);
    });

    it('returns denied result when over limit', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockPipeline.exec.mockResolvedValue([
        [null, 11], // incr
        [null, 1], // pexpire
        [null, 55000], // pttl
      ]);

      const result = await limiter.consume('user:1', rule);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('handles cost > 1', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockPipeline.exec.mockResolvedValue([
        [null, 1], // incr 1
        [null, 2], // incr 2
        [null, 3], // incr 3 (cost-1 = index 2)
        [null, 1], // pexpire
        [null, 50000], // pttl (index cost+1 = 4)
      ]);

      const result = await limiter.consume('user:1', rule, 3);
      expect(result.allowed).toBe(true);
      expect(mockPipeline.incr).toHaveBeenCalledTimes(3);
    });

    it('throws on pipeline error', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockPipeline.exec.mockResolvedValue([[new Error('REDIS_ERR'), null]]);

      await expect(limiter.consume('user:1', rule)).rejects.toThrow('transaction failed');
    });

    it('throws on null pipeline results', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockPipeline.exec.mockResolvedValue(null);

      await expect(limiter.consume('user:1', rule)).rejects.toThrow('transaction failed');
    });

    it('uses windowMs when pttl is non-positive', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, -1],
      ]);

      const before = Date.now();
      const result = await limiter.consume('user:1', rule);
      expect(result.resetAt).toBeGreaterThanOrEqual(before + rule.windowMs);
    });
  });

  describe('reset()', () => {
    it('throws when not connected', async () => {
      const limiter = new RedisRateLimiter();
      await expect(limiter.reset('user:1')).rejects.toThrow('not connected');
    });

    it('deletes the rate limit key', async () => {
      const limiter = new RedisRateLimiter();
      await limiter.connect();
      mockRedisInstance.del.mockResolvedValue(1);
      await limiter.reset('user:1');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('ds:rl:user:1');
    });
  });
});

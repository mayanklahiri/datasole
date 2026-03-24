import { describe, it, expect, vi } from 'vitest';

import { MemoryRateLimiter } from '../../../../src/server/rate-limit';

describe('MemoryRateLimiter', () => {
  it('allows requests within limit', async () => {
    const limiter = new MemoryRateLimiter();
    const result = await limiter.consume('user-1', { windowMs: 60000, maxRequests: 10 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    limiter.destroy();
  });

  it('rejects requests over limit', async () => {
    const limiter = new MemoryRateLimiter();
    const rule = { windowMs: 60000, maxRequests: 2 };
    await limiter.consume('user-1', rule);
    await limiter.consume('user-1', rule);
    const result = await limiter.consume('user-1', rule);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    limiter.destroy();
  });

  it('resets counters', async () => {
    const limiter = new MemoryRateLimiter();
    const rule = { windowMs: 60000, maxRequests: 1 };
    await limiter.consume('user-1', rule);
    await limiter.reset('user-1');
    const result = await limiter.consume('user-1', rule);
    expect(result.allowed).toBe(true);
    limiter.destroy();
  });

  it('isolates counters between different keys', async () => {
    const limiter = new MemoryRateLimiter();
    const rule = { windowMs: 60000, maxRequests: 1 };
    await limiter.consume('user-1', rule);
    const result = await limiter.consume('user-2', rule);
    expect(result.allowed).toBe(true);
    limiter.destroy();
  });

  it('window expiry resets the counter', async () => {
    vi.useFakeTimers();
    const limiter = new MemoryRateLimiter();
    const rule = { windowMs: 100, maxRequests: 1 };

    await limiter.consume('user-1', rule);
    const blocked = await limiter.consume('user-1', rule);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(150);

    const afterExpiry = await limiter.consume('user-1', rule);
    expect(afterExpiry.allowed).toBe(true);

    limiter.destroy();
    vi.useRealTimers();
  });
});

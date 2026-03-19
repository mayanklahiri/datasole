import { describe, it, expect } from 'vitest';

import { MemoryRateLimiter } from '../../../../src/server/rate-limit';

describe('MemoryRateLimiter', () => {
  it('should allow requests within limit', async () => {
    const limiter = new MemoryRateLimiter();
    const result = await limiter.consume('user-1', { windowMs: 60000, maxRequests: 10 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    limiter.destroy();
  });

  it('should reject requests over limit', async () => {
    const limiter = new MemoryRateLimiter();
    const rule = { windowMs: 60000, maxRequests: 2 };
    await limiter.consume('user-1', rule);
    await limiter.consume('user-1', rule);
    const result = await limiter.consume('user-1', rule);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    limiter.destroy();
  });

  it('should reset counters', async () => {
    const limiter = new MemoryRateLimiter();
    const rule = { windowMs: 60000, maxRequests: 1 };
    await limiter.consume('user-1', rule);
    await limiter.reset('user-1');
    const result = await limiter.consume('user-1', rule);
    expect(result.allowed).toBe(true);
    limiter.destroy();
  });
});

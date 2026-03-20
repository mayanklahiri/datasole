import { describe, it, expect } from 'vitest';

import { MemoryRateLimiter } from '../../../src/server/rate-limit';

describe('Rate limiter integration', () => {
  it('MemoryRateLimiter enforces limits correctly', async () => {
    const limiter = new MemoryRateLimiter();
    const rule = { windowMs: 60_000, maxRequests: 3 };

    const r1 = await limiter.consume('conn:0x01', rule);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    await limiter.consume('conn:0x01', rule);
    await limiter.consume('conn:0x01', rule);

    const r4 = await limiter.consume('conn:0x01', rule);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfter).toBeGreaterThan(0);
    limiter.destroy();
  });

  it('different keys are independent', async () => {
    const limiter = new MemoryRateLimiter();
    const rule = { windowMs: 60_000, maxRequests: 1 };

    const r1 = await limiter.consume('a:0x01', rule);
    expect(r1.allowed).toBe(true);

    const r2 = await limiter.consume('b:0x01', rule);
    expect(r2.allowed).toBe(true);

    limiter.destroy();
  });

  it('check does not consume', async () => {
    const limiter = new MemoryRateLimiter();
    const rule = { windowMs: 60_000, maxRequests: 1 };

    const c1 = await limiter.check('key', rule);
    expect(c1.allowed).toBe(true);

    const c2 = await limiter.check('key', rule);
    expect(c2.allowed).toBe(true);

    limiter.destroy();
  });
});

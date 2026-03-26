import { describe, it, expect } from 'vitest';

import { MemoryBackend } from '../../../../src/server/backends/memory';
import { DefaultRateLimiter } from '../../../../src/server/primitives/rate-limit/default-limiter';
import type { RateLimitRule } from '../../../../src/server/primitives/rate-limit/types';

describe('DefaultRateLimiter', () => {
  const rule: RateLimitRule = { windowMs: 60_000, maxRequests: 10 };

  it('constructs with a StateBackend', () => {
    const limiter = new DefaultRateLimiter(new MemoryBackend());
    expect(limiter).toBeDefined();
  });

  it('check returns allowed when under limit', async () => {
    const limiter = new DefaultRateLimiter(new MemoryBackend());
    const result = await limiter.check('user:1', rule);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
    await limiter.destroy();
  });

  it('consume decrements remaining', async () => {
    const limiter = new DefaultRateLimiter(new MemoryBackend());
    const r1 = await limiter.consume('user:1', rule);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(9);

    const r2 = await limiter.consume('user:1', rule);
    expect(r2.remaining).toBe(8);
    await limiter.destroy();
  });

  it('consume with cost > 1', async () => {
    const limiter = new DefaultRateLimiter(new MemoryBackend());
    const result = await limiter.consume('user:1', rule, 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(7);
    await limiter.destroy();
  });

  it('returns denied when over limit', async () => {
    const limiter = new DefaultRateLimiter(new MemoryBackend());
    const smallRule: RateLimitRule = { windowMs: 60_000, maxRequests: 2 };
    await limiter.consume('user:1', smallRule);
    await limiter.consume('user:1', smallRule);
    const result = await limiter.consume('user:1', smallRule);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
    await limiter.destroy();
  });

  it('reset clears the counter', async () => {
    const limiter = new DefaultRateLimiter(new MemoryBackend());
    const smallRule: RateLimitRule = { windowMs: 60_000, maxRequests: 1 };
    await limiter.consume('user:1', smallRule);
    await limiter.reset('user:1');
    const result = await limiter.consume('user:1', smallRule);
    expect(result.allowed).toBe(true);
    await limiter.destroy();
  });

  it('destroy cleans up without error', async () => {
    const limiter = new DefaultRateLimiter(new MemoryBackend());
    await expect(limiter.destroy()).resolves.toBeUndefined();
  });
});

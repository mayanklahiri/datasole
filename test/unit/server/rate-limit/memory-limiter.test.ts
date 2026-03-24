import { describe, it, expect, vi } from 'vitest';

import { MemoryBackend } from '../../../../src/server/backends/memory';
import { BackendRateLimiter } from '../../../../src/server/primitives/rate-limit/backend-limiter';

describe('BackendRateLimiter (MemoryBackend)', () => {
  it('allows requests within limit', async () => {
    const limiter = new BackendRateLimiter(new MemoryBackend());
    const result = await limiter.consume('user-1', { windowMs: 60000, maxRequests: 10 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    await limiter.destroy();
  });

  it('rejects requests over limit', async () => {
    const limiter = new BackendRateLimiter(new MemoryBackend());
    const rule = { windowMs: 60000, maxRequests: 2 };
    await limiter.consume('user-1', rule);
    await limiter.consume('user-1', rule);
    const result = await limiter.consume('user-1', rule);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    await limiter.destroy();
  });

  it('resets counters', async () => {
    const limiter = new BackendRateLimiter(new MemoryBackend());
    const rule = { windowMs: 60000, maxRequests: 1 };
    await limiter.consume('user-1', rule);
    await limiter.reset('user-1');
    const result = await limiter.consume('user-1', rule);
    expect(result.allowed).toBe(true);
    await limiter.destroy();
  });

  it('isolates counters between different keys', async () => {
    const limiter = new BackendRateLimiter(new MemoryBackend());
    const rule = { windowMs: 60000, maxRequests: 1 };
    await limiter.consume('user-1', rule);
    const result = await limiter.consume('user-2', rule);
    expect(result.allowed).toBe(true);
    await limiter.destroy();
  });

  it('window expiry resets the counter', async () => {
    vi.useFakeTimers();
    const limiter = new BackendRateLimiter(new MemoryBackend());
    const rule = { windowMs: 100, maxRequests: 1 };

    await limiter.consume('user-1', rule);
    const blocked = await limiter.consume('user-1', rule);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(150);

    const afterExpiry = await limiter.consume('user-1', rule);
    expect(afterExpiry.allowed).toBe(true);

    await limiter.destroy();
    vi.useRealTimers();
  });
});

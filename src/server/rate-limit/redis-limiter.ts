/**
 * Redis-backed rate limiter (placeholder).
 */
import type { RateLimiter, RateLimitResult, RateLimitRule } from './types';

export interface RedisRateLimiterOptions {
  prefix?: string;
}

export class RedisRateLimiter implements RateLimiter {
  constructor(_options?: RedisRateLimiterOptions) {
    // TODO: requires 'ioredis' peer dependency
    // Uses the same Redis connection as the state backend
  }

  async check(_key: string, _rule: RateLimitRule): Promise<RateLimitResult> {
    // TODO: MULTI/EXEC atomic check via Redis
    throw new Error('Not implemented: install ioredis peer dependency');
  }

  async consume(_key: string, _rule: RateLimitRule, _cost?: number): Promise<RateLimitResult> {
    // TODO: atomic INCR + EXPIRE via Redis
    throw new Error('Not implemented');
  }

  async reset(_key: string): Promise<void> {
    // TODO: DEL key in Redis
    throw new Error('Not implemented');
  }
}

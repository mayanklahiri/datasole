/**
 * Redis-backed sliding-window rate limiter using atomic INCR + PEXPIRE.
 */
import type { RateLimiter, RateLimitResult, RateLimitRule } from './types';

export interface RedisRateLimiterOptions {
  prefix?: string;
  url?: string;
}

type RedisClient = {
  get(key: string): Promise<string | null>;
  pttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
  multi(): RedisPipeline;
  quit(): Promise<string>;
};

type RedisPipeline = {
  incr(key: string): RedisPipeline;
  pexpire(key: string, ms: number): RedisPipeline;
  pttl(key: string): RedisPipeline;
  exec(): Promise<[Error | null, unknown][]>;
};

export class RedisRateLimiter implements RateLimiter {
  private client: RedisClient | null = null;
  private readonly prefix: string;
  private readonly url: string;

  constructor(options?: RedisRateLimiterOptions) {
    this.prefix = options?.prefix ?? 'ds:rl:';
    this.url = options?.url ?? 'redis://localhost:6379';
  }

  async connect(): Promise<void> {
    try {
      const mod = await import('ioredis');
      const Redis = (mod.default ?? mod) as unknown as new (url: string) => unknown;
      this.client = new Redis(this.url) as unknown as RedisClient;
    } catch {
      throw new Error(
        'RedisRateLimiter requires the "ioredis" package. Install it: npm install ioredis',
      );
    }
  }

  private ensureConnected(): RedisClient {
    if (!this.client) throw new Error('RedisRateLimiter not connected. Call connect() first.');
    return this.client;
  }

  async check(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const client = this.ensureConnected();
    const fullKey = `${this.prefix}${key}`;
    const count = parseInt((await client.get(fullKey)) ?? '0', 10);
    const ttl = await client.pttl(fullKey);
    const resetAt = Date.now() + (ttl > 0 ? ttl : rule.windowMs);
    return {
      allowed: count < rule.maxRequests,
      remaining: Math.max(0, rule.maxRequests - count),
      resetAt,
    };
  }

  async consume(key: string, rule: RateLimitRule, cost = 1): Promise<RateLimitResult> {
    const client = this.ensureConnected();
    const fullKey = `${this.prefix}${key}`;

    const pipeline = client.multi();
    for (let i = 0; i < cost; i++) pipeline.incr(fullKey);
    pipeline.pexpire(fullKey, rule.windowMs);
    pipeline.pttl(fullKey);
    const results = await pipeline.exec();

    if (!results || results.some((r) => r[0] !== null)) {
      throw new Error('Redis rate limit transaction failed');
    }

    const count = results[cost - 1]![1] as number;
    const ttl = (results[cost + 1]?.[1] ?? 0) as number;
    const resetAt = Date.now() + (ttl > 0 ? ttl : rule.windowMs);
    const allowed = count <= rule.maxRequests;

    return {
      allowed,
      remaining: Math.max(0, rule.maxRequests - count),
      resetAt,
      ...(allowed ? {} : { retryAfter: resetAt - Date.now() }),
    };
  }

  async reset(key: string): Promise<void> {
    const client = this.ensureConnected();
    await client.del(`${this.prefix}${key}`);
  }

  async disconnect(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }
}

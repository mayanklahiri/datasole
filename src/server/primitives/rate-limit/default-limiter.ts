/**
 * Default frame rate limiter backed by StateBackend.
 * With MemoryBackend: local sliding-window limiter.
 * With RedisBackend: distributed across instances.
 */
import type { StateBackend } from '../../backends/types';
import type { RealtimePrimitive } from '../types';

import type { RateLimiter, RateLimitResult, RateLimitRule } from './types';

interface WindowEntry {
  count: number;
  resetAt: number;
}

export class DefaultRateLimiter implements RateLimiter, RealtimePrimitive {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly backend: StateBackend) {
    this.cleanupInterval = setInterval(() => void this.cleanup(), 60_000);
  }

  /** Check current allowance for a key without consuming quota. */
  async check(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const entry = await this.getOrCreate(key, rule);
    return {
      allowed: entry.count < rule.maxRequests,
      remaining: Math.max(0, rule.maxRequests - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /** Consume quota for a key and return updated allowance metadata. */
  async consume(key: string, rule: RateLimitRule, cost = 1): Promise<RateLimitResult> {
    const entry = await this.getOrCreate(key, rule);
    entry.count += cost;
    await this.backend.set(`rl:${key}`, entry);
    const allowed = entry.count <= rule.maxRequests;
    return {
      allowed,
      remaining: Math.max(0, rule.maxRequests - entry.count),
      resetAt: entry.resetAt,
      ...(allowed ? {} : { retryAfter: entry.resetAt - Date.now() }),
    };
  }

  /** Reset all quota accounting for one key. */
  async reset(key: string): Promise<void> {
    await this.backend.delete(`rl:${key}`);
  }

  /** Stop cleanup timer. */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private async getOrCreate(key: string, rule: RateLimitRule): Promise<WindowEntry> {
    const now = Date.now();
    const entry = await this.backend.get<WindowEntry>(`rl:${key}`);
    if (!entry || now >= entry.resetAt) {
      const fresh = { count: 0, resetAt: now + rule.windowMs };
      await this.backend.set(`rl:${key}`, fresh);
      return fresh;
    }
    return entry;
  }

  private async cleanup(): Promise<void> {
    // For MemoryBackend, stale windows are cleaned up naturally when getOrCreate
    // sees an expired entry. For Redis/Postgres, TTL-based cleanup is preferred.
  }
}

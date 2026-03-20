/**
 * In-memory sliding-window rate limiter with periodic cleanup of expired windows.
 */
import type { RateLimiter, RateLimitResult, RateLimitRule } from './types';

interface WindowEntry {
  count: number;
  resetAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private windows = new Map<string, WindowEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  async check(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const entry = this.getOrCreate(key, rule);
    return {
      allowed: entry.count < rule.maxRequests,
      remaining: Math.max(0, rule.maxRequests - entry.count),
      resetAt: entry.resetAt,
    };
  }

  async consume(key: string, rule: RateLimitRule, cost = 1): Promise<RateLimitResult> {
    const entry = this.getOrCreate(key, rule);
    entry.count += cost;
    const allowed = entry.count <= rule.maxRequests;
    return {
      allowed,
      remaining: Math.max(0, rule.maxRequests - entry.count),
      resetAt: entry.resetAt,
      ...(allowed ? {} : { retryAfter: entry.resetAt - Date.now() }),
    };
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.windows.clear();
  }

  private getOrCreate(key: string, rule: RateLimitRule): WindowEntry {
    const now = Date.now();
    let entry = this.windows.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + rule.windowMs };
      this.windows.set(key, entry);
    }
    return entry;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) {
        this.windows.delete(key);
      }
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimiter {
  check(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
  consume(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

export interface RateLimitConfig {
  defaultRule: RateLimitRule;
  rules?: Record<string, RateLimitRule>;
  keyExtractor?: (connectionId: string, method?: string) => string;
}

export const DEFAULT_RATE_LIMIT_RULE: RateLimitRule = {
  windowMs: 60_000,
  maxRequests: 100,
};

/**
 * Pipeline interceptor: enforces per-connection frame rate limits.
 * Sends an ERROR frame back when quota is exceeded.
 */
import { compress, decompress, deserialize, isCompressed, serialize } from '../../shared/codec';
import { COMPRESSION_THRESHOLD } from '../../shared/constants';
import { decodeFrame, encodeFrame, Opcode } from '../../shared/protocol';
import type { MetricsCollector } from '../metrics';
import type { RateLimiter, RateLimitConfig, RateLimitRule } from '../primitives/rate-limit/types';
import { DEFAULT_RATE_LIMIT_RULE } from '../primitives/rate-limit/types';
import type { Connection } from '../transport/connection';

import type { FrameInterceptor } from './types';

export interface RateLimitInterceptorDeps {
  rateLimiter: RateLimiter;
  rateLimitConfig: RateLimitConfig;
  getConnection: (connectionId: string) => Connection | undefined;
  metrics: MetricsCollector;
}

export function createRateLimitInterceptor(deps: RateLimitInterceptorDeps): FrameInterceptor {
  return async (ctx, next) => {
    const rule = getRateLimitRule(ctx.raw, deps.rateLimitConfig);
    const key = getRateLimitKey(ctx.connectionId, ctx.raw, deps.rateLimitConfig);
    const result = await deps.rateLimiter.consume(key, rule);
    if (!result.allowed) {
      const conn = deps.getConnection(ctx.connectionId);
      if (conn) {
        let correlationId = 0;
        try {
          const data = isCompressed(ctx.raw) ? decompress(ctx.raw) : ctx.raw;
          const frame = decodeFrame(data);
          correlationId = frame.correlationId;
        } catch {
          // Can't decode — use default correlationId
        }
        const payload = serialize({
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        });
        let frameData = encodeFrame({ opcode: Opcode.ERROR, correlationId, payload });
        if (frameData.length > COMPRESSION_THRESHOLD) {
          frameData = compress(frameData);
        }
        void conn.send(frameData).catch(() => {});
        deps.metrics.increment('messagesOut');
      }
      return;
    }
    await next();
  };
}

function getRateLimitKey(connectionId: string, raw: Uint8Array, config: RateLimitConfig): string {
  if (config.keyExtractor) {
    let method: string | undefined;
    try {
      const data = isCompressed(raw) ? decompress(raw) : raw;
      const frame = decodeFrame(data);
      if (frame.opcode === Opcode.RPC_REQ) {
        const req = deserialize<{ method?: string }>(frame.payload);
        method = req.method;
      }
    } catch {
      // Ignore decode errors for rate limit key
    }
    return config.keyExtractor(connectionId, method);
  }
  return `${connectionId}:frame`;
}

function getRateLimitRule(raw: Uint8Array, config: RateLimitConfig): RateLimitRule {
  if (config.rules) {
    try {
      const data = isCompressed(raw) ? decompress(raw) : raw;
      const frame = decodeFrame(data);
      if (frame.opcode === Opcode.RPC_REQ) {
        const req = deserialize<{ method?: string }>(frame.payload);
        if (req.method && config.rules[req.method]) {
          return config.rules[req.method]!;
        }
      }
    } catch {
      // Ignore decode errors
    }
  }
  return config.defaultRule ?? DEFAULT_RATE_LIMIT_RULE;
}

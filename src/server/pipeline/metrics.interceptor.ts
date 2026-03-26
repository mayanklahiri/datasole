/**
 * Pipeline interceptor: increments the messagesIn counter for every inbound frame.
 */
import type { MetricsCollector } from '../metrics';

import type { FrameInterceptor } from './types';

export function createMetricsInterceptor(metrics: MetricsCollector): FrameInterceptor {
  return async (ctx, next) => {
    metrics.increment('messagesIn');
    metrics.increment('bytesIn', ctx.raw.byteLength);
    await next();
  };
}

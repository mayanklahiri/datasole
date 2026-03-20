/**
 * Creates concurrency strategy instances from ConcurrencyOptions (async, thread, thread-pool, or process).
 */
import { AsyncStrategy } from './async-strategy';
import { ProcessStrategy } from './process-strategy';
import { ThreadPoolStrategy } from './thread-pool-strategy';
import { ThreadStrategy } from './thread-strategy';
import type { ConcurrencyOptions, ConcurrencyStrategy } from './types';
import { DEFAULT_CONCURRENCY_OPTIONS } from './types';

export function createConcurrencyStrategy(
  options?: Partial<ConcurrencyOptions>,
): ConcurrencyStrategy {
  const opts = { ...DEFAULT_CONCURRENCY_OPTIONS, ...options };

  switch (opts.model) {
    case 'async':
      return new AsyncStrategy(opts);
    case 'thread':
      return new ThreadStrategy(opts);
    case 'thread-pool':
      return new ThreadPoolStrategy(opts);
    case 'process':
      return new ProcessStrategy(opts);
    default:
      throw new Error(`Unknown concurrency model: ${opts.model}`);
  }
}

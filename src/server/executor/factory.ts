/**
 * Factory for creating ConnectionExecutor instances from options.
 */
import { AsyncExecutor } from './async-executor';
import { PoolExecutor } from './pool-executor';
import { ProcessExecutor } from './process-executor';
import { ThreadExecutor } from './thread-executor';
import type { ConnectionExecutor, ExecutorOptions } from './types';
import { DEFAULT_EXECUTOR_OPTIONS } from './types';

export function createExecutor(options?: Partial<ExecutorOptions>): ConnectionExecutor {
  const opts = { ...DEFAULT_EXECUTOR_OPTIONS, ...options };

  switch (opts.model) {
    case 'async':
      return new AsyncExecutor();
    case 'thread':
      return new ThreadExecutor(opts);
    case 'thread-pool':
      return new PoolExecutor(opts);
    case 'process':
      return new ProcessExecutor(opts);
    default:
      throw new Error(`Unknown executor model: ${String(opts.model)}`);
  }
}

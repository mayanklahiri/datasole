/**
 * Pool executor: fixed thread pool with least-connections assignment.
 *
 * Until `worker_threads`-backed isolation lands, delegates to {@link AsyncExecutor}
 * so RPC/events/state stay functional.
 */
import { DelegatingExecutor } from './delegating-executor';
import type { ExecutorOptions } from './types';

export class PoolExecutor extends DelegatingExecutor {
  constructor(_options: Partial<ExecutorOptions> = {}) {
    super('thread-pool');
  }
}

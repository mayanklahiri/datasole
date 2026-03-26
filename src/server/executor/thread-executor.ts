/**
 * Thread executor: intended for one `worker_threads` worker per connection.
 *
 * Until worker-thread isolation ships, delegates to {@link AsyncExecutor}
 * so the protocol stack remains fully operational.
 */
import { DelegatingExecutor } from './delegating-executor';
import type { ExecutorOptions } from './types';

export class ThreadExecutor extends DelegatingExecutor {
  constructor(_options: Partial<ExecutorOptions> = {}) {
    super('thread');
  }
}

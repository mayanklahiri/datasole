/**
 * Thread executor: intended for one `worker_threads` worker per connection.
 *
 * Until that isolation ships, frame routing delegates to {@link AsyncExecutor}
 * so the protocol stack remains fully operational.
 */
import type { Connection } from '../transport/connection';

import { AsyncExecutor } from './async-executor';
import type { FrameRouter } from './frame-router';
import type { ConnectionExecutor, ConnectionMeta, ExecutorSend, ExecutorOptions } from './types';

export class ThreadExecutor implements ConnectionExecutor {
  readonly model = 'thread' as const;
  private readonly delegate = new AsyncExecutor();

  constructor(_options: Partial<ExecutorOptions> = {}) {}

  get router(): FrameRouter {
    return this.delegate.router;
  }

  init(send: ExecutorSend): void {
    this.delegate.init(send);
  }

  addConnection(connectionId: string, meta: ConnectionMeta): void {
    this.delegate.addConnection(connectionId, meta);
  }

  dispatch(connectionId: string, compressedFrame: Uint8Array): void {
    this.delegate.dispatch(connectionId, compressedFrame);
  }

  setConnection(connectionId: string, conn: Connection): void {
    this.delegate.setConnection(connectionId, conn);
  }

  removeConnection(connectionId: string): void {
    this.delegate.removeConnection(connectionId);
  }

  async shutdown(): Promise<void> {
    await this.delegate.shutdown();
  }
}

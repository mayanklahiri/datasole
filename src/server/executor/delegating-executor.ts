/**
 * Base executor that delegates all operations to an {@link AsyncExecutor}.
 * Used by {@link ThreadExecutor} and {@link PoolExecutor} until real
 * worker_threads isolation is implemented.
 */
import type { FrameRouter } from '../protocol/frame-router';
import type { Connection } from '../transport/connection';

import { AsyncExecutor } from './async-executor';
import type { ConnectionExecutor, ConnectionMeta, ExecutorModel, ExecutorSend } from './types';

export class DelegatingExecutor implements ConnectionExecutor {
  private readonly delegate = new AsyncExecutor();

  constructor(readonly model: ExecutorModel) {}

  get router(): FrameRouter {
    return this.delegate.router;
  }

  init(send: ExecutorSend): void {
    this.delegate.init(send);
  }

  setConnection(connectionId: string, conn: Connection): void {
    this.delegate.setConnection(connectionId, conn);
  }

  addConnection(connectionId: string, meta: ConnectionMeta): void {
    this.delegate.addConnection(connectionId, meta);
  }

  dispatch(connectionId: string, compressedFrame: Uint8Array): void {
    this.delegate.dispatch(connectionId, compressedFrame);
  }

  removeConnection(connectionId: string): void {
    this.delegate.removeConnection(connectionId);
  }

  async shutdown(): Promise<void> {
    await this.delegate.shutdown();
  }
}

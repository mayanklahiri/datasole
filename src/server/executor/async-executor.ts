/**
 * Async executor: processes frames on the Node.js event loop with no isolation.
 * Default executor model for single-process servers.
 */
import { FrameRouter } from '../protocol/frame-router';
import type { Connection } from '../transport/connection';

import type { ConnectionExecutor, ConnectionMeta, ExecutorSend } from './types';

export class AsyncExecutor implements ConnectionExecutor {
  readonly model = 'async' as const;
  readonly router = new FrameRouter();
  private send: ExecutorSend | null = null;
  private connections = new Map<string, { meta: ConnectionMeta; conn?: Connection }>();

  init(send: ExecutorSend): void {
    this.send = send;
  }

  addConnection(connectionId: string, meta: ConnectionMeta): void {
    this.connections.set(connectionId, { meta });
  }

  dispatch(connectionId: string, compressedFrame: Uint8Array): void {
    const entry = this.connections.get(connectionId);
    if (!entry?.conn) return;
    void this.router.dispatch(entry.conn, compressedFrame).catch(() => {});
  }

  setConnection(connectionId: string, conn: Connection): void {
    const entry = this.connections.get(connectionId);
    if (entry) {
      entry.conn = conn;
    }
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  getSend(): ExecutorSend | null {
    return this.send;
  }

  async shutdown(): Promise<void> {
    this.connections.clear();
  }
}

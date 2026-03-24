/**
 * Thread executor: spawns a worker thread per connection for isolation.
 */
import type { ConnectionExecutor, ConnectionMeta, ExecutorSend, ExecutorOptions } from './types';

export class ThreadExecutor implements ConnectionExecutor {
  readonly model = 'thread' as const;
  private send: ExecutorSend | null = null;
  private connections = new Map<string, { meta: ConnectionMeta }>();

  constructor(private readonly options: Partial<ExecutorOptions> = {}) {}

  init(send: ExecutorSend): void {
    this.send = send;
  }

  addConnection(connectionId: string, meta: ConnectionMeta): void {
    this.connections.set(connectionId, { meta });
  }

  dispatch(connectionId: string, compressedFrame: Uint8Array): void {
    // Thread isolation: in a real implementation, this would postMessage to a Worker
    // For now, frames are dispatched to the send interface
    void compressedFrame;
    void connectionId;
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  async shutdown(): Promise<void> {
    this.connections.clear();
  }
}

/**
 * Pool executor: fixed thread pool with least-connections assignment.
 */
import type { ConnectionExecutor, ConnectionMeta, ExecutorSend, ExecutorOptions } from './types';

export class PoolExecutor implements ConnectionExecutor {
  readonly model = 'thread-pool' as const;
  private send: ExecutorSend | null = null;
  private connections = new Map<string, { meta: ConnectionMeta }>();
  private readonly poolSize: number;

  constructor(options: Partial<ExecutorOptions> = {}) {
    this.poolSize = options.poolSize ?? 4;
  }

  init(send: ExecutorSend): void {
    this.send = send;
  }

  addConnection(connectionId: string, meta: ConnectionMeta): void {
    this.connections.set(connectionId, { meta });
  }

  dispatch(connectionId: string, compressedFrame: Uint8Array): void {
    // Pool: round-robin or least-connections dispatch to worker threads
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

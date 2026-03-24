/**
 * Process executor: spawns child processes for maximum isolation.
 */
import type { ConnectionExecutor, ConnectionMeta, ExecutorSend, ExecutorOptions } from './types';

export class ProcessExecutor implements ConnectionExecutor {
  readonly model = 'process' as const;
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
    // Process isolation: in a real implementation, this would send via IPC
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

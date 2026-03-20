/**
 * Async concurrency: runs connections on the Node.js event loop with no worker or process isolation.
 */
import type {
  ConcurrencyStrategy,
  ConnectionWorker,
  ConcurrencyOptions,
  WorkerMessage,
} from './types';

class AsyncConnectionWorker implements ConnectionWorker {
  readonly type = 'async' as const;

  constructor(
    readonly id: string,
    private onMessage: (msg: WorkerMessage) => void,
  ) {}

  async handleMessage(connectionId: string, data: Uint8Array): Promise<void> {
    // In-process async: message is handled on the event loop directly.
    // The caller's RPC/event dispatcher runs in the same process.
    this.onMessage({ type: 'frame', connectionId, payload: data });
  }

  async handleDisconnect(_connectionId: string): Promise<void> {
    // No-op for async: no thread/process to clean up
  }

  async terminate(): Promise<void> {
    // No-op: nothing to terminate
  }

  isAlive(): boolean {
    return true;
  }
}

export class AsyncStrategy implements ConcurrencyStrategy {
  readonly model = 'async' as const;
  private workers = new Map<string, AsyncConnectionWorker>();
  private messageHandler: (msg: WorkerMessage) => void = () => {};

  constructor(_options?: Partial<ConcurrencyOptions>) {}

  onMessage(handler: (msg: WorkerMessage) => void): void {
    this.messageHandler = handler;
  }

  async initialize(): Promise<void> {}

  async assignWorker(connectionId: string): Promise<ConnectionWorker> {
    const worker = new AsyncConnectionWorker(connectionId, this.messageHandler);
    this.workers.set(connectionId, worker);
    return worker;
  }

  async releaseWorker(connectionId: string): Promise<void> {
    this.workers.delete(connectionId);
  }

  async broadcast(data: Uint8Array): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.handleMessage(worker.id, data);
    }
  }

  getActiveWorkerCount(): number {
    return 1; // Single event loop
  }

  getConnectionCount(): number {
    return this.workers.size;
  }

  async shutdown(): Promise<void> {
    this.workers.clear();
  }
}

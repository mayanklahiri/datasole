/**
 * Thread concurrency: spawns a worker_thread per connection.
 */
import type { ConcurrencyStrategy, ConnectionWorker, ConcurrencyOptions } from './types';

class ThreadConnectionWorker implements ConnectionWorker {
  readonly type = 'thread' as const;
  private alive = true;

  constructor(readonly id: string) {
    // TODO: spawn a new worker_thread for this connection
    // The worker thread runs the connection handler in isolation
  }

  async handleMessage(_connectionId: string, _data: Uint8Array): Promise<void> {
    // TODO: postMessage to worker_thread
    throw new Error('Not implemented');
  }

  async handleDisconnect(_connectionId: string): Promise<void> {
    await this.terminate();
  }

  async terminate(): Promise<void> {
    // TODO: terminate worker_thread
    this.alive = false;
  }

  isAlive(): boolean {
    return this.alive;
  }
}

export class ThreadStrategy implements ConcurrencyStrategy {
  readonly model = 'thread' as const;
  private workers = new Map<string, ThreadConnectionWorker>();
  private maxThreads: number;

  constructor(options?: Partial<ConcurrencyOptions>) {
    this.maxThreads = options?.maxThreads ?? 16;
  }

  async initialize(): Promise<void> {}

  async assignWorker(connectionId: string): Promise<ConnectionWorker> {
    if (this.workers.size >= this.maxThreads) {
      throw new Error(`Thread limit reached (${this.maxThreads})`);
    }
    const worker = new ThreadConnectionWorker(connectionId);
    this.workers.set(connectionId, worker);
    return worker;
  }

  async releaseWorker(connectionId: string): Promise<void> {
    const worker = this.workers.get(connectionId);
    if (worker) {
      await worker.terminate();
      this.workers.delete(connectionId);
    }
  }

  async broadcast(_data: Uint8Array): Promise<void> {
    // TODO: send to all worker_threads
    throw new Error('Not implemented');
  }

  getActiveWorkerCount(): number {
    return this.workers.size;
  }

  getConnectionCount(): number {
    return this.workers.size;
  }

  async shutdown(): Promise<void> {
    const terminations = [...this.workers.values()].map((w) => w.terminate());
    await Promise.all(terminations);
    this.workers.clear();
  }
}

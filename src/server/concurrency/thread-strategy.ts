/**
 * Thread concurrency: spawns a worker_thread per connection.
 */
import { Worker } from 'worker_threads';

import type {
  ConcurrencyStrategy,
  ConnectionWorker,
  ConcurrencyOptions,
  WorkerMessage,
} from './types';

const WORKER_SCRIPT = `
const { parentPort } = require('worker_threads');
parentPort.on('message', (msg) => {
  parentPort.postMessage({ type: 'frame', connectionId: msg.connectionId, payload: msg.data });
});
`;

class ThreadConnectionWorker implements ConnectionWorker {
  readonly type = 'thread' as const;
  private worker: Worker;
  private alive = true;

  constructor(
    readonly id: string,
    onMessage: (msg: WorkerMessage) => void,
  ) {
    this.worker = new Worker(WORKER_SCRIPT, { eval: true });
    this.worker.on('message', (msg: WorkerMessage) => {
      onMessage(msg);
    });
    this.worker.on('error', () => {
      this.alive = false;
    });
    this.worker.on('exit', () => {
      this.alive = false;
    });
  }

  async handleMessage(connectionId: string, data: Uint8Array): Promise<void> {
    if (!this.alive) throw new Error('Worker terminated');
    this.worker.postMessage({ connectionId, data: Buffer.from(data) });
  }

  async handleDisconnect(_connectionId: string): Promise<void> {
    await this.terminate();
  }

  async terminate(): Promise<void> {
    if (!this.alive) return;
    this.alive = false;
    await this.worker.terminate();
  }

  isAlive(): boolean {
    return this.alive;
  }
}

export class ThreadStrategy implements ConcurrencyStrategy {
  readonly model = 'thread' as const;
  private workers = new Map<string, ThreadConnectionWorker>();
  private maxThreads: number;
  private messageHandler: (msg: WorkerMessage) => void = () => {};

  constructor(options?: Partial<ConcurrencyOptions>) {
    this.maxThreads = options?.maxThreads ?? 16;
  }

  onMessage(handler: (msg: WorkerMessage) => void): void {
    this.messageHandler = handler;
  }

  async initialize(): Promise<void> {}

  async assignWorker(connectionId: string): Promise<ConnectionWorker> {
    if (this.workers.size >= this.maxThreads) {
      throw new Error(`Thread limit reached (${this.maxThreads})`);
    }
    const worker = new ThreadConnectionWorker(connectionId, this.messageHandler);
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

  async broadcast(data: Uint8Array): Promise<void> {
    const sends = [...this.workers.entries()].map(([id, worker]) => worker.handleMessage(id, data));
    await Promise.all(sends);
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

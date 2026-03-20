/**
 * Thread pool concurrency: fixed pool of workers with least-connections assignment.
 */
import { Worker } from 'worker_threads';

import type {
  ConcurrencyStrategy,
  ConnectionWorker,
  ConcurrencyOptions,
  WorkerMessage,
} from './types';

const POOL_WORKER_SCRIPT = `
const { parentPort } = require('worker_threads');
parentPort.on('message', (msg) => {
  parentPort.postMessage({ type: 'frame', connectionId: msg.connectionId, payload: msg.data });
});
`;

class PooledWorker {
  readonly id: string;
  private connections = new Set<string>();
  private worker: Worker;
  private alive = true;

  constructor(id: string, onMessage: (msg: WorkerMessage) => void) {
    this.id = id;
    this.worker = new Worker(POOL_WORKER_SCRIPT, { eval: true });
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

  get connectionCount(): number {
    return this.connections.size;
  }

  addConnection(connectionId: string): void {
    this.connections.add(connectionId);
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  hasConnection(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  postMessage(msg: { connectionId: string; data: Buffer }): void {
    if (!this.alive) throw new Error('Pool worker terminated');
    this.worker.postMessage(msg);
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

class PooledConnectionWorker implements ConnectionWorker {
  readonly type = 'thread-pool' as const;

  constructor(
    readonly id: string,
    private pooledWorker: PooledWorker,
  ) {}

  async handleMessage(connectionId: string, data: Uint8Array): Promise<void> {
    this.pooledWorker.postMessage({ connectionId, data: Buffer.from(data) });
  }

  async handleDisconnect(connectionId: string): Promise<void> {
    this.pooledWorker.removeConnection(connectionId);
  }

  async terminate(): Promise<void> {
    this.pooledWorker.removeConnection(this.id);
  }

  isAlive(): boolean {
    return this.pooledWorker.isAlive();
  }
}

export class ThreadPoolStrategy implements ConcurrencyStrategy {
  readonly model = 'thread-pool' as const;
  private pool: PooledWorker[] = [];
  private connectionMap = new Map<string, PooledConnectionWorker>();
  private poolSize: number;
  private messageHandler: (msg: WorkerMessage) => void = () => {};

  constructor(options?: Partial<ConcurrencyOptions>) {
    this.poolSize = options?.poolSize ?? 4;
  }

  onMessage(handler: (msg: WorkerMessage) => void): void {
    this.messageHandler = handler;
  }

  async initialize(): Promise<void> {
    for (let i = 0; i < this.poolSize; i++) {
      this.pool.push(new PooledWorker(`pool-${i}`, this.messageHandler));
    }
  }

  async assignWorker(connectionId: string): Promise<ConnectionWorker> {
    const target = this.pool.reduce((min, w) =>
      w.connectionCount < min.connectionCount ? w : min,
    );
    target.addConnection(connectionId);
    const worker = new PooledConnectionWorker(connectionId, target);
    this.connectionMap.set(connectionId, worker);
    return worker;
  }

  async releaseWorker(connectionId: string): Promise<void> {
    const worker = this.connectionMap.get(connectionId);
    if (worker) {
      await worker.handleDisconnect(connectionId);
      this.connectionMap.delete(connectionId);
    }
  }

  async broadcast(data: Uint8Array): Promise<void> {
    const buf = Buffer.from(data);
    for (const [connId] of this.connectionMap) {
      const worker = this.connectionMap.get(connId);
      if (worker) {
        await worker.handleMessage(connId, buf);
      }
    }
  }

  getActiveWorkerCount(): number {
    return this.pool.filter((w) => w.connectionCount > 0).length;
  }

  getConnectionCount(): number {
    return this.connectionMap.size;
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.pool.map((w) => w.terminate()));
    this.pool = [];
    this.connectionMap.clear();
  }
}

import type { ConcurrencyStrategy, ConnectionWorker, ConcurrencyOptions } from './types';

class PooledWorker {
  readonly id: string;
  private connections = new Set<string>();
  private alive = true;

  constructor(id: string) {
    this.id = id;
    // TODO: spawn a long-lived worker_thread
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

  async terminate(): Promise<void> {
    // TODO: terminate the worker_thread
    this.alive = false;
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

  async handleMessage(_connectionId: string, _data: Uint8Array): Promise<void> {
    // TODO: postMessage to the pooled worker_thread
    throw new Error('Not implemented');
  }

  async handleDisconnect(connectionId: string): Promise<void> {
    this.pooledWorker.removeConnection(connectionId);
  }

  async terminate(): Promise<void> {
    // Don't terminate the pool worker, just remove the connection
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

  constructor(options?: Partial<ConcurrencyOptions>) {
    this.poolSize = options?.poolSize ?? 4;
  }

  async initialize(): Promise<void> {
    for (let i = 0; i < this.poolSize; i++) {
      this.pool.push(new PooledWorker(`pool-${i}`));
    }
  }

  async assignWorker(connectionId: string): Promise<ConnectionWorker> {
    // Least-connections assignment
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

  async broadcast(_data: Uint8Array): Promise<void> {
    // TODO: send to all pool workers which fan out to their connections
    throw new Error('Not implemented');
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

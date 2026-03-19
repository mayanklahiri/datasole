import type { ConcurrencyStrategy, ConnectionWorker, ConcurrencyOptions } from './types';

class ProcessConnectionWorker implements ConnectionWorker {
  readonly type = 'process' as const;
  private alive = true;

  constructor(readonly id: string) {
    // TODO: fork a child_process for this connection
    // Serialized packets are forwarded from the master process via IPC
  }

  async handleMessage(_connectionId: string, _data: Uint8Array): Promise<void> {
    // TODO: send serialized packet to child process via IPC
    throw new Error('Not implemented');
  }

  async handleDisconnect(_connectionId: string): Promise<void> {
    await this.terminate();
  }

  async terminate(): Promise<void> {
    // TODO: kill child process
    this.alive = false;
  }

  isAlive(): boolean {
    return this.alive;
  }
}

export class ProcessStrategy implements ConcurrencyStrategy {
  readonly model = 'process' as const;
  private workers = new Map<string, ProcessConnectionWorker>();
  private maxProcesses: number;

  constructor(options?: Partial<ConcurrencyOptions>) {
    this.maxProcesses = options?.maxProcesses ?? 8;
  }

  async initialize(): Promise<void> {}

  async assignWorker(connectionId: string): Promise<ConnectionWorker> {
    if (this.workers.size >= this.maxProcesses) {
      throw new Error(`Process limit reached (${this.maxProcesses})`);
    }
    const worker = new ProcessConnectionWorker(connectionId);
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
    // TODO: IPC broadcast to all child processes
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

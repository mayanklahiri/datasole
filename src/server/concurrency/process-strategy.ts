/**
 * Process concurrency: forks a child process per connection.
 */
import { fork, type ChildProcess } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import type {
  ConcurrencyStrategy,
  ConnectionWorker,
  ConcurrencyOptions,
  WorkerMessage,
} from './types';

const PROCESS_SCRIPT = `
process.on('message', (msg) => {
  process.send({ type: 'frame', connectionId: msg.connectionId, payload: msg.data });
});
`;

let scriptPath: string | null = null;

function getScriptPath(): string {
  if (!scriptPath) {
    scriptPath = join(tmpdir(), `datasole-worker-${process.pid}.cjs`);
    writeFileSync(scriptPath, PROCESS_SCRIPT);
  }
  return scriptPath;
}

function cleanupScriptPath(): void {
  if (scriptPath && existsSync(scriptPath)) {
    try {
      unlinkSync(scriptPath);
    } catch {
      // best-effort cleanup
    }
    scriptPath = null;
  }
}

class ProcessConnectionWorker implements ConnectionWorker {
  readonly type = 'process' as const;
  private child: ChildProcess;
  private alive = true;

  constructor(
    readonly id: string,
    onMessage: (msg: WorkerMessage) => void,
  ) {
    this.child = fork(getScriptPath(), [], { stdio: 'ignore' });
    this.child.on('message', (msg) => {
      onMessage(msg as WorkerMessage);
    });
    this.child.on('error', () => {
      this.alive = false;
    });
    this.child.on('exit', () => {
      this.alive = false;
    });
  }

  async handleMessage(connectionId: string, data: Uint8Array): Promise<void> {
    if (!this.alive) throw new Error('Child process terminated');
    this.child.send({ connectionId, data: Array.from(data) });
  }

  async handleDisconnect(_connectionId: string): Promise<void> {
    await this.terminate();
  }

  async terminate(): Promise<void> {
    if (!this.alive) return;
    this.alive = false;
    this.child.kill();
  }

  isAlive(): boolean {
    return this.alive;
  }
}

export class ProcessStrategy implements ConcurrencyStrategy {
  readonly model = 'process' as const;
  private workers = new Map<string, ProcessConnectionWorker>();
  private maxProcesses: number;
  private messageHandler: (msg: WorkerMessage) => void = () => {};

  constructor(options?: Partial<ConcurrencyOptions>) {
    this.maxProcesses = options?.maxProcesses ?? 8;
  }

  onMessage(handler: (msg: WorkerMessage) => void): void {
    this.messageHandler = handler;
  }

  async initialize(): Promise<void> {}

  async assignWorker(connectionId: string): Promise<ConnectionWorker> {
    if (this.workers.size >= this.maxProcesses) {
      throw new Error(`Process limit reached (${this.maxProcesses})`);
    }
    const worker = new ProcessConnectionWorker(connectionId, this.messageHandler);
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
    cleanupScriptPath();
  }
}

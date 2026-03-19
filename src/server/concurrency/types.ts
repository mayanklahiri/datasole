export type ConcurrencyModel = 'async' | 'thread' | 'thread-pool' | 'process';

export interface ConcurrencyOptions {
  model: ConcurrencyModel;
  poolSize?: number;
  maxThreads?: number;
  maxProcesses?: number;
  workerScript?: string;
  idleTimeout?: number;
}

export interface ConnectionWorker {
  readonly id: string;
  readonly type: ConcurrencyModel;

  handleMessage(connectionId: string, data: Uint8Array): Promise<void>;
  handleDisconnect(connectionId: string): Promise<void>;
  terminate(): Promise<void>;
  isAlive(): boolean;
}

export interface WorkerMessage {
  type: 'frame' | 'rpc_response' | 'event' | 'state_update' | 'error';
  connectionId: string;
  payload: unknown;
}

export interface ConcurrencyStrategy {
  readonly model: ConcurrencyModel;

  initialize(): Promise<void>;
  assignWorker(connectionId: string): Promise<ConnectionWorker>;
  releaseWorker(connectionId: string): Promise<void>;
  broadcast(data: Uint8Array): Promise<void>;
  getActiveWorkerCount(): number;
  getConnectionCount(): number;
  shutdown(): Promise<void>;
}

export const DEFAULT_CONCURRENCY_OPTIONS: ConcurrencyOptions = {
  model: 'thread-pool',
  poolSize: 4,
  maxThreads: 16,
  maxProcesses: 8,
  idleTimeout: 30000,
};

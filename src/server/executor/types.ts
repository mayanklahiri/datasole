/**
 * Executor contracts: models, send interface, and connection executor interface.
 */

export type ExecutorModel = 'async' | 'thread' | 'thread-pool' | 'process';

export interface ConnectionMeta {
  remoteAddress: string;
  auth: { userId?: string; roles?: string[]; metadata?: Record<string, unknown> } | null;
}

export interface ExecutorSend {
  sendRaw(connectionId: string, compressedFrame: Uint8Array): void;
  broadcastRaw(compressedFrame: Uint8Array): void;
}

export interface ConnectionExecutor {
  readonly model: ExecutorModel;
  init(send: ExecutorSend): void;
  addConnection(connectionId: string, meta: ConnectionMeta): void;
  dispatch(connectionId: string, compressedFrame: Uint8Array): void;
  removeConnection(connectionId: string): void;
  shutdown(): Promise<void>;
}

export interface ExecutorOptions {
  model: ExecutorModel;
  poolSize?: number;
  maxThreads?: number;
  maxProcesses?: number;
  workerScript?: string;
  idleTimeout?: number;
}

export const DEFAULT_EXECUTOR_OPTIONS: ExecutorOptions = {
  model: 'async',
  poolSize: 4,
  maxThreads: 16,
  maxProcesses: 8,
  idleTimeout: 30000,
};

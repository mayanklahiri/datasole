/**
 * Executor contracts: models, send interface, and connection executor interface.
 *
 * The executor layer determines how incoming WebSocket frames are processed:
 *
 * - `async` — all frames processed on the Node.js event loop (single-threaded).
 *   Default model. Lowest overhead, best for I/O-bound workloads (chat,
 *   notifications, dashboards).
 *
 * - `thread` — spawns a dedicated `worker_threads` thread per connection.
 *   Best for CPU-bound per-connection work (game logic, computation).
 *   Each thread can initialize its own backend or share the parent's.
 *
 * - `thread-pool` — fixed pool of `worker_threads` with least-connections assignment.
 *   Recommended for production. Balances isolation with resource efficiency.
 *   `poolSize` controls the number of threads (defaults to the number of
 *   available CPU cores).
 */

import { availableParallelism } from 'os';

import type { FrameRouter } from '../protocol/frame-router';
import type { Connection } from '../transport/connection';

/**
 * Available executor concurrency models.
 *
 * - `'async'` — single event loop, no isolation (default)
 * - `'thread'` — worker thread per connection
 * - `'thread-pool'` — fixed-size worker thread pool (recommended for production)
 */
export type ExecutorModel = 'async' | 'thread' | 'thread-pool';

/** Metadata about a connection, forwarded to the executor on connect. */
export interface ConnectionMeta {
  remoteAddress: string;
  auth: { userId?: string; roles?: string[]; metadata?: Record<string, unknown> } | null;
}

/** Raw-byte send interface provided to executors by the transport layer. */
export interface ExecutorSend {
  sendRaw(connectionId: string, compressedFrame: Uint8Array): void;
  broadcastRaw(compressedFrame: Uint8Array): void;
}

/** Lifecycle interface for connection executors. */
export interface ConnectionExecutor {
  readonly model: ExecutorModel;
  readonly router: FrameRouter;
  init(send: ExecutorSend): void;
  setConnection(connectionId: string, conn: Connection): void;
  addConnection(connectionId: string, meta: ConnectionMeta): void;
  dispatch(connectionId: string, compressedFrame: Uint8Array): void;
  removeConnection(connectionId: string): void;
  shutdown(): Promise<void>;
}

/**
 * Configuration for the connection executor.
 *
 * @property model      — Concurrency model. Default: `'async'`.
 * @property poolSize   — Number of threads in the pool (thread-pool model only).
 *                         Default: `os.availableParallelism()` (number of CPU cores).
 * @property maxThreads — Upper bound on threads for the `thread` model.
 *                         Prevents unbounded thread creation under connection spikes.
 *                         Default: `256`.
 * @property workerScript — Path to a JS/TS module loaded inside each worker thread.
 *                          Use this to register RPC handlers and primitives that run
 *                          inside the thread context.
 * @property idleTimeout  — Milliseconds of inactivity before an idle thread is recycled
 *                          (thread and thread-pool models). Default: `30000` (30s).
 */
export interface ExecutorOptions {
  model: ExecutorModel;
  poolSize?: number;
  maxThreads?: number;
  workerScript?: string;
  idleTimeout?: number;
}

export const DEFAULT_EXECUTOR_OPTIONS: ExecutorOptions = {
  model: 'async',
  poolSize: availableParallelism(),
  maxThreads: 256,
  idleTimeout: 30_000,
};

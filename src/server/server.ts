import type { Server as HttpServer } from 'http';

import { DEFAULT_WS_PATH } from '../shared/constants';
import type { CrdtOperation, CrdtState } from '../shared/crdt';
import type { EventHandler, StatePatch } from '../shared/types';

import type { ServerAdapter } from './adapters/types';
import type { ConcurrencyOptions, ConcurrencyStrategy } from './concurrency';
import { createConcurrencyStrategy } from './concurrency';
import { EventBus } from './events';
import { MetricsCollector } from './metrics';
import type { MetricsExporter } from './metrics/types';
import type { RateLimiter, RateLimitConfig } from './rate-limit';
import { MemoryRateLimiter } from './rate-limit';
import { RpcDispatcher } from './rpc';
import type { RpcHandler } from './rpc';
import { MemoryBackend } from './state/backends';
import type { SessionOptions } from './state/session-manager';
import { SessionManager } from './state/session-manager';
import { StateManager } from './state/state-manager';
import type { StateBackend } from './state/types';
import type { SyncChannelConfig } from './sync';
import { SyncChannel } from './sync';
import type { ConnectionContext } from './transport/connection-context';
import type { AuthHandler } from './transport/upgrade-handler';

export interface DatasoleServerOptions {
  path?: string;
  authHandler?: AuthHandler;
  stateBackend?: StateBackend;
  metricsExporter?: MetricsExporter;
  perMessageDeflate?: boolean;
  concurrency?: Partial<ConcurrencyOptions>;
  rateLimiter?: RateLimiter;
  rateLimit?: RateLimitConfig;
  session?: SessionOptions;
}

export class DatasoleServer {
  private readonly stateManager: StateManager;
  private readonly sessionManager: SessionManager;
  private readonly rpcDispatcher: RpcDispatcher;
  private readonly eventBus: EventBus;
  private readonly metrics: MetricsCollector;
  private readonly concurrency: ConcurrencyStrategy;
  private readonly rateLimiter: RateLimiter;
  private readonly syncChannels = new Map<string, SyncChannel>();
  private readonly path: string;
  private readonly authHandler: AuthHandler;

  constructor(options: DatasoleServerOptions = {}) {
    this.path = options.path ?? DEFAULT_WS_PATH;
    this.authHandler = options.authHandler ?? (async () => ({ authenticated: true }));
    const backend = options.stateBackend ?? new MemoryBackend();

    this.stateManager = new StateManager(backend);
    this.sessionManager = new SessionManager(backend, options.session);
    this.rpcDispatcher = new RpcDispatcher();
    this.eventBus = new EventBus();
    this.metrics = new MetricsCollector();
    this.concurrency = createConcurrencyStrategy(options.concurrency);
    this.rateLimiter = options.rateLimiter ?? new MemoryRateLimiter();
  }

  attach(_server: HttpServer, _adapter?: ServerAdapter): void {
    // TODO: attach to HTTP server, start WS server, wire upgrade handler
    // 1. HTTP upgrade → authHandler → create ConnectionContext
    // 2. concurrency.assignWorker(connectionId)
    // 3. Wire frames through concurrency worker
    // 4. Restore session state for reconnecting users
  }

  // --- State (server → client, JSON Patch) ---

  async setState<T = unknown>(key: string, value: T): Promise<StatePatch[]> {
    return this.stateManager.setState(key, value);
  }

  async getState<T = unknown>(key: string): Promise<T | undefined> {
    return this.stateManager.getState<T>(key);
  }

  // --- Sync Channels (configurable flush, direction, mode) ---

  createSyncChannel<T = unknown>(config: SyncChannelConfig<T>): SyncChannel<T> {
    const channel = new SyncChannel(config);
    this.syncChannels.set(config.key, channel as SyncChannel);
    return channel;
  }

  getSyncChannel(key: string): SyncChannel | undefined {
    return this.syncChannels.get(key);
  }

  // --- Session State (per-user, snapshot/restore) ---

  async snapshotSession(ctx: ConnectionContext): Promise<Record<string, unknown>> {
    return this.sessionManager.snapshot(ctx);
  }

  async restoreSession(ctx: ConnectionContext): Promise<Record<string, unknown>> {
    return this.sessionManager.restore(ctx);
  }

  setSessionValue(userId: string, key: string, value: unknown): void {
    this.sessionManager.set(userId, key, value);
  }

  getSessionValue<T = unknown>(userId: string, key: string): T | undefined {
    return this.sessionManager.get<T>(userId, key);
  }

  onSessionChange(handler: (userId: string, key: string, value: unknown, version: number) => void): () => void {
    return this.sessionManager.onChange(handler);
  }

  // --- RPC ---

  rpc<TReq = unknown, TRes = unknown>(method: string, handler: RpcHandler<TReq, TRes>): void {
    this.rpcDispatcher.register(method, handler);
  }

  // --- Events ---

  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.eventBus.on(event, handler);
  }

  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.eventBus.off(event, handler);
  }

  broadcast(event: string, data: unknown): void {
    this.eventBus.emit(event, data);
    // TODO: send to all connected clients via concurrency.broadcast()
  }

  // --- CRDT (bidirectional sync) ---

  applyCrdtOperation(_connectionId: string, _op: CrdtOperation): void {
    // TODO: apply CRDT op from client, merge with server state, broadcast to other clients
  }

  getCrdtState(_key: string): CrdtState | undefined {
    // TODO: return CRDT state for key
    return undefined;
  }

  // --- Metrics ---

  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  getConcurrency(): ConcurrencyStrategy {
    return this.concurrency;
  }

  // --- Lifecycle ---

  async close(): Promise<void> {
    await this.sessionManager.flushAll();
    this.sessionManager.destroy();
    await this.concurrency.shutdown();
    for (const channel of this.syncChannels.values()) {
      channel.destroy();
    }
    this.syncChannels.clear();
  }
}

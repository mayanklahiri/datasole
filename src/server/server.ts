import type { Server as HttpServer } from 'http';

import { compress, decompress, deserialize, serialize } from '../shared/codec';
import { COMPRESSION_THRESHOLD, DEFAULT_WS_PATH } from '../shared/constants';
import type { CrdtOperation, CrdtState } from '../shared/crdt';
import { decodeFrame, encodeFrame, Opcode } from '../shared/protocol';
import type { EventHandler, RpcRequest, StatePatch } from '../shared/types';

import type { ServerAdapter } from './adapters/types';
import type { ConcurrencyOptions, ConcurrencyStrategy } from './concurrency';
import { createConcurrencyStrategy } from './concurrency';
import { EventBus } from './events';
import { MetricsCollector } from './metrics';
import type { MetricsExporter } from './metrics/types';
import type { RateLimiter, RateLimitConfig } from './rate-limit';
import { MemoryRateLimiter } from './rate-limit';
import { RpcDispatcher } from './rpc';
import type { RpcContext, RpcHandler } from './rpc';
import { MemoryBackend } from './state/backends';
import type { SessionOptions } from './state/session-manager';
import { SessionManager } from './state/session-manager';
import { StateManager } from './state/state-manager';
import type { StateBackend } from './state/types';
import type { SyncChannelConfig } from './sync';
import { SyncChannel } from './sync';
import { Connection } from './transport/connection';
import type { ConnectionContext } from './transport/connection-context';
import type { AuthHandler } from './transport/upgrade-handler';
import { WsServer } from './transport/ws-server';

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
  private readonly connections = new Map<string, Connection>();
  private readonly path: string;
  private readonly authHandler: AuthHandler;
  private readonly perMessageDeflate: boolean | undefined;
  private wsServer: WsServer | null = null;

  constructor(options: DatasoleServerOptions = {}) {
    this.path = options.path ?? DEFAULT_WS_PATH;
    this.authHandler = options.authHandler ?? (async () => ({ authenticated: true }));
    this.perMessageDeflate = options.perMessageDeflate;
    const backend = options.stateBackend ?? new MemoryBackend();

    this.stateManager = new StateManager(backend);
    this.sessionManager = new SessionManager(backend, options.session);
    this.rpcDispatcher = new RpcDispatcher();
    this.eventBus = new EventBus();
    this.metrics = new MetricsCollector();
    this.concurrency = createConcurrencyStrategy(options.concurrency);
    this.rateLimiter = options.rateLimiter ?? new MemoryRateLimiter();
  }

  attach(server: HttpServer, _adapter?: ServerAdapter): void {
    this.wsServer = new WsServer();
    this.wsServer.setAuthHandler(this.authHandler);

    this.wsServer.onConnection((ws, info) => {
      const auth = info.auth.authenticated
        ? {
            userId: info.auth.userId ?? info.id,
            roles: info.auth.roles ?? [],
            metadata: info.auth.metadata ?? {},
          }
        : null;

      const conn = new Connection(
        {
          id: info.id,
          remoteAddress: info.remoteAddress,
          connectedAt: Date.now(),
          auth,
        },
        ws,
      );

      this.connections.set(info.id, conn);
      this.metrics.increment('connections');

      conn.onMessage((data) => {
        this.handleIncomingFrame(conn, data);
      });

      conn.onClose(() => {
        this.connections.delete(info.id);
        this.metrics.decrement('connections');
      });
    });

    void this.wsServer.start(
      this.perMessageDeflate === undefined
        ? { server, path: this.path }
        : { server, path: this.path, perMessageDeflate: this.perMessageDeflate },
    );
  }

  private handleIncomingFrame(conn: Connection, raw: Uint8Array): void {
    try {
      const data = raw.length > COMPRESSION_THRESHOLD ? decompress(raw) : raw;
      const frame = decodeFrame(data);
      this.metrics.increment('messagesIn');

      switch (frame.opcode) {
        case Opcode.RPC_REQ: {
          const request = deserialize<RpcRequest>(frame.payload);
          const ctx: RpcContext = {
            auth: conn.info.auth,
            connectionId: conn.info.id,
            connection: conn.context,
          };
          void this.rpcDispatcher.dispatch(request, ctx).then((response) => {
            this.sendToConnection(conn, Opcode.RPC_RES, frame.correlationId, response);
          });
          break;
        }
        case Opcode.EVENT_C2S: {
          const payload = deserialize<{ event: string; data: unknown }>(frame.payload);
          this.eventBus.emit(payload.event, payload.data);
          break;
        }
        case Opcode.PING: {
          this.sendToConnection(conn, Opcode.PONG, frame.correlationId, null);
          break;
        }
      }
    } catch {
      // Malformed frame — ignore
    }
  }

  private sendToConnection(
    conn: Connection,
    opcode: Opcode,
    correlationId: number,
    data: unknown,
  ): void {
    try {
      const payload = serialize(data ?? null);
      let frameData = encodeFrame({ opcode, correlationId, payload });
      if (frameData.length > COMPRESSION_THRESHOLD) {
        frameData = compress(frameData);
      }
      void conn.send(frameData).catch(() => {});
      this.metrics.increment('messagesOut');
    } catch {
      // Send failure — connection may be closing
    }
  }

  private broadcastFrame(opcode: Opcode, data: unknown): void {
    const payload = serialize(data);
    let frameData = encodeFrame({ opcode, correlationId: 0, payload });
    if (frameData.length > COMPRESSION_THRESHOLD) {
      frameData = compress(frameData);
    }
    for (const conn of this.connections.values()) {
      void conn.send(frameData).catch(() => {});
    }
    this.metrics.increment('messagesOut');
  }

  // --- State ---

  async setState<T = unknown>(key: string, value: T): Promise<StatePatch[]> {
    const patches = await this.stateManager.setState(key, value);
    if (patches.length > 0) {
      this.broadcastFrame(Opcode.STATE_PATCH, { key, patches });
    }
    return patches;
  }

  async getState<T = unknown>(key: string): Promise<T | undefined> {
    return this.stateManager.getState<T>(key);
  }

  // --- Sync Channels ---

  createSyncChannel<T = unknown>(config: SyncChannelConfig<T>): SyncChannel<T> {
    const channel = new SyncChannel(config);
    this.syncChannels.set(config.key, channel as SyncChannel);
    return channel;
  }

  getSyncChannel(key: string): SyncChannel | undefined {
    return this.syncChannels.get(key);
  }

  // --- Session State ---

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

  onSessionChange(
    handler: (userId: string, key: string, value: unknown, version: number) => void,
  ): () => void {
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
    this.broadcastFrame(Opcode.EVENT_S2C, { event, data, timestamp: Date.now() });
  }

  // --- CRDT ---

  applyCrdtOperation(_connectionId: string, _op: CrdtOperation): void {
    // TODO: apply CRDT op from client, merge, broadcast
  }

  getCrdtState(_key: string): CrdtState | undefined {
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

  getConnectionCount(): number {
    return this.connections.size;
  }

  // --- Lifecycle ---

  async close(): Promise<void> {
    if (this.wsServer) {
      await this.wsServer.stop();
      this.wsServer = null;
    }
    await this.sessionManager.flushAll();
    this.sessionManager.destroy();
    await this.concurrency.shutdown();
    for (const channel of this.syncChannels.values()) {
      channel.destroy();
    }
    this.syncChannels.clear();
    this.connections.clear();
  }
}

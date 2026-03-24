/**
 * DatasoleServer facade: composes transport, executor, backends, and primitives.
 *
 * Design intent:
 * - keep transport and protocol handling isolated from application logic
 * - expose typed primitives (`rpc`, `events`, `state`, `crdt`) as stable entry points
 * - route all distributed behavior through a single backend abstraction
 */
import type { Server as HttpServer } from 'http';

import { compress, deserialize, serialize } from '../shared/codec';
import { COMPRESSION_THRESHOLD } from '../shared/constants';
import type { DatasoleContract } from '../shared/contract';
import type { CrdtOperation } from '../shared/crdt';
import { encodeFrame, Opcode } from '../shared/protocol';
import type { RpcRequest, StatePatch } from '../shared/types';
import type { DataChannel, LiveStateConfig } from '../shared/types/data-flow';

import type { ServerAdapter } from './adapters/types';
import { MemoryBackend } from './backends/memory';
import type { BackendConfig, StateBackend } from './backends/types';
import { AsyncExecutor } from './executor/async-executor';
import { createExecutor } from './executor/factory';
import type { ConnectionExecutor, ExecutorOptions } from './executor/types';
import { MetricsCollector } from './metrics';
import type { MetricsExporter } from './metrics/types';
import type { AuthHandlerFn } from './primitives/auth/auth-handler';
import { createDefaultAuthHandler } from './primitives/auth/auth-handler';
import { CrdtManager } from './primitives/crdt/crdt-manager';
import type { ChannelManagerDeps } from './primitives/data-flow/channel-manager';
import { ChannelManager } from './primitives/data-flow/channel-manager';
import { EventBus } from './primitives/events/event-bus';
import { BackendRateLimiter } from './primitives/rate-limit/backend-limiter';
import type { RateLimitConfig } from './primitives/rate-limit/types';
import { DEFAULT_RATE_LIMIT_RULE } from './primitives/rate-limit/types';
import type { RpcContext } from './primitives/rpc/rpc-dispatcher';
import { RpcDispatcher } from './primitives/rpc/rpc-dispatcher';
import type { SessionOptions } from './primitives/state/session-manager';
import { SessionManager } from './primitives/state/session-manager';
import { StateManager } from './primitives/state/state-manager';
import { SyncChannel } from './primitives/sync/sync-channel';
import type { SyncChannelConfig } from './primitives/sync/types';
import type { Connection } from './transport/connection';
import { ServerTransport } from './transport/server-transport';

/**
 * Configuration for {@link DatasoleServer}.
 *
 * All properties are optional — sensible defaults are applied for every field.
 * See the [Configuration Reference](https://datasole.dev/server.html#configuration-reference)
 * for exhaustive documentation of each option.
 */
export interface DatasoleServerOptions {
  /**
   * WebSocket endpoint path. Clients connect to `ws://<host><path>`.
   *
   * @default '/__ds'
   */
  path?: string;

  /**
   * Authenticate the HTTP upgrade request before establishing the WebSocket.
   * Return `{ authenticated: true, userId, roles?, metadata? }` to allow,
   * or `{ authenticated: false }` to reject with HTTP 401.
   *
   * If omitted, all connections are allowed (anonymous access).
   *
   * @example
   * ```ts
   * authHandler: async (req) => {
   *   const token = req.headers.authorization?.replace('Bearer ', '');
   *   const user = await verifyJwt(token);
   *   return user
   *     ? { authenticated: true, userId: user.id, roles: user.roles }
   *     : { authenticated: false };
   * }
   * ```
   */
  authHandler?: AuthHandlerFn;

  /**
   * Pluggable key-value + pub/sub backend. Powers state, sessions, events,
   * CRDTs, rate limiting, and sync channels. All primitives share this
   * single backend instance, so swapping it to Redis or Postgres makes
   * the entire server distributed.
   *
   * @default new MemoryBackend()
   *
   * @example
   * ```ts
   * import { RedisBackend } from 'datasole/server';
   * stateBackend: new RedisBackend({ url: 'redis://localhost:6379' })
   * ```
   */
  stateBackend?: StateBackend;

  /**
   * Declarative backend configuration (alternative to `stateBackend`).
   * Useful when the config is loaded from a file or environment variable.
   *
   * @example
   * ```ts
   * backendConfig: { type: 'redis', redis: { url: process.env.REDIS_URL } }
   * ```
   */
  backendConfig?: BackendConfig;

  /**
   * Metrics exporter for Prometheus, OpenTelemetry, or custom sinks.
   * If omitted, metrics are collected in-memory only (accessible via
   * `ds.metrics.snapshot()`).
   *
   * @example
   * ```ts
   * import { PrometheusExporter } from 'datasole/server';
   * metricsExporter: new PrometheusExporter()
   * ```
   */
  metricsExporter?: MetricsExporter;

  /**
   * Enable WebSocket per-message deflate compression at the transport level.
   * This is **in addition to** datasole's own application-level pako compression.
   * Generally leave disabled — the application-level compression is sufficient
   * and avoids the CPU cost of per-message-deflate on high-connection servers.
   *
   * @default false
   */
  perMessageDeflate?: boolean;

  /**
   * Connection executor configuration — controls how incoming frames are
   * dispatched and processed.
   *
   * Available models:
   * - `'async'`       — single event loop, no thread isolation (default)
   * - `'thread'`      — dedicated worker thread per connection
   * - `'thread-pool'` — fixed-size worker thread pool (recommended for production)
   *
   * @default { model: 'async' }
   *
   * @example
   * ```ts
   * executor: { model: 'thread-pool', poolSize: 8 }
   * executor: { model: 'async' }
   * executor: { model: 'thread', maxThreads: 64 }
   * ```
   */
  executor?: Partial<ExecutorOptions>;

  /**
   * Frame-level rate limiting configuration. Rate limits are enforced per
   * connection per sliding window. Uses the configured `StateBackend`,
   * so limits are automatically distributed with Redis or Postgres.
   *
   * @default { defaultRule: { windowMs: 60_000, maxRequests: 100 } }
   *
   * @example
   * ```ts
   * rateLimit: {
   *   defaultRule: { windowMs: 60_000, maxRequests: 200 },
   *   rules: {
   *     'heavy-rpc': { windowMs: 60_000, maxRequests: 10 },
   *     upload:      { windowMs: 60_000, maxRequests: 5 },
   *   },
   *   keyExtractor: (connId, method) => `${connId}:${method}`,
   * }
   * ```
   */
  rateLimit?: RateLimitConfig;

  /**
   * Session persistence tuning. Sessions auto-flush dirty writes to the
   * state backend when either the mutation threshold or interval is reached.
   *
   * @default { flushThreshold: 10, flushIntervalMs: 5000 }
   *
   * @example
   * ```ts
   * session: {
   *   flushThreshold: 5,   // persist after 5 mutations
   *   flushIntervalMs: 2000, // or every 2 seconds
   *   ttlMs: 3_600_000,    // expire sessions after 1 hour
   * }
   * ```
   */
  session?: SessionOptions;

  /**
   * Maximum simultaneous WebSocket connections. New connections beyond this
   * limit are rejected at the transport layer before auth.
   *
   * @default 10_000
   */
  maxConnections?: number;

  /**
   * Maximum number of distinct CRDT keys the server will track.
   * Prevents memory exhaustion from unbounded CRDT registration.
   *
   * @default 1000
   */
  maxCrdtKeys?: number;

  /**
   * Maximum allowed length (in characters) for client-to-server event names.
   * Events with names exceeding this limit are silently dropped.
   *
   * @default 256
   */
  maxEventNameLength?: number;
}

export class DatasoleServer<T extends DatasoleContract> {
  /** Typed RPC registry/dispatcher (`register`, dispatch lifecycle). */
  readonly rpc: RpcDispatcher<T>;
  /** Typed event bus for intra-server and broadcast event flows. */
  readonly events: EventBus<T>;
  /** Typed server-authoritative state manager with diff publishing. */
  readonly state: StateManager<T>;
  /** CRDT primitive manager for bidirectional conflict-free sync. */
  readonly crdt: CrdtManager;
  /** Session persistence/restore manager for reconnect flows. */
  readonly sessions: SessionManager;
  /** Backend-powered frame rate limiter. */
  readonly rateLimiter: BackendRateLimiter;
  /** In-memory metrics collector + exporter bridge. */
  readonly metrics: MetricsCollector;

  private readonly backend: StateBackend;
  private readonly executor: ConnectionExecutor;
  private readonly transport: ServerTransport;
  private readonly channelManager: ChannelManager;
  private readonly syncChannels = new Map<string, SyncChannel>();
  private readonly path: string;
  private readonly authHandler: AuthHandlerFn;
  private readonly perMessageDeflate: boolean | undefined;
  private readonly maxConnections: number;
  private readonly maxEventNameLength: number;
  private readonly rateLimitConfig: RateLimitConfig;

  constructor(options: DatasoleServerOptions = {}) {
    this.path = options.path ?? '/__ds';
    this.authHandler = options.authHandler ?? createDefaultAuthHandler();
    this.perMessageDeflate = options.perMessageDeflate;
    this.maxConnections = options.maxConnections ?? 10_000;
    this.maxEventNameLength = options.maxEventNameLength ?? 256;

    this.backend = options.stateBackend ?? new MemoryBackend();
    this.metrics = new MetricsCollector();
    this.rateLimiter = new BackendRateLimiter(this.backend);
    this.rateLimitConfig = options.rateLimit ?? { defaultRule: DEFAULT_RATE_LIMIT_RULE };

    this.rpc = new RpcDispatcher<T>();
    this.events = new EventBus<T>(this.backend);
    this.state = new StateManager<T>(this.backend);
    this.crdt = new CrdtManager(this.backend, options.maxCrdtKeys);
    this.sessions = new SessionManager(this.backend, options.session);

    this.executor = createExecutor(options.executor);
    this.transport = new ServerTransport(this.metrics, this.rateLimiter, this.rateLimitConfig);

    this.executor.init({
      sendRaw: (id, data) => this.transport.sendRaw(id, data),
      broadcastRaw: (data) => this.transport.broadcastRaw(data),
    });

    this.wireFrameHandlers();

    const channelDeps: ChannelManagerDeps = {
      createSyncChannel: (config) => {
        this.createSyncChannel(config);
      },
      registerEventHandler: (event, handler) => {
        this.events.on(event as keyof T['events'] & string, handler as never);
      },
      registerCrdt: (key, type) => {
        this.crdt.registerByType(key, type);
      },
    };
    this.channelManager = new ChannelManager(channelDeps);
  }

  private wireFrameHandlers(): void {
    if (!(this.executor instanceof AsyncExecutor)) return;
    const asyncExec = this.executor;

    asyncExec.router.register(Opcode.RPC_REQ, async (conn, frame) => {
      const request = deserialize<RpcRequest>(frame.payload);
      const ctx: RpcContext = {
        auth: conn.info.auth,
        connectionId: conn.info.id,
        connection: conn.context,
      };
      const response = await this.rpc.dispatch(request, ctx);
      this.sendToConnection(conn, Opcode.RPC_RES, frame.correlationId, response);
    });

    asyncExec.router.register(Opcode.EVENT_C2S, async (conn, frame) => {
      const payload = deserialize<{ event: string; data: unknown }>(frame.payload);
      if (
        typeof payload.event !== 'string' ||
        payload.event.length === 0 ||
        payload.event.length > this.maxEventNameLength
      ) {
        return;
      }
      this.events.emit(payload.event as keyof T['events'] & string, payload.data as never);
    });

    asyncExec.router.register(Opcode.PING, async (conn, frame) => {
      this.sendToConnection(conn, Opcode.PONG, frame.correlationId, null);
    });

    asyncExec.router.register(Opcode.CRDT_OP, async (conn, frame) => {
      const payload = deserialize<{ key: string; op: CrdtOperation }>(frame.payload);
      const result = this.crdt.apply(conn.info.id, { ...payload.op, key: payload.key });
      if (result) {
        this.broadcastFrame(Opcode.CRDT_STATE, { key: result.key, state: result.state });
      }
    });
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
    this.transport.broadcastRaw(frameData);
  }

  /** Attach datasole transport + runtime asset serving to an HTTP server. */
  attach(server: HttpServer, _adapter?: ServerAdapter): void {
    this.transport.attach(
      server,
      {
        path: this.path,
        perMessageDeflate: this.perMessageDeflate,
        maxConnections: this.maxConnections,
        authHandler: this.authHandler,
      },
      this.executor,
    );
  }

  /** Set and broadcast typed state value for a key. */
  async setState<K extends keyof T['state'] & string>(
    key: K,
    value: T['state'][K],
  ): Promise<StatePatch[]> {
    const patches = await this.state.setState(key, value);
    if (patches.length > 0) {
      const channel = this.syncChannels.get(key);
      if (channel) {
        channel.enqueue(patches);
      } else {
        this.broadcastFrame(Opcode.STATE_PATCH, { key, patches });
      }
    }
    return patches;
  }

  /** Get the latest typed state value for a key. */
  async getState<K extends keyof T['state'] & string>(key: K): Promise<T['state'][K] | undefined> {
    return this.state.getState(key);
  }

  /** Create and register a sync channel for batched/debounced patch flows. */
  createSyncChannel<V = unknown>(config: SyncChannelConfig<V>): SyncChannel<V> {
    const channel = new SyncChannel(config, this.backend);
    channel.onFlush((patches) => {
      this.broadcastFrame(Opcode.STATE_PATCH, { key: config.key, patches });
    });
    this.syncChannels.set(config.key, channel as SyncChannel);
    return channel;
  }

  /** Return an existing sync channel by key. */
  getSyncChannel(key: string): SyncChannel | undefined {
    return this.syncChannels.get(key);
  }

  /** Create a high-level data channel (RPC/events/state/CRDT composition). */
  createDataChannel<V = unknown>(config: LiveStateConfig<V>): DataChannel {
    return this.channelManager.create(config);
  }

  /** Return an existing data channel by key. */
  getDataChannel(key: string): DataChannel | undefined {
    return this.channelManager.get(key);
  }

  /** Broadcast a typed server event to local handlers and all clients. */
  broadcast<K extends keyof T['events'] & string>(event: K, data: T['events'][K]): void {
    this.events.emit(event, data as never);
    this.broadcastFrame(Opcode.EVENT_S2C, { event, data, timestamp: Date.now() });
  }

  /** Return currently connected WebSocket client count. */
  getConnectionCount(): number {
    return this.transport.getConnectionCount();
  }

  /** Gracefully shutdown transport, primitives, and backend-powered services. */
  async close(): Promise<void> {
    await this.transport.close();
    await this.sessions.destroy();
    await this.executor.shutdown();
    this.channelManager.closeAll();
    for (const channel of this.syncChannels.values()) {
      await channel.destroy();
    }
    this.syncChannels.clear();
    await this.crdt.destroy();
    await this.events.destroy();
    await this.rpc.destroy();
    await this.rateLimiter.destroy();
  }
}

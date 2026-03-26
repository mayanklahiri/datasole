/**
 * DatasoleServer: composition root that wires transport, pipeline, protocol,
 * executor, backends, and application primitives.
 *
 * Design intent:
 * - Container wires all layers; no layer holds a back-pointer to the server
 * - Transport is a pure byte pipe; protocol encoding/dispatch lives in protocol/
 * - Inbound frame processing flows through an interceptor pipeline
 * - Services communicate broadcasts via {@link BroadcastSink}, not wire-protocol opcodes
 */
import type { DatasoleContract } from '../shared/contract';

import { createBackend } from './backends/factory';
import { MemoryBackend } from './backends/memory';
import type { BackendConfig, StateBackend } from './backends/types';
import type { AuthHandlerFn } from './contracts';
import { createExecutor } from './executor/factory';
import type { ConnectionExecutor, ExecutorOptions } from './executor/types';
import { DatasoleServerTransportFacade } from './facades';
import { MetricsCollector } from './metrics';
import { FramePipeline } from './pipeline/frame-pipeline';
import { createMetricsInterceptor } from './pipeline/metrics.interceptor';
import { createRateLimitInterceptor } from './pipeline/rate-limit.interceptor';
import { createDefaultAuthHandler } from './primitives/auth/auth-handler';
import { CrdtManager } from './primitives/crdt/crdt-manager';
import { EventBus } from './primitives/events/event-bus';
import { ServerEventFanout, ServerLiveState } from './primitives/live-state';
import { DefaultRateLimiter } from './primitives/rate-limit/default-limiter';
import type { RateLimitConfig, RateLimiter } from './primitives/rate-limit/types';
import { DEFAULT_RATE_LIMIT_RULE } from './primitives/rate-limit/types';
import { RpcDispatcher } from './primitives/rpc/rpc-dispatcher';
import type { SessionOptions } from './primitives/state/session-manager';
import { SessionManager } from './primitives/state/session-manager';
import { StateManager } from './primitives/state/state-manager';
import { registerProtocolHandlers } from './protocol/protocol-adapter';
import { ProtocolBroadcastSink } from './protocol/protocol-broadcast-sink';
import { ServerTransport } from './transport/server-transport';
import type { TransportLifecycle } from './transport/server-transport';

/**
 * Backend-powered primitives shared by one {@link DatasoleServer} instance.
 */
export interface DatasolePrimitives<T extends DatasoleContract> {
  readonly state: StateManager<T>;
  readonly events: EventBus<T>;
  /** Persist typed state and push STATE_PATCH to clients (and sync channels when registered). */
  readonly live: ServerLiveState<T>;
  /** Emit server events to local handlers and all WebSocket clients. */
  readonly fanout: ServerEventFanout<T>;
  readonly crdt: CrdtManager;
  readonly sessions: SessionManager;
  readonly rateLimiter: RateLimiter;
}

/**
 * Configuration for {@link DatasoleServer}.
 *
 * All properties are optional — sensible defaults are applied for every field.
 * WebSocket **per-message deflate** is not configurable: it stays disabled; frames use
 * datasole's application-level compression instead.
 *
 * See the [Configuration Reference](https://datasole.dev/server.html#configuration-reference)
 * for exhaustive documentation of each option.
 */
export interface DatasoleServerOptions {
  /**
   * WebSocket endpoint path (and static asset base for the runtime worker bundle).
   * Clients connect to `ws://<host><path>`.
   *
   * @default '/__ds'
   */
  path?: string;

  /**
   * Authenticate the HTTP upgrade request before establishing the WebSocket.
   * Return `{ authenticated: true, userId, roles?, metadata? }` to allow,
   * or `{ authenticated: false }` to reject with HTTP 401.
   *
   * If omitted, all connections are allowed (anonymous access); `userId` defaults
   * to a stable identifier derived from the connection.
   */
  authHandler?: AuthHandlerFn;

  /**
   * Pluggable key-value + pub/sub backend. Powers state, sessions, events,
   * CRDTs, rate limiting, and sync channels. All primitives share this
   * single backend instance, so swapping it to Redis or Postgres makes
   * the entire server distributed.
   *
   * @default new MemoryBackend()
   */
  stateBackend?: StateBackend;

  /**
   * Declarative backend configuration (alternative to `stateBackend`).
   * Useful when the config is loaded from a file or environment variable.
   * If both `stateBackend` and `backendConfig` are set, construction throws.
   */
  backendConfig?: BackendConfig;

  /**
   * Pluggable frame rate limiter. Defaults to {@link DefaultRateLimiter} using
   * the same `StateBackend` as the rest of the server. Custom implementations
   * may implement optional `connect()` / `destroy()` for lifecycle hooks invoked
   * from {@link DatasoleServer.init} / {@link DatasoleServer.close}.
   */
  rateLimiter?: RateLimiter;

  /**
   * Connection executor configuration — controls how incoming frames are
   * dispatched and processed (async default, optional worker/thread-pool models).
   *
   * @default { model: 'async' }
   */
  executor?: Partial<ExecutorOptions>;

  /**
   * Frame-level rate limiting configuration. Rate limits are enforced per
   * connection per sliding window. Uses the configured `StateBackend` when
   * using {@link DefaultRateLimiter}, so limits are distributed with Redis or Postgres.
   *
   * @default { defaultRule: { windowMs: 60_000, maxRequests: 100 } }
   */
  rateLimit?: RateLimitConfig;

  /**
   * Session persistence tuning. Sessions auto-flush dirty writes to the
   * state backend when either the mutation threshold or interval is reached.
   *
   * @default { flushThreshold: 10, flushIntervalMs: 5000 }
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
   * Maximum number of distinct CRDT keys the server will track per instance.
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

/**
 * Node.js entrypoint: HTTP upgrade → WebSocket → pipeline → protocol → typed primitives.
 */
export class DatasoleServer<T extends DatasoleContract> {
  readonly rpc: RpcDispatcher<T>;
  readonly metrics: MetricsCollector;
  readonly transport: DatasoleServerTransportFacade;
  readonly primitives: DatasolePrimitives<T>;

  private readonly backend: StateBackend;
  private readonly rateLimiterImpl: RateLimiter;
  private readonly executor: ConnectionExecutor;

  constructor(options: DatasoleServerOptions = {}) {
    const path = options.path ?? '/__ds';
    const authHandler = options.authHandler ?? createDefaultAuthHandler();
    const maxConnections = options.maxConnections ?? 10_000;
    const maxEventNameLength = options.maxEventNameLength ?? 256;

    if (options.stateBackend != null && options.backendConfig != null) {
      throw new Error('DatasoleServer: pass either stateBackend or backendConfig, not both.');
    }
    let backend: StateBackend;
    if (options.stateBackend != null) {
      backend = options.stateBackend;
    } else if (options.backendConfig != null) {
      backend = createBackend(options.backendConfig);
    } else {
      backend = new MemoryBackend();
    }
    this.backend = backend;

    this.rateLimiterImpl = options.rateLimiter ?? new DefaultRateLimiter(this.backend);
    this.metrics = new MetricsCollector();
    const rateLimitConfig = options.rateLimit ?? { defaultRule: DEFAULT_RATE_LIMIT_RULE };

    // --- Services / Primitives ---
    const events = new EventBus<T>(this.backend);
    const state = new StateManager<T>(this.backend);
    const crdt = new CrdtManager(this.backend, options.maxCrdtKeys);
    const sessions = new SessionManager(this.backend, options.session);
    this.rpc = new RpcDispatcher<T>();

    // --- Executor ---
    this.executor = createExecutor(options.executor);

    // --- Transport (pure byte pipe) ---
    const transportImpl = new ServerTransport(this.metrics);

    this.executor.init({
      sendRaw: (id, data) => transportImpl.sendRaw(id, data),
      broadcastRaw: (data) => transportImpl.broadcastRaw(data),
    });

    // --- Protocol: BroadcastSink + frame handler registration ---
    const broadcastSink = new ProtocolBroadcastSink(
      (data) => transportImpl.broadcastRaw(data),
      this.metrics,
    );

    registerProtocolHandlers(this.executor.router, {
      rpc: this.rpc,
      events,
      crdt,
      metrics: this.metrics,
      maxEventNameLength,
      broadcastSink,
    });

    // --- Pipeline: metrics → rate-limit → executor dispatch ---
    const pipeline = new FramePipeline();
    pipeline.use(createMetricsInterceptor(this.metrics));
    pipeline.use(
      createRateLimitInterceptor({
        rateLimiter: this.rateLimiterImpl,
        rateLimitConfig,
        getConnection: (id) => transportImpl.getConnection(id),
        metrics: this.metrics,
      }),
    );
    pipeline.use(async (ctx, _next) => {
      this.executor.dispatch(ctx.connectionId, ctx.raw);
    });

    // --- Live-state and event fanout (use BroadcastSink, not wire opcodes) ---
    const live = new ServerLiveState<T>(this.backend, state, events, crdt, broadcastSink);
    const fanout = new ServerEventFanout<T>(events, broadcastSink);

    this.primitives = {
      state,
      events,
      live,
      fanout,
      crdt,
      sessions,
      rateLimiter: this.rateLimiterImpl,
    };

    // --- Transport lifecycle (forward-only wiring, no server back-pointer) ---
    const lifecycle: TransportLifecycle = {
      onFrame: (id, raw) => pipeline.execute({ connectionId: id, raw }),
      onConnect: (id, conn) => {
        this.executor.addConnection(id, {
          remoteAddress: conn.info.remoteAddress,
          auth: conn.info.auth,
        });
        this.executor.setConnection(id, conn);
      },
      onDisconnect: (id) => {
        this.executor.removeConnection(id);
      },
    };

    this.transport = new DatasoleServerTransportFacade({
      transport: transportImpl,
      lifecycle,
      path,
      maxConnections,
      authHandler,
    });
  }

  /**
   * Async startup: optional `StateBackend.connect()` and optional `RateLimiter.connect()`.
   * Call before {@link DatasoleServer.transport.attach} for distributed backends or custom limiters.
   */
  async init(): Promise<void> {
    const b = this.backend as { connect?: () => Promise<void> };
    if (typeof b.connect === 'function') {
      await b.connect();
    }
    if (typeof this.rateLimiterImpl.connect === 'function') {
      await this.rateLimiterImpl.connect();
    }
  }

  /** Gracefully shutdown transport, primitives, and backend-powered services. */
  async close(): Promise<void> {
    await this.transport.closeTransport();
    await this.primitives.sessions.destroy();
    await this.executor.shutdown();
    this.primitives.live.closeAllDataChannels();
    await this.primitives.live.destroySyncChannels();
    await this.primitives.crdt.destroy();
    await this.primitives.events.destroy();
    await this.rpc.destroy();
    await this.rateLimiterImpl.destroy();
  }
}

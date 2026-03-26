/**
 * DatasoleServer: composes transport, executor, backends, and primitives.
 *
 * Design intent:
 * - keep transport and protocol handling isolated from application logic
 * - expose typed primitives under {@link DatasoleServer.primitives} and orchestration on {@link DatasoleServer.localServer}
 * - route all distributed behavior through a single backend abstraction
 */
import type { DatasoleContract } from '../shared/contract';

import { createBackend } from './backends/factory';
import { MemoryBackend } from './backends/memory';
import type { BackendConfig, StateBackend } from './backends/types';
import { DatasoleLocalServerFacade, DatasoleServerTransportFacade } from './datasole';
import { createExecutor } from './executor/factory';
import type { ConnectionExecutor, ExecutorOptions } from './executor/types';
import { MetricsCollector } from './metrics';
import type { AuthHandlerFn } from './primitives/auth/auth-handler';
import { createDefaultAuthHandler } from './primitives/auth/auth-handler';
import { CrdtManager } from './primitives/crdt/crdt-manager';
import { EventBus } from './primitives/events/event-bus';
import { DefaultRateLimiter } from './primitives/rate-limit/default-limiter';
import type { RateLimitConfig, RateLimiter } from './primitives/rate-limit/types';
import { DEFAULT_RATE_LIMIT_RULE } from './primitives/rate-limit/types';
import { RpcDispatcher } from './primitives/rpc/rpc-dispatcher';
import type { SessionOptions } from './primitives/state/session-manager';
import { SessionManager } from './primitives/state/session-manager';
import { StateManager } from './primitives/state/state-manager';
import { ServerTransport } from './transport/server-transport';

/**
 * Backend-powered primitives shared by one {@link DatasoleServer} instance.
 */
export interface DatasolePrimitives<T extends DatasoleContract> {
  readonly state: StateManager<T>;
  readonly events: EventBus<T>;
  readonly crdt: CrdtManager;
  readonly sessions: SessionManager;
  readonly rateLimiter: RateLimiter;
}

/**
 * Configuration for {@link DatasoleServer}.
 *
 * All properties are optional — sensible defaults are applied for every field.
 * WebSocket **per-message deflate** is not configurable: it stays disabled; frames use
 * datasole’s application-level compression instead.
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
 * Node.js entrypoint: HTTP upgrade → WebSocket → executor → typed primitives.
 */
export class DatasoleServer<T extends DatasoleContract> {
  readonly rpc: RpcDispatcher<T>;
  readonly metrics: MetricsCollector;
  readonly transport: DatasoleServerTransportFacade<T>;
  readonly localServer: DatasoleLocalServerFacade<T>;
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

    const events = new EventBus<T>(this.backend);
    const state = new StateManager<T>(this.backend);
    const crdt = new CrdtManager(this.backend, options.maxCrdtKeys);
    const sessions = new SessionManager(this.backend, options.session);

    this.rpc = new RpcDispatcher<T>();

    this.primitives = {
      state,
      events,
      crdt,
      sessions,
      rateLimiter: this.rateLimiterImpl,
    };

    this.executor = createExecutor(options.executor);
    const transportImpl = new ServerTransport(this.metrics, this.rateLimiterImpl, rateLimitConfig);

    this.executor.init({
      sendRaw: (id, data) => transportImpl.sendRaw(id, data),
      broadcastRaw: (data) => transportImpl.broadcastRaw(data),
    });

    this.transport = new DatasoleServerTransportFacade(this, {
      transport: transportImpl,
      executor: this.executor,
      path,
      maxConnections,
      authHandler,
      maxEventNameLength,
    });

    this.localServer = new DatasoleLocalServerFacade(
      this,
      this.backend,
      state,
      events,
      crdt,
      maxEventNameLength,
      (opcode, data) => {
        this.transport.broadcastProtocolFrame(opcode, data);
      },
    );
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
    this.localServer.closeAllDataChannels();
    await this.localServer.destroySyncChannels();
    await this.primitives.crdt.destroy();
    await this.primitives.events.destroy();
    await this.rpc.destroy();
    await this.rateLimiterImpl.destroy();
  }
}

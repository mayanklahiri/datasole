/**
 * DatasoleServer: composes transport, executor, backends, and primitives.
 *
 * Design intent:
 * - keep transport and protocol handling isolated from application logic
 * - expose typed primitives under {@link DatasoleServer.primitives} and orchestration on {@link DatasoleServer.localServer}
 * - route all distributed behavior through a single backend abstraction
 */
import { compress, deserialize, serialize } from '../shared/codec';
import { COMPRESSION_THRESHOLD } from '../shared/constants';
import type { DatasoleContract } from '../shared/contract';
import type { CrdtOperation } from '../shared/crdt';
import { encodeFrame, Opcode } from '../shared/protocol';
import type { RpcRequest } from '../shared/types';

import { createBackend } from './backends/factory';
import { MemoryBackend } from './backends/memory';
import type { BackendConfig, StateBackend } from './backends/types';
import { DatasoleLocalServerFacade, DatasoleServerTransportFacade } from './datasole';
import { AsyncExecutor } from './executor/async-executor';
import { createExecutor } from './executor/factory';
import type { FrameRouter } from './executor/frame-router';
import type { ConnectionExecutor, ExecutorOptions } from './executor/types';
import { MetricsCollector } from './metrics';
import type { AuthHandlerFn } from './primitives/auth/auth-handler';
import { createDefaultAuthHandler } from './primitives/auth/auth-handler';
import { CrdtManager } from './primitives/crdt/crdt-manager';
import { EventBus } from './primitives/events/event-bus';
import { DefaultRateLimiter } from './primitives/rate-limit/default-limiter';
import type { RateLimitConfig, RateLimiter } from './primitives/rate-limit/types';
import { DEFAULT_RATE_LIMIT_RULE } from './primitives/rate-limit/types';
import type { RpcContext } from './primitives/rpc/rpc-dispatcher';
import { RpcDispatcher } from './primitives/rpc/rpc-dispatcher';
import type { SessionOptions } from './primitives/state/session-manager';
import { SessionManager } from './primitives/state/session-manager';
import { StateManager } from './primitives/state/state-manager';
import type { Connection } from './transport/connection';
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
   */
  backendConfig?: BackendConfig;

  /**
   * Pluggable frame rate limiter. Defaults to {@link DefaultRateLimiter} using
   * the same `StateBackend` as the rest of the server.
   */
  rateLimiter?: RateLimiter;

  /**
   * Enable WebSocket per-message deflate compression at the transport level.
   * This is **in addition to** datasole's own application-level pako compression.
   * Generally leave disabled — the application-level compression is sufficient
   * and avoids the CPU cost of per-message-deflate on high-connection servers.
   *
   * @default false
   */
  perMessageDeflate?: boolean | undefined;

  /**
   * Connection executor configuration — controls how incoming frames are
   * dispatched and processed.
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
   * Maximum number of distinct CRDT keys the server will track.
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
  private readonly transportImpl: ServerTransport;
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

    if (options.stateBackend != null && options.backendConfig != null) {
      throw new Error('DatasoleServer: pass either stateBackend or backendConfig, not both.');
    }
    if (options.stateBackend != null) {
      this.backend = options.stateBackend;
    } else if (options.backendConfig != null) {
      this.backend = createBackend(options.backendConfig);
    } else {
      this.backend = new MemoryBackend();
    }

    this.rateLimiterImpl = options.rateLimiter ?? new DefaultRateLimiter(this.backend);
    this.metrics = new MetricsCollector();
    this.rateLimitConfig = options.rateLimit ?? { defaultRule: DEFAULT_RATE_LIMIT_RULE };

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
    this.transportImpl = new ServerTransport(
      this.metrics,
      this.rateLimiterImpl,
      this.rateLimitConfig,
    );

    this.executor.init({
      sendRaw: (id, data) => this.transportImpl.sendRaw(id, data),
      broadcastRaw: (data) => this.transportImpl.broadcastRaw(data),
    });

    this.localServer = new DatasoleLocalServerFacade(
      this,
      this.backend,
      state,
      events,
      crdt,
      this.maxEventNameLength,
      (opcode, data) => {
        this.broadcastFrame(opcode, data);
      },
    );

    this.transport = new DatasoleServerTransportFacade(this, {
      transport: this.transportImpl,
      executor: this.executor,
      path: this.path,
      perMessageDeflate: this.perMessageDeflate,
      maxConnections: this.maxConnections,
      authHandler: this.authHandler,
    });

    this.wireFrameHandlers();
  }

  private getFrameRouter(): FrameRouter | null {
    if (this.executor instanceof AsyncExecutor) {
      return this.executor.router;
    }
    if ('router' in this.executor) {
      return (this.executor as { router: FrameRouter }).router;
    }
    return null;
  }

  private wireFrameHandlers(): void {
    const router = this.getFrameRouter();
    if (!router) return;

    router.register(Opcode.RPC_REQ, async (conn, frame) => {
      const request = deserialize<RpcRequest>(frame.payload);
      const ctx: RpcContext = {
        auth: conn.info.auth,
        connectionId: conn.info.id,
        connection: conn.context,
      };
      const response = await this.rpc.dispatch(request, ctx);
      this.sendToConnection(conn, Opcode.RPC_RES, frame.correlationId, response);
    });

    router.register(Opcode.EVENT_C2S, async (conn, frame) => {
      const payload = deserialize<{ event: string; data: unknown }>(frame.payload);
      if (
        typeof payload.event !== 'string' ||
        payload.event.length === 0 ||
        payload.event.length > this.maxEventNameLength
      ) {
        return;
      }
      this.primitives.events.emit(
        payload.event as keyof T['events'] & string,
        payload.data as never,
      );
    });

    router.register(Opcode.PING, async (conn, frame) => {
      this.sendToConnection(conn, Opcode.PONG, frame.correlationId, null);
    });

    router.register(Opcode.CRDT_OP, async (conn, frame) => {
      const payload = deserialize<{ key: string; op: CrdtOperation }>(frame.payload);
      const result = this.primitives.crdt.apply(conn.info.id, { ...payload.op, key: payload.key });
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
    this.transportImpl.broadcastRaw(frameData);
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
    await this.transportImpl.close();
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

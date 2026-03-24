/**
 * DatasoleServer facade: composes transport, executor, backends, and primitives.
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

export interface DatasoleServerOptions {
  path?: string;
  authHandler?: AuthHandlerFn;
  stateBackend?: StateBackend;
  backendConfig?: BackendConfig;
  metricsExporter?: MetricsExporter;
  perMessageDeflate?: boolean;
  executor?: Partial<ExecutorOptions>;
  rateLimit?: RateLimitConfig;
  session?: SessionOptions;
  maxConnections?: number;
  maxCrdtKeys?: number;
  maxEventNameLength?: number;
}

export class DatasoleServer<T extends DatasoleContract> {
  readonly rpc: RpcDispatcher<T>;
  readonly events: EventBus<T>;
  readonly state: StateManager<T>;
  readonly crdt: CrdtManager;
  readonly sessions: SessionManager;
  readonly rateLimiter: BackendRateLimiter;
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

    this.executor = createExecutor(options.executor ?? { model: 'async' });
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

  async getState<K extends keyof T['state'] & string>(key: K): Promise<T['state'][K] | undefined> {
    return this.state.getState(key);
  }

  createSyncChannel<V = unknown>(config: SyncChannelConfig<V>): SyncChannel<V> {
    const channel = new SyncChannel(config, this.backend);
    channel.onFlush((patches) => {
      this.broadcastFrame(Opcode.STATE_PATCH, { key: config.key, patches });
    });
    this.syncChannels.set(config.key, channel as SyncChannel);
    return channel;
  }

  getSyncChannel(key: string): SyncChannel | undefined {
    return this.syncChannels.get(key);
  }

  createDataChannel<V = unknown>(config: LiveStateConfig<V>): DataChannel {
    return this.channelManager.create(config);
  }

  getDataChannel(key: string): DataChannel | undefined {
    return this.channelManager.get(key);
  }

  broadcast<K extends keyof T['events'] & string>(event: K, data: T['events'][K]): void {
    this.events.emit(event, data as never);
    this.broadcastFrame(Opcode.EVENT_S2C, { event, data, timestamp: Date.now() });
  }

  getConnectionCount(): number {
    return this.transport.getConnectionCount();
  }

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

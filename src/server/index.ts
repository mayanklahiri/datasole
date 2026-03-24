export { DatasoleServer } from './server';
export type { DatasoleServerOptions } from './server';

// Contract
export type {
  DatasoleContract,
  RpcParams,
  RpcResult,
  EventData,
  StateValue,
} from '../shared/contract';

// Adapters
export { ExpressAdapter, NativeHttpAdapter, DatasoleNestAdapter } from './adapters';
export type { ServerAdapter } from './adapters';

// Backends
export { MemoryBackend, RedisBackend, PostgresBackend, createBackend } from './backends';
export type {
  StateBackend,
  StateBackendOptions,
  RedisBackendOptions,
  PostgresBackendOptions,
  BackendConfig,
} from './backends';

// Executor
export {
  AsyncExecutor,
  ThreadExecutor,
  PoolExecutor,
  FrameRouter,
  createExecutor,
  DEFAULT_EXECUTOR_OPTIONS,
} from './executor';
export type {
  ExecutorModel,
  ConnectionMeta,
  ExecutorSend,
  ConnectionExecutor,
  ExecutorOptions,
  DecodedFrame,
  FrameHandlerFn,
} from './executor';

// Primitives
export type { RealtimePrimitive } from './primitives';
export { RpcDispatcher } from './primitives';
export type { RpcHandler, RpcContext } from './primitives';
export { EventBus } from './primitives';
export { StateManager, SessionManager } from './primitives';
export type { SessionOptions, SessionState } from './primitives';
export { CrdtManager } from './primitives';
export { SyncChannel, DEFAULT_SYNC_OPTIONS } from './primitives';
export type {
  FlushStrategy,
  SyncChannelOptions,
  SyncDirection,
  SyncMode,
  SyncChannelConfig,
} from './primitives';
export { createAuthHandler, createDefaultAuthHandler } from './primitives';
export type { AuthHandlerInterface, AuthHandlerFn, AuthHandlerConfig } from './primitives';
export { BackendRateLimiter, DEFAULT_RATE_LIMIT_RULE } from './primitives';
export type { RateLimiter, RateLimitResult, RateLimitRule, RateLimitConfig } from './primitives';
export { ChannelManager } from './primitives';
export type { ChannelManagerDeps } from './primitives';

// Metrics
export { MetricsCollector, PrometheusExporter, OpenTelemetryExporter } from './metrics';
export type { MetricsSnapshot, MetricsExporter } from './metrics';

// Transport
export {
  WsServer,
  Connection,
  handleUpgrade,
  DefaultConnectionContext,
  ServerTransport,
} from './transport';
export type {
  WsServerOptions,
  ConnectionInfo,
  AuthHandler,
  ConnectionContext,
  TransportOptions,
} from './transport';

export { DatasoleServer } from './server';
export type { DatasoleServerOptions, DatasolePrimitives } from './server';
export { DatasoleServerTransportFacade } from './facades';
export type { DatasoleTransportAttachOptions } from './facades';
export { ServerLiveState, ServerEventFanout } from './primitives';

// Contract
export type {
  DatasoleContract,
  RpcParams,
  RpcResult,
  EventData,
  StateValue,
} from '../shared/contract';

// Adapters
export {
  BaseUpgradeAdapter,
  ExpressAdapter,
  NativeHttpAdapter,
  DatasoleNestAdapter,
} from './adapters';
export type { ServerAdapter, UpgradeHandler } from './adapters';

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
  DelegatingExecutor,
  ThreadExecutor,
  PoolExecutor,
  createExecutor,
  DEFAULT_EXECUTOR_OPTIONS,
} from './executor';
export type {
  ExecutorModel,
  ConnectionMeta,
  ExecutorSend,
  ConnectionExecutor,
  ExecutorOptions,
} from './executor';

// Protocol
export type { BroadcastSink } from './protocol';
export { ProtocolBroadcastSink, FrameRouter } from './protocol';
export { registerProtocolHandlers } from './protocol';
export type { ProtocolAdapterDeps, DecodedFrame, FrameHandlerFn } from './protocol';

// Pipeline
export { FramePipeline } from './pipeline';
export type { FrameInterceptor, FrameInterceptorContext } from './pipeline';
export { createRateLimitInterceptor, createMetricsInterceptor } from './pipeline';
export type { RateLimitInterceptorDeps } from './pipeline';

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
export { createDefaultAuthHandler } from './primitives';
export type { AuthHandlerFn, AuthHandlerConfig } from './primitives';
export { DefaultRateLimiter, DEFAULT_RATE_LIMIT_RULE } from './primitives';
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
  TransportLifecycle,
} from './transport';

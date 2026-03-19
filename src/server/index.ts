export { DatasoleServer } from './server';
export type { DatasoleServerOptions } from './server';

// Adapters
export { ExpressAdapter, NativeHttpAdapter, DatasoleNestAdapter } from './adapters';
export type { ServerAdapter } from './adapters';

// Auth
export { createAuthHandler } from './auth';
export type { AuthHandlerInterface, AuthHandlerConfig } from './auth';

// Concurrency
export { createConcurrencyStrategy, AsyncStrategy, ThreadStrategy, ThreadPoolStrategy, ProcessStrategy } from './concurrency';
export type { ConcurrencyModel, ConcurrencyOptions, ConcurrencyStrategy, ConnectionWorker, WorkerMessage } from './concurrency';
export { DEFAULT_CONCURRENCY_OPTIONS } from './concurrency';

// Events
export { EventBus } from './events';

// Metrics
export { MetricsCollector, PrometheusExporter, OpenTelemetryExporter } from './metrics';
export type { MetricsSnapshot, MetricsExporter } from './metrics';

// Rate Limiting
export { MemoryRateLimiter, RedisRateLimiter } from './rate-limit';
export type { RateLimiter, RateLimitResult, RateLimitRule, RateLimitConfig } from './rate-limit';
export { DEFAULT_RATE_LIMIT_RULE } from './rate-limit';

// RPC
export { RpcDispatcher } from './rpc';
export type { RpcHandler, RpcContext } from './rpc';

// State
export { StateManager, MemoryBackend, RedisBackend, PostgresBackend, SessionManager } from './state';
export type { StateBackend, StateBackendOptions, RedisBackendOptions, PostgresBackendOptions, SessionOptions, SessionState } from './state';

// Sync
export { SyncChannel } from './sync';
export type { FlushStrategy, SyncChannelOptions, SyncDirection, SyncMode, SyncChannelConfig } from './sync';
export { DEFAULT_SYNC_OPTIONS } from './sync';

// Transport
export { WsServer, Connection, handleUpgrade, DefaultConnectionContext } from './transport';
export type { WsServerOptions, ConnectionInfo, AuthHandler, ConnectionContext } from './transport';

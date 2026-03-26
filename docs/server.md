---
title: Server
order: 3
description: Server API reference, configuration, executor models, rate limiting, sessions, and authentication.
---

# Server API

> **New here?** Start with the [Developer Guide](developer-guide.md) for integration-first setup, then use [Tutorials](tutorials.md) for the full step-by-step build. For a condensed options table, see [Configuration Reference](configuration.md#server-options).

## Quick Start

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer<AppContract>();
const http = createServer();
await ds.init();
ds.transport.attach(http);
http.listen(3000);
```

(`await ds.init()` connects distributed backends when needed; it is a no-op for `MemoryBackend`.)

## Configuration Reference

All options are passed to `new DatasoleServer<T>(options)`. Every field is optional — sensible defaults are applied.

### `DatasoleServerOptions`

```typescript
interface DatasoleServerOptions {
  path?: string;
  authHandler?: AuthHandlerFn;
  stateBackend?: StateBackend;
  backendConfig?: BackendConfig;
  rateLimiter?: RateLimiter;
  perMessageDeflate?: boolean;
  executor?: Partial<ExecutorOptions>;
  rateLimit?: RateLimitConfig;
  session?: SessionOptions;
  maxConnections?: number;
  maxCrdtKeys?: number;
  maxEventNameLength?: number;
}
```

---

#### `path`

WebSocket endpoint path. Clients connect to `ws://<host><path>`.

|             |                        |
| ----------- | ---------------------- |
| **Type**    | `string`               |
| **Default** | `'/__ds'`              |
| **Example** | `'/ws'`, `'/realtime'` |

The double-underscore prefix convention signals "framework internal" and avoids collision with common application routes like `/api` or `/ws`.

---

#### `authHandler`

Authenticate the HTTP upgrade request before establishing the WebSocket connection.

|             |                                                                        |
| ----------- | ---------------------------------------------------------------------- |
| **Type**    | `(req: IncomingMessage) => Promise<AuthResult>`                        |
| **Default** | Pass-through (all connections allowed, `userId` set to remote address) |

Return `{ authenticated: true, userId, roles?, metadata? }` to accept the connection, or `{ authenticated: false }` to reject with HTTP 401.

**`AuthResult` fields:**

| Field           | Type                      | Required | Description                                                   |
| --------------- | ------------------------- | -------- | ------------------------------------------------------------- |
| `authenticated` | `boolean`                 | yes      | Whether the connection is allowed                             |
| `userId`        | `string`                  | no       | Unique user identifier (populates `ConnectionContext.userId`) |
| `roles`         | `string[]`                | no       | Authorization roles for permission checks in RPC handlers     |
| `metadata`      | `Record<string, unknown>` | no       | Arbitrary metadata attached to the connection context         |

```typescript
const ds = new DatasoleServer<AppContract>({
  authHandler: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return { authenticated: false };

    const user = await verifyJwt(token);
    return {
      authenticated: true,
      userId: user.id,
      roles: user.roles,
      metadata: { displayName: user.name },
    };
  },
});
```

The auth result is available in all RPC handlers via `ctx.auth` and `ctx.connection`:

```typescript
ds.rpc.register('protectedMethod', async (params, ctx) => {
  if (!ctx.auth?.roles?.includes('admin')) {
    throw new Error('Forbidden');
  }
  // ctx.connection.userId, ctx.connection.metadata, etc.
});
```

---

#### `stateBackend`

Pluggable key-value + pub/sub backend instance. All primitives share this single backend, so swapping it makes the entire server distributed.

|             |                       |
| ----------- | --------------------- |
| **Type**    | `StateBackend`        |
| **Default** | `new MemoryBackend()` |

**Built-in backends:**

| Backend           | Import            | Use case                                           |
| ----------------- | ----------------- | -------------------------------------------------- |
| `MemoryBackend`   | `datasole/server` | Development, single-process                        |
| `RedisBackend`    | `datasole/server` | Multi-process, production (optional peer dep)      |
| `PostgresBackend` | `datasole/server` | Persistent state, audit trails (optional peer dep) |

```typescript
import { RedisBackend } from 'datasole/server';

const ds = new DatasoleServer<AppContract>({
  stateBackend: new RedisBackend({ url: 'redis://localhost:6379' }),
});
```

**`StateBackend` interface** (for custom implementations):

```typescript
interface StateBackend {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  subscribe(key: string, handler: (key: string, value: unknown) => void): () => void;
  publish(key: string, value: unknown): Promise<void>;
}
```

---

#### `backendConfig`

Declarative backend configuration — an alternative to `stateBackend`. Useful when the backend type is loaded from a config file or environment variables.

|             |                                   |
| ----------- | --------------------------------- |
| **Type**    | `BackendConfig`                   |
| **Default** | `undefined` (uses `stateBackend`) |

If both `stateBackend` and `backendConfig` are provided, construction throws — pass only one.

```typescript
interface BackendConfig {
  type: 'memory' | 'redis' | 'postgres';
  redis?: { url?: string; keyPrefix?: string; prefix?: string };
  postgres?: { connectionString?: string; tableName?: string; prefix?: string };
}
```

```typescript
const ds = new DatasoleServer<AppContract>({
  backendConfig: {
    type: 'redis',
    redis: { url: process.env.REDIS_URL, keyPrefix: 'myapp:' },
  },
});
```

---

#### `rateLimiter`

Pluggable frame rate limiter. If omitted, the server uses **`DefaultRateLimiter`** with the same **`StateBackend`** as the rest of the server.

|             |                                   |
| ----------- | --------------------------------- |
| **Type**    | `RateLimiter`                     |
| **Default** | `new DefaultRateLimiter(backend)` |

Implementations may expose optional **`connect()`** for async startup; it is invoked from **`await ds.init()`**.

---

#### `perMessageDeflate`

Enable WebSocket per-message-deflate compression at the transport level.

|             |           |
| ----------- | --------- |
| **Type**    | `boolean` |
| **Default** | `false`   |

Generally leave disabled. Datasole already compresses every frame >256 bytes using pako at the application level. Enabling per-message-deflate adds CPU cost per-connection and is known to cause memory issues at scale (the reason Socket.IO disabled it by default).

---

#### `executor`

Connection executor configuration — controls how incoming WebSocket frames are dispatched and processed.

|             |                            |
| ----------- | -------------------------- |
| **Type**    | `Partial<ExecutorOptions>` |
| **Default** | `{ model: 'async' }`       |

See [Executor Models](#executor-models) below for detailed guidance.

```typescript
interface ExecutorOptions {
  model: 'async' | 'thread' | 'thread-pool';
  poolSize?: number;
  maxThreads?: number;
  workerScript?: string;
  idleTimeout?: number;
}
```

| Field          | Type                                   | Default                     | Applies to              | Description                                    |
| -------------- | -------------------------------------- | --------------------------- | ----------------------- | ---------------------------------------------- |
| `model`        | `'async' \| 'thread' \| 'thread-pool'` | `'async'`                   | all                     | Concurrency model                              |
| `poolSize`     | `number`                               | `os.availableParallelism()` | `thread-pool`           | Number of worker threads in the pool           |
| `maxThreads`   | `number`                               | `256`                       | `thread`                | Upper bound on per-connection threads          |
| `workerScript` | `string`                               | `undefined`                 | `thread`, `thread-pool` | Path to JS/TS module loaded inside each worker |
| `idleTimeout`  | `number`                               | `30000`                     | `thread`, `thread-pool` | Milliseconds before an idle thread is recycled |

```typescript
// Minimal — use defaults (async executor)
const ds = new DatasoleServer<AppContract>();

// I/O-bound workload — single event loop, lowest overhead
const ds = new DatasoleServer<AppContract>({
  executor: { model: 'async' },
});

// CPU-bound per-connection work
const ds = new DatasoleServer<AppContract>({
  executor: { model: 'thread', maxThreads: 64 },
});

// Explicit pool sizing
const ds = new DatasoleServer<AppContract>({
  executor: { model: 'thread-pool', poolSize: 8 },
});
```

---

#### `rateLimit`

Frame-level rate limiting configuration. Rate limits are enforced per connection per sliding window. Uses the configured `StateBackend`, so limits are automatically distributed with Redis or Postgres.

|             |                                                           |
| ----------- | --------------------------------------------------------- |
| **Type**    | `RateLimitConfig`                                         |
| **Default** | `{ defaultRule: { windowMs: 60_000, maxRequests: 100 } }` |

```typescript
interface RateLimitConfig {
  defaultRule: RateLimitRule;
  rules?: Record<string, RateLimitRule>;
  keyExtractor?: (connectionId: string, method?: string) => string;
}

interface RateLimitRule {
  windowMs: number; // Sliding window duration in milliseconds
  maxRequests: number; // Maximum requests allowed per window
}
```

| Field          | Type                            | Default                                  | Description                                                                           |
| -------------- | ------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `defaultRule`  | `RateLimitRule`                 | `{ windowMs: 60_000, maxRequests: 100 }` | Applied when no per-method rule matches                                               |
| `rules`        | `Record<string, RateLimitRule>` | `{}`                                     | Per-method overrides keyed by RPC method name or event name                           |
| `keyExtractor` | `(connId, method?) => string`   | `undefined`                              | Custom key function for rate limit buckets (e.g., per-user instead of per-connection) |

```typescript
const ds = new DatasoleServer<AppContract>({
  rateLimit: {
    defaultRule: { windowMs: 60_000, maxRequests: 200 },
    rules: {
      search: { windowMs: 60_000, maxRequests: 30 },
      upload: { windowMs: 60_000, maxRequests: 5 },
    },
    keyExtractor: (connId, method) => `${connId}:${method ?? 'default'}`,
  },
});
```

---

#### `session`

Session persistence tuning. Sessions auto-flush dirty writes to the state backend.

|             |                                              |
| ----------- | -------------------------------------------- |
| **Type**    | `SessionOptions`                             |
| **Default** | `{}` (uses SessionManager internal defaults) |

```typescript
interface SessionOptions {
  flushThreshold?: number; // Persist after N mutations (default: 10)
  flushIntervalMs?: number; // Or every N ms (default: 5000)
  ttlMs?: number; // Session expiry TTL (default: no expiry)
  enableChangeStream?: boolean; // Emit change events (default: false)
}
```

| Field                | Type      | Default     | Description                                                |
| -------------------- | --------- | ----------- | ---------------------------------------------------------- |
| `flushThreshold`     | `number`  | `10`        | Number of mutations before auto-flush to backend           |
| `flushIntervalMs`    | `number`  | `5000`      | Timer-based flush interval (ms)                            |
| `ttlMs`              | `number`  | `undefined` | Session expiry (ms). No expiry if omitted                  |
| `enableChangeStream` | `boolean` | `false`     | Emit change events via `ds.primitives.sessions.onChange()` |

```typescript
const ds = new DatasoleServer<AppContract>({
  session: {
    flushThreshold: 5,
    flushIntervalMs: 2000,
    ttlMs: 3_600_000, // 1 hour
    enableChangeStream: true,
  },
});
```

---

#### `maxConnections`

Maximum simultaneous WebSocket connections. Connections beyond this limit are rejected at the transport layer before auth.

|             |          |
| ----------- | -------- |
| **Type**    | `number` |
| **Default** | `10_000` |

---

#### `maxCrdtKeys`

Maximum number of distinct CRDT keys the server will track. Prevents memory exhaustion from unbounded CRDT registration.

|             |          |
| ----------- | -------- |
| **Type**    | `number` |
| **Default** | `1000`   |

---

#### `maxEventNameLength`

Maximum allowed length (characters) for client-to-server event names. Events exceeding this limit are silently dropped.

|             |          |
| ----------- | -------- |
| **Type**    | `number` |
| **Default** | `256`    |

---

### Complete Example

```typescript
import { createServer } from 'http';
import { DatasoleServer, RedisBackend } from 'datasole/server';

const ds = new DatasoleServer<AppContract>({
  path: '/__ds',

  authHandler: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return { authenticated: false };
    const user = await verifyJwt(token);
    return { authenticated: true, userId: user.id, roles: user.roles };
  },

  stateBackend: new RedisBackend({ url: process.env.REDIS_URL }),

  executor: { model: 'thread-pool', poolSize: 8 },

  rateLimit: {
    defaultRule: { windowMs: 60_000, maxRequests: 200 },
    rules: { 'heavy-rpc': { windowMs: 60_000, maxRequests: 10 } },
  },

  session: {
    flushThreshold: 10,
    flushIntervalMs: 5000,
    ttlMs: 3_600_000,
  },

  maxConnections: 50_000,
  maxCrdtKeys: 500,
  maxEventNameLength: 128,
});

const http = createServer();
await ds.init();
ds.transport.attach(http);
http.listen(3000);
```

---

## Executor Models

The executor determines how incoming WebSocket frames are dispatched and processed. All models are cluster-friendly — no shared mutable state in the main process.

| Model         | Description                                                 | When to use                                       | Overhead   |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------- | ---------- |
| `async`       | Single event loop, all connections in-process **(default)** | I/O-bound: chat, notifications, dashboards        | Lowest     |
| `thread`      | Dedicated `worker_threads` per connection                   | CPU-bound per-connection: game logic, computation | Medium     |
| `thread-pool` | Fixed pool, least-connections assignment                    | Production workloads, general-purpose             | Low–medium |

### `async` — Single Event Loop (Default)

All frames are processed on the Node.js event loop with no thread isolation. This is the default model and the lightest option, ideal when your handlers are predominantly I/O-bound (database queries, external API calls, broadcasting). No serialization overhead.

```typescript
const ds = new DatasoleServer<AppContract>({
  executor: { model: 'async' },
});
```

### `thread` — Thread per Connection

Spawns a dedicated `worker_threads` thread for each connection. Best for CPU-intensive per-connection processing (game physics, real-time computation, audio/video processing). Each thread can initialize its own backend instance or share the parent's.

```typescript
const ds = new DatasoleServer<AppContract>({
  executor: {
    model: 'thread',
    maxThreads: 64,
    idleTimeout: 60_000,
  },
});
```

Use `maxThreads` to cap thread count and prevent resource exhaustion during connection spikes. Threads are recycled after `idleTimeout` ms of inactivity.

### `thread-pool` — Fixed Thread Pool (Recommended for Production)

A fixed pool of `worker_threads` with least-connections assignment. Recommended for production deployments. It balances thread isolation with resource efficiency — a small number of threads handle many connections.

```typescript
const ds = new DatasoleServer<AppContract>({
  executor: {
    model: 'thread-pool',
    poolSize: 8,
  },
});
```

`poolSize` defaults to `os.availableParallelism()` (typically the number of CPU cores). For I/O-heavy workloads with occasional CPU bursts, this is the best default.

### Worker Scripts

For `thread` and `thread-pool` models, you can specify a `workerScript` — a JS/TS module loaded inside each worker thread. This module can register RPC handlers and primitives that run in the thread context:

```typescript
const ds = new DatasoleServer<AppContract>({
  executor: {
    model: 'thread-pool',
    poolSize: 4,
    workerScript: './src/worker-setup.js',
  },
});
```

### pm2 Cluster Mode

Because the executor keeps no shared mutable state in the main process, and Redis/Postgres backends provide cross-process pub/sub, pm2 cluster mode works out of the box:

```bash
pm2 start dist/server.js -i max
```

---

## Attach to HTTP Server

```typescript
import { createServer } from 'http';

const http = createServer();
ds.transport.attach(http);
http.listen(3000);
```

`ds.transport.attach()` hooks into the HTTP server's `upgrade` event to handle WebSocket connections. Works with any Node.js HTTP server — Express, Koa, Fastify, NestJS, or plain `http.createServer()`.

---

## RPC Handlers

Register typed request/response handlers. The client calls them with `client.rpc(RpcMethod.Foo, params)` — use **`RpcMethod` string enums** in `shared/contract.ts`, not raw string literals.

```typescript
import { RpcMethod } from './shared/contract';

ds.rpc.register(RpcMethod.GetUser, async (params, ctx) => {
  // ctx.auth — the authenticated user's identity
  // ctx.connectionId — unique connection ID
  // ctx.connection — full ConnectionContext (metadata, tags, get/set)
  console.log(`User ${ctx.auth?.userId} is looking up ${params.userId}`);
  return { name: 'Alice', email: 'alice@example.com' };
});
```

> **Tutorial:** [RPC — Call the Server, Get a Response](tutorials.md#2-rpc--call-the-server-get-a-response)

## Server → Client Live State

The most powerful pattern: mutate a data structure on the server, and every connected client sees a live mirror. Only the JSON Patch diff is sent.

```typescript
import { StateKey } from './shared/contract';

await ds.localServer.setState(StateKey.Dashboard, { visitors: 0, active: 0 });

setInterval(async () => {
  await ds.localServer.setState(StateKey.Dashboard, {
    visitors: getVisitorCount(),
    active: getActiveCount(),
  });
}, 1000);
```

Clients subscribe with `client.subscribeState(StateKey.Dashboard, handler)` — no polling, no event mapping, no client-side state management.

> **Tutorial:** [Live State — A Server-Synced Dashboard](tutorials.md#4-live-state--a-server-synced-dashboard)

## Events

```typescript
import { Event } from './shared/contract';

ds.primitives.events.on(Event.ChatMessage, ({ data }) => {
  console.log('Received:', data.text);
});

ds.localServer.broadcast(Event.Notification, { title: 'Server restarting in 5 minutes' });

ds.primitives.events.off(Event.ChatMessage, handler);
```

> **Tutorial:** [Server Events — A Live Stock Ticker](tutorials.md#3-server-events--a-live-stock-ticker)

## Sync Channels

Fine-grained control over when state updates are flushed to clients.

```typescript
const alerts = ds.localServer.createSyncChannel({
  key: 'alerts',
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'immediate' },
});

const metrics = ds.localServer.createSyncChannel({
  key: 'metrics',
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'batched', batchIntervalMs: 200, maxBatchSize: 50 },
});

const form = ds.localServer.createSyncChannel({
  key: 'form',
  direction: 'client-to-server',
  mode: 'json-patch',
  flush: { flushStrategy: 'debounced', debounceMs: 500 },
});
```

> **Tutorial:** [Sync Channels — Controlled Flush Granularity](tutorials.md#7-sync-channels--controlled-flush-granularity)

## Session Manager

Per-user state that survives disconnections. Auto-flushes to the state backend.

```typescript
const state = await ds.primitives.sessions.restore(ctx.connection);

ds.primitives.sessions.set('user-123', 'lastPage', '/dashboard');
const page = ds.primitives.sessions.get<string>('user-123', 'lastPage');

ds.primitives.sessions.onChange((userId, key, value, version) => {
  console.log(`${userId} → ${key} = ${JSON.stringify(value)} (v${version})`);
});
```

> **Tutorial:** [Session Persistence — Surviving Reconnections](tutorials.md#8-session-persistence--surviving-reconnections)

## Rate Limiting

Frame-level rate limiting on persistent WebSocket connections. Rate limiting uses a `DefaultRateLimiter` backed by the configured `StateBackend`, so it is automatically distributed when using Redis or Postgres.

```typescript
const ds = new DatasoleServer<AppContract>({
  rateLimit: {
    defaultRule: { windowMs: 60_000, maxRequests: 100 },
    rules: {
      search: { windowMs: 60_000, maxRequests: 30 },
      upload: { windowMs: 60_000, maxRequests: 5 },
    },
  },
});
```

## Authentication

Hook into the HTTP upgrade request to authenticate connections. Supports any auth scheme (JWT, OAuth, SSO, API keys).

```typescript
const ds = new DatasoleServer<AppContract>({
  authHandler: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return { authenticated: false };

    const user = await verifyJwt(token);
    return {
      authenticated: true,
      userId: user.id,
      roles: user.roles,
      metadata: { displayName: user.name },
    };
  },
});
```

The auth result is available everywhere via `ConnectionContext`:

```typescript
import { RpcMethod } from './shared/contract';

ds.rpc.register(RpcMethod.ProtectedMethod, async (params, ctx) => {
  if (!ctx.auth?.roles?.includes('admin')) {
    throw new Error('Forbidden');
  }
});
```

> **Tutorial:** [Client Events + Auth — A Chat Room](tutorials.md#5-client-events--auth--a-chat-room)

## Framework Adapters

### Express

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const app = express();
const httpServer = createServer(app);
const ds = new DatasoleServer<AppContract>();
await ds.init();
ds.transport.attach(httpServer);
httpServer.listen(3000);
```

### NestJS

```typescript
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer<AppContract>();
await ds.init();
ds.transport.attach(app.getHttpServer());
```

### Native HTTP

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const server = createServer();
const ds = new DatasoleServer<AppContract>();
await ds.init();
ds.transport.attach(server);
server.listen(3000);
```

## API surface

| Member                                                                      | Role                                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `await ds.init()`                                                           | Connect `StateBackend` / optional `RateLimiter` before `transport.attach` |
| `ds.transport.attach(httpServer, adapter?)`                                 | WebSocket upgrade + static client/worker assets                           |
| `ds.transport.getConnectionCount()`                                         | Connected WebSocket clients                                               |
| `ds.localServer.setState` / `getState` / `broadcast` / sync + data channels | Server→client orchestration                                               |
| `ds.rpc`                                                                    | Typed RPC registry                                                        |
| `ds.metrics`                                                                | In-process counters (`snapshot()`, etc.)                                  |
| `ds.primitives.state` / `events` / `crdt` / `sessions` / `rateLimiter`      | Direct primitive access                                                   |
| `ds.close()`                                                                | Graceful shutdown                                                         |

Facades expose `readonly server: DatasoleServer<T>` for sibling access from nested code.

---
title: Server
order: 3
description: Server API reference, adapter setup, concurrency, rate limiting, sessions, and authentication.
---

# Server API

> **New here?** Start with the [Tutorials](tutorials.md) — they build from a 10-line server to production configuration with thread pools, Redis, and rate limiting.

## DatasoleServer

### Constructor

```typescript
import { DatasoleServer, MemoryBackend, PrometheusExporter } from 'datasole/server';

const ds = new DatasoleServer<AppContract>({
  path: '/__ds', // WebSocket path (default: /__ds)

  authHandler: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return { authenticated: !!token, userId: token };
  },

  stateBackend: new MemoryBackend(), // or RedisBackend, PostgresBackend
  metricsExporter: new PrometheusExporter(),

  executor: {
    // See "Concurrency Models" below
    model: 'thread-pool', // 'async' | 'thread' | 'thread-pool' | 'process'
    poolSize: 4,
  },

  rateLimit: {
    defaultRule: { windowMs: 60_000, maxRequests: 200 },
    rules: { 'heavy-rpc': { windowMs: 60_000, maxRequests: 10 } },
  },

  session: {
    flushThreshold: 10, // Persist after N mutations
    flushIntervalMs: 5000, // Or every N ms
  },
});
```

### Attach to HTTP Server

```typescript
import { createServer } from 'http';

const http = createServer();
ds.attach(http);
http.listen(3000);
```

## RPC Handlers

Register typed request/response handlers. The client calls them with `client.rpc()`.

```typescript
ds.rpc.register<{ userId: string }, { name: string; email: string }>(
  'getUser',
  async (params, ctx) => {
    // ctx.auth — the authenticated user's identity
    // ctx.connectionId — unique connection ID
    // ctx.connection — full ConnectionContext (metadata, tags, get/set)
    console.log(`User ${ctx.auth?.userId} is looking up ${params.userId}`);
    return { name: 'Alice', email: 'alice@example.com' };
  },
);
```

> **Tutorial:** [RPC — Call the Server, Get a Response](tutorials.md#2-rpc--call-the-server-get-a-response)

## Server → Client Live State

The most powerful pattern: mutate a data structure on the server, and every connected client sees a live mirror. Only the JSON Patch diff is sent.

```typescript
// Initial state
await ds.setState('dashboard', { visitors: 0, active: 0 });

// Update later — datasole diffs automatically
setInterval(async () => {
  await ds.setState('dashboard', {
    visitors: getVisitorCount(),
    active: getActiveCount(),
  });
}, 1000);
```

Clients subscribe with `client.subscribeState('dashboard', handler)` — no polling, no event mapping, no client-side state management.

> **Tutorial:** [Live State — A Server-Synced Dashboard](tutorials.md#4-live-state--a-server-synced-dashboard) — the most common datasole pattern

## Events

```typescript
// Listen for client events
ds.events.on<{ text: string }>('chat:message', ({ data }) => {
  console.log('Received:', data.text);
});

// Broadcast to all connected clients
ds.broadcast('notification', { title: 'Server restarting in 5 minutes' });

// Unsubscribe
ds.events.off('chat:message', handler);
```

> **Tutorial:** [Server Events — A Live Stock Ticker](tutorials.md#3-server-events--a-live-stock-ticker)

## Sync Channels

Fine-grained control over when state updates are flushed to clients.

```typescript
// Immediate: every update pushes instantly
const alerts = ds.createSyncChannel({
  key: 'alerts',
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'immediate' },
});

// Batched: accumulate, flush every 200ms or 50 ops
const metrics = ds.createSyncChannel({
  key: 'metrics',
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'batched', batchIntervalMs: 200, maxBatchSize: 50 },
});

// Debounced: wait for 500ms of quiet before flushing
const form = ds.createSyncChannel({
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
// Restore session on reconnect (pass ConnectionContext, not RpcContext)
const state = await ds.sessions.restore(ctx.connection);

// Read/write session values
ds.sessions.set('user-123', 'lastPage', '/dashboard');
const page = ds.sessions.get<string>('user-123', 'lastPage');

// Listen for session changes (e.g., to update a leaderboard)
ds.sessions.onChange((userId, key, value, version) => {
  console.log(`${userId} → ${key} = ${JSON.stringify(value)} (v${version})`);
});
```

> **Tutorial:** [Session Persistence — Surviving Reconnections](tutorials.md#8-session-persistence--surviving-reconnections)

## Concurrency Models

Choose how connections are handled. Each WebSocket maps 1:1 to a worker.

```typescript
const ds = new DatasoleServer<AppContract>({
  executor: { model: 'thread-pool', poolSize: 4 },
});
```

| Model         | Description                                            | When to Use                            |
| ------------- | ------------------------------------------------------ | -------------------------------------- |
| `async`       | Single event loop, all connections in-process          | I/O-bound: chat, notifications         |
| `thread`      | New `worker_threads` per connection                    | CPU-bound: game logic, computation     |
| `thread-pool` | Fixed pool, least-connections assignment **(default)** | General-purpose, good default          |
| `process`     | `child_process` fork per connection, IPC               | Multi-tenant isolation, untrusted code |

All models are cluster-friendly — no shared mutable state in the main process. Works with `pm2 cluster` out of the box.

> **Tutorial:** [Production — Thread Pool, Rate Limiting, Redis, Metrics](tutorials.md#9-production--thread-pool-rate-limiting-redis-metrics)

## Rate Limiting

Frame-level rate limiting on persistent WebSocket connections. Rate limiting uses a `BackendRateLimiter` backed by the configured `StateBackend`, so it is automatically distributed when using Redis or Postgres.

```typescript
import { DatasoleServer } from 'datasole/server';

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
    // Access any header from the upgrade request
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return { authenticated: false };

    // Verify token (your logic)
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
ds.rpc.register('protectedMethod', async (params, ctx) => {
  if (!ctx.auth?.roles?.includes('admin')) {
    throw new Error('Forbidden');
  }
  // ctx.connection.userId, ctx.connection.metadata, etc.
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
ds.attach(httpServer);
httpServer.listen(3000);
```

### NestJS

```typescript
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer<AppContract>();
ds.attach(app.getHttpServer());
```

### Native HTTP

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const server = createServer();
new DatasoleServer<AppContract>().attach(server);
server.listen(3000);
```

## Full Method Reference

| Method                                      | Description                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `attach(httpServer, adapter?)`              | Attach to HTTP server (adapter accepted but currently unused)           |
| `setState<T>(key, value)`                   | Set state, diff, and broadcast patches. Returns `Promise<StatePatch[]>` |
| `getState<T>(key)`                          | Get current state. Returns `Promise<T \| undefined>`                    |
| `createSyncChannel<T>(config)`              | Create a sync channel with configurable flush                           |
| `getSyncChannel(key)`                       | Get existing sync channel                                               |
| `createDataChannel<T>(config)`              | Create a data channel for bidirectional data flow                       |
| `getDataChannel(key)`                       | Get existing data channel                                               |
| `sessions.snapshot(ctx)`                    | Snapshot session from persistence (`ctx` is `ConnectionContext`)        |
| `sessions.restore(ctx)`                     | Restore session on reconnect (`ctx` is `ConnectionContext`)             |
| `sessions.set(userId, key, value)`          | Set session value (auto-flushes)                                        |
| `sessions.get<T>(userId, key)`              | Get session value                                                       |
| `sessions.onChange(handler)`                | Listen for session mutations. Returns unsubscribe `() => void`          |
| `rpc.register<TReq, TRes>(method, handler)` | Register typed RPC handler                                              |
| `events.on<T>(event, handler)`              | Listen for client events                                                |
| `events.off<T>(event, handler)`             | Unsubscribe                                                             |
| `broadcast(event, data)`                    | Send event to all clients                                               |
| `crdt.registerByType(key, crdt)`            | Register a CRDT instance by key                                         |
| `crdt.getState(key)`                        | Get current CRDT state for a key                                        |
| `getConnectionCount()`                      | Number of currently connected clients                                   |
| `metrics.snapshot()`                        | Get current metrics snapshot                                            |
| `getRateLimiter()`                          | Access rate limiter                                                     |
| `getExecutor()`                             | Access connection executor                                              |
| `close()`                                   | Flush sessions, shut down workers, close. Returns `Promise<void>`       |

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
import {
  DatasoleServer,
  MemoryBackend,
  PrometheusExporter,
  MemoryRateLimiter,
} from 'datasole/server';

const ds = new DatasoleServer({
  path: '/__ds',                // WebSocket path (default: /__ds)

  authHandler: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return { authenticated: !!token, userId: token };
  },

  stateBackend: new MemoryBackend(),           // or RedisBackend, PostgresBackend
  metricsExporter: new PrometheusExporter(),

  concurrency: {                // See "Concurrency Models" below
    model: 'thread-pool',      // 'async' | 'thread' | 'thread-pool' | 'process'
    poolSize: 4,
  },

  rateLimiter: new MemoryRateLimiter(),   // or RedisRateLimiter
  rateLimit: {
    defaultRule: { windowMs: 60_000, maxRequests: 200 },
    rules: { 'heavy-rpc': { windowMs: 60_000, maxRequests: 10 } },
  },

  session: {
    flushThreshold: 10,         // Persist after N mutations
    flushIntervalMs: 5000,      // Or every N ms
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
ds.rpc<{ userId: string }, { name: string; email: string }>('getUser', async (params, ctx) => {
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
ds.on<{ text: string }>('chat:message', (data) => {
  console.log('Received:', data.text);
});

// Broadcast to all connected clients
ds.broadcast('notification', { title: 'Server restarting in 5 minutes' });

// Unsubscribe
ds.off('chat:message', handler);
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
// Restore session on reconnect
const state = await ds.restoreSession(ctx);

// Read/write session values
ds.setSessionValue('user-123', 'lastPage', '/dashboard');
const page = ds.getSessionValue<string>('user-123', 'lastPage');

// Listen for session changes (e.g., to update a leaderboard)
ds.onSessionChange((userId, key, value, version) => {
  console.log(`${userId} → ${key} = ${JSON.stringify(value)} (v${version})`);
});
```

> **Tutorial:** [Session Persistence — Surviving Reconnections](tutorials.md#8-session-persistence--surviving-reconnections)

## Concurrency Models

Choose how connections are handled. Each WebSocket maps 1:1 to a worker.

```typescript
const ds = new DatasoleServer({
  concurrency: { model: 'thread-pool', poolSize: 4 },
});
```

| Model | Description | When to Use |
|---|---|---|
| `async` | Single event loop, all connections in-process | I/O-bound: chat, notifications |
| `thread` | New `worker_threads` per connection | CPU-bound: game logic, computation |
| `thread-pool` | Fixed pool, least-connections assignment **(default)** | General-purpose, good default |
| `process` | `child_process` fork per connection, IPC | Multi-tenant isolation, untrusted code |

All models are cluster-friendly — no shared mutable state in the main process. Works with `pm2 cluster` out of the box.

> **Tutorial:** [Production — Thread Pool, Rate Limiting, Redis, Metrics](tutorials.md#9-production--thread-pool-rate-limiting-redis-metrics)

## Rate Limiting

Frame-level rate limiting on persistent WebSocket connections.

```typescript
import { MemoryRateLimiter, RedisRateLimiter } from 'datasole/server';

// In-memory (single process)
const limiter = new MemoryRateLimiter();

// Redis (clustered)
const limiter = new RedisRateLimiter({ prefix: 'ds:rl:' });

const ds = new DatasoleServer({
  rateLimiter: limiter,
  rateLimit: {
    defaultRule: { windowMs: 60_000, maxRequests: 100 },
    rules: {
      'search': { windowMs: 60_000, maxRequests: 30 },
      'upload': { windowMs: 60_000, maxRequests: 5 },
    },
  },
});
```

## Authentication

Hook into the HTTP upgrade request to authenticate connections. Supports any auth scheme (JWT, OAuth, SSO, API keys).

```typescript
const ds = new DatasoleServer({
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
ds.rpc('protectedMethod', async (params, ctx) => {
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
const ds = new DatasoleServer();
ds.attach(httpServer);
httpServer.listen(3000);
```

### NestJS

```typescript
import { DatasoleNestAdapter, DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();
app.useWebSocketAdapter(new DatasoleNestAdapter(ds));
```

### Native HTTP

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const server = createServer();
new DatasoleServer().attach(server);
server.listen(3000);
```

## Full Method Reference

| Method | Description |
|---|---|
| `attach(httpServer, adapter?)` | Attach to HTTP server |
| `setState<T>(key, value)` | Set state (diffs and broadcasts patches) |
| `getState<T>(key)` | Get current state |
| `createSyncChannel<T>(config)` | Create a sync channel with configurable flush |
| `getSyncChannel(key)` | Get existing sync channel |
| `snapshotSession(ctx)` | Snapshot session from persistence |
| `restoreSession(ctx)` | Restore session on reconnect |
| `setSessionValue(userId, key, value)` | Set session value (auto-flushes) |
| `getSessionValue<T>(userId, key)` | Get session value |
| `onSessionChange(handler)` | Listen for session mutations |
| `rpc<TReq, TRes>(method, handler)` | Register typed RPC handler |
| `on<T>(event, handler)` | Listen for client events |
| `off<T>(event, handler)` | Unsubscribe |
| `broadcast(event, data)` | Send event to all clients |
| `getMetrics()` | Access metrics collector |
| `getRateLimiter()` | Access rate limiter |
| `getConcurrency()` | Access concurrency strategy |
| `close()` | Flush sessions, shut down workers, close connections |

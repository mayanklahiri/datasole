---
title: Developer Guide
description: Contract-first setup guide with server/client integrations and configuration references.
---

# Developer Guide

This guide is for experienced TypeScript developers integrating datasole into production apps.

**Why contract-first:** The wire protocol is generic; types live in your app. A single `AppContract` gives you end-to-end RPC/event/state typing, refactors that follow renames, and fewer “stringly typed” bugs between server handlers and browser calls. It also documents the API your team actually ships.

## Quick Path

1. Define one shared `AppContract`.
2. Attach `DatasoleServer<AppContract>` to your HTTP server.
3. Connect `DatasoleClient<AppContract>` in the browser.
4. Add RPC, events, live state, and CRDT flows incrementally.

That order matters: the contract is cheap to iterate on before you invest in auth, backends, or scaling. Primitives share one server instance and one `StateBackend`, so production choices (Redis vs memory, rate-limit keys, metrics) stay localized in server construction.

## 1) Define the App Contract first

`DatasoleContract` is the single source of truth for RPC method names, event payloads, and state shapes. Keeping enums for method/event/state keys avoids drift between client and server bundles and makes logging and rate-limit rules readable.

```ts
import type { DatasoleContract } from 'datasole';

export enum RpcMethod {
  GetUser = 'getUser',
}
export enum Event {
  ChatMessage = 'chat:message',
}
export enum StateKey {
  Dashboard = 'dashboard',
}

export interface AppContract extends DatasoleContract {
  rpc: {
    [RpcMethod.GetUser]: {
      params: { id: string };
      result: { id: string; name: string };
    };
  };
  events: {
    [Event.ChatMessage]: { roomId: string; text: string };
  };
  state: {
    [StateKey.Dashboard]: { onlineUsers: number; queueDepth: number };
  };
}
```

Use the same contract in both places:

```ts
// server
const ds = new DatasoleServer<AppContract>();

// client
const client = new DatasoleClient<AppContract>({ url: 'ws://localhost:3000' });
```

Helper types:

- `RpcParams<T, K>`
- `RpcResult<T, K>`
- `EventData<T, K>`
- `StateValue<T, K>`

## 2) Set up the server

`DatasoleServer` composes transport, frame execution, and primitives (RPC, events, state, CRDT, sessions, sync). You attach it to an existing Node HTTP server so it works beside REST, GraphQL, or static hosting on the same port—no second listen port for realtime unless you want one.

```ts
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const httpServer = createServer();
const ds = new DatasoleServer<AppContract>();

ds.attach(httpServer);
httpServer.listen(3000);
```

- Default WS path: `/__ds`
- Runtime assets are auto-served by datasole at:
  - `/__ds/datasole.iife.min.js`
  - `/__ds/datasole-worker.iife.min.js`
- Server options: [Server API](server.md#configuration-reference), [Configuration Reference](configuration.md#server-options)

### Server framework patterns

#### Express

```ts
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const app = express();
const httpServer = createServer(app);
const ds = new DatasoleServer<AppContract>();
ds.attach(httpServer);
httpServer.listen(3000);
```

#### NestJS

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DatasoleServer } from 'datasole/server';

const app = await NestFactory.create(AppModule);
const ds = new DatasoleServer<AppContract>();
ds.attach(app.getHttpServer());
await app.listen(3000);
```

#### Fastify

```ts
import Fastify from 'fastify';
import { DatasoleServer } from 'datasole/server';

const app = Fastify();
await app.listen({ port: 3000 });

const ds = new DatasoleServer<AppContract>();
ds.attach(app.server);
```

### Register primitives

```ts
ds.rpc.register(RpcMethod.GetUser, async ({ id }) => ({ id, name: 'alice' }));

ds.events.on(Event.ChatMessage, (payload) => {
  console.log(payload.data.text);
});

await ds.setState(StateKey.Dashboard, { onlineUsers: 0, queueDepth: 0 });
```

## 3) Set up the client

```ts
import { DatasoleClient } from 'datasole/client';

const client = new DatasoleClient<AppContract>({
  url: `ws://${window.location.host}`,
  path: '/__ds',
  useWorker: true,
});

await client.connect();
```

The client keeps a single WebSocket and multiplexes RPC, events, state, and CRDT on the shared protocol—one connection to provision through proxies and firewalls. `useWorker: true` (default) moves frame handling off the main thread; disable it only where Workers are unavailable so you do not block UI on decode work.

- `useWorker: true` is default and recommended.
- For SSR/React Native/non-worker runtimes, use `useWorker: false`.
- Client options: [Client API](client.md#constructor), [Configuration Reference](configuration.md#client-options)

### Client framework patterns

#### React

```tsx
const clientRef = useRef<DatasoleClient<AppContract> | null>(null);

useEffect(() => {
  const client = new DatasoleClient<AppContract>({ url: `ws://${window.location.host}` });
  clientRef.current = client;
  client.connect();
  return () => void client.disconnect();
}, []);
```

#### Vue 3

```ts
const ds = shallowRef<DatasoleClient<AppContract> | null>(null);

onMounted(() => {
  const client = new DatasoleClient<AppContract>({ url: `ws://${window.location.host}` });
  ds.value = client;
  client.connect();
});
onUnmounted(() => {
  ds.value?.disconnect();
  ds.value = null;
});
```

For the Vue+NestJS demo specifically, the composable sets `workerUrl: '/datasole-worker.iife.min.js'` to match Nest static middleware routing during dev/prod. In generic integrations, keep the default `workerUrl` (`${path}/datasole-worker.iife.min.js`).

#### Vanilla JS

The IIFE global does not carry TypeScript generics. Either add a tiny **`client.mjs`** bundle that imports `DatasoleClient` from `datasole/client` and `AppContract` from `./shared/contract.ts` (see `demos/vanilla`), or use the global and keep the same **string values** as your `RpcMethod` / `Event` / `StateKey` enums.

```html
<script src="/__ds/datasole.iife.min.js"></script>
<script>
  const client = new Datasole.DatasoleClient({ url: `ws://${location.host}` });
  client.connect();
</script>
```

## 4) Configuration reference

Use [Configuration Reference](configuration.md) for all server and client options. Prefer env-driven `backendConfig` when the same image runs in dev/staging/prod with different URLs—one code path, fewer accidental hardcodes.

## 5) Next steps

Once connected, pick primitives by use case:

- RPC: [Server RPC Handlers](server.md#rpc-handlers), [Client RPC](client.md#rpc-call-the-server)
- Events: [Server Events](server.md#events), [Client Events](client.md#events-send-and-receive)
- Live state: [Server Live State](server.md#server-client-live-state), [Client Live State](client.md#live-state-server-synced-data)
- CRDT: [Server CRDT API](server.md#full-method-reference), [Client CRDTs](client.md#crdts-bidirectional-sync)
- Sessions/auth/rate limits: [Server API](server.md)

For architecture-level composition, see [Architecture](architecture.md) and [Composability](composability.md). For progressive build-up, use [Tutorials](tutorials.md).

---

## Advanced topics

These sections explain **extension points** in the current server API: what is swappable, what is configuration-only, and how to reason about cost, durability, and operations.

### Custom `StateBackend` (multi-store and “bring your own database”)

**Why one backend:** `DatasoleServer` takes a single `stateBackend`. State, sessions, CRDT metadata, event routing, sync channels, and the built-in rate limiter all read/write through that interface. That keeps clustering story simple: swap memory for Redis (or Postgres) and every primitive becomes distributed together.

**The interface** (see [State Backends](state-backends.md)) requires key/value `get` / `set` / `delete`, plus `subscribe` / `publish` for live updates. Implementations must be safe for concurrent callers; `publish` should notify local subscribers after a successful `set` when you are emulating “write then notify” semantics.

**Lifecycle:** Built-in Redis and Postgres backends expose `connect()` you must await before creating the server. For your own class, follow the same pattern: connect pools, run migrations if needed, then pass the instance to `new DatasoleServer({ stateBackend })`. On shutdown, close clients in `process` `beforeExit` or your framework’s hook—datasole destroys rate limiter state but does not own your DB pool.

**Composite / tiered patterns (Postgres + Redis, MySQL + Memcached, etc.):** The product does not ship a two-tier backend. If you want **hot cache + cold store**, implement a **facade** `StateBackend` that:

- Routes some key prefixes to Redis (or Memcached via a thin adapter) and others to SQL, **or**
- Uses Redis for everything in production for latency, with asynchronous export to Postgres for analytics (your responsibility—outside the contract).

Keep in mind **subscribe/publish** must still work for keys you care about live: either implement pub/sub on the fast tier only, or forward notifications from the durable tier (e.g. Postgres `LISTEN`/`NOTIFY` like the built-in `PostgresBackend`, or polling for serverless constraints—see below).

**Enterprise-oriented examples (conceptual):**

| Stack                                 | Fit                                    | Notes                                                                                                                                                                                                                       |
| ------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Postgres (RDS, Cloud SQL, Aurora)** | Durable state, LISTEN/NOTIFY           | Use built-in `PostgresBackend`; same pattern works for **Supabase** and **Neon**—they expose Postgres wire protocol; point `connectionString` at the pooler URL.                                                            |
| **Redis (ElastiCache, Memorystore)**  | Low-latency, pub/sub, horizontal scale | Use built-in `RedisBackend`; typical for multi-node Node fleets.                                                                                                                                                            |
| **Postgres + Redis (composite)**      | Durability + speed                     | Custom facade: e.g. write-through cache with Redis handling `subscribe` for hot keys; document which keys live where.                                                                                                       |
| **MongoDB**                           | Document-native ops teams              | Implement `StateBackend`; use **change streams** or a capped notification collection to drive `publish`/`subscribe`.                                                                                                        |
| **DynamoDB**                          | Pay-per-request, regional HA           | Implement `StateBackend` with string keys; **pub/sub is the hard part**—options include DynamoDB Streams + Lambda fan-in (complex), or pairing with SNS/SQS/ElastiCache for notifications only on keys that need live sync. |
| **Serverless / cost-sensitive**       | Spiky traffic, minimal idle cost       | Prefer **managed Postgres** (scale-to-zero providers) or **Dynamo** + explicit tradeoffs on live fan-out; avoid running Redis unless steady load justifies it.                                                              |

**Serialization:** Built-in backends JSON-encode values. If your store is strongly typed, still accept the same shapes the server writes (`unknown` in handlers). Rate limiter keys use prefix `rl:` and store sliding-window structs—any custom backend must preserve `get`/`set` semantics for those keys if you rely on built-in rate limiting.

Full interface and minimal custom stub: [State Backends — Custom](state-backends.md#custom-backends).

### Custom authentication (`authHandler`)

**Where it runs:** Authentication happens on the **HTTP upgrade** request (`IncomingMessage`), before the WebSocket is established. Return `{ authenticated: false }` to reject with **401**; return `{ authenticated: true, userId, roles?, metadata? }` to accept.

**Why this shape:** `userId` and `roles` flow into per-connection context so RPC handlers can authorize without re-parsing tokens on every frame. `metadata` is for opaque claims (tenant id, plan tier) you do not want to model as roles.

**Typical patterns:**

- **Bearer JWT:** Read `Authorization`, verify signature and expiry, map `sub` → `userId`, map `scope`/`realm_access` → `roles`.
- **Session cookie:** Parse signed cookie, load session from your store (can reuse the same `StateBackend` via a separate client, or your ORM).
- **mTLS / internal mesh:** Use `req.socket` peer cert metadata in the handler when the edge terminates TLS and forwards client cert headers.

**Caveats:** The default handler is permissive (anonymous `userId` from remote address)—replace it for any exposed deployment. Throwing inside `authHandler` is treated as failure to authenticate; prefer explicit `{ authenticated: false }` for clarity.

### Rate limiting (configuration + backend, not a pluggable limiter class)

The server uses an internal **`BackendRateLimiter`** backed by the same `StateBackend`. There is **no** `rateLimiter: custom` option today—customization is **rules + keys + storage**.

**What you can configure (`rateLimit` in server options):**

- `defaultRule` — sliding window (`windowMs`, `maxRequests`).
- `rules` — optional per-RPC-method overrides (method names as strings).
- `keyExtractor` — derive the limit bucket from `connectionId` and optional method (e.g. per-user id if you thread it through connection identity).

**Why this design:** Distributed rate limits require shared counters; reusing `StateBackend` avoids a second Redis client and keeps limits consistent with cluster size when you use Redis or Postgres.

**“Custom” rate limiting in practice:**

- **Different windows per customer tier:** Use `keyExtractor` to prefix keys with tenant or plan id (ensure `userId` is set in `authHandler` first).
- **Exotic storage (DynamoDB, etc.):** Implement `StateBackend` so `get`/`set`/`delete` for keys like `rl:<bucket>` behave like the built-in backends; the limiter’s window object must round-trip through your store.
- **Algorithm changes (token bucket, fixed window):** Not supported via config; the internal limiter is fixed. You would need a fork or upstream contribution—do not assume a drop-in interface on `DatasoleServer`.

### Custom metrics (how much is too much?)

**Not too flexible:** The extension surface is intentionally small. Implement **`MetricsExporter`** (`export(snapshot: MetricsSnapshot): Promise<string>`) and pass `metricsExporter` to `DatasoleServer`. Use that to push to a vendor agent, write NDJSON, or adapt to an internal schema. Built-in **Prometheus** and **OpenTelemetry** exporters cover most production cases—see [Metrics](metrics.md).

**When a custom exporter helps:** You already standardize on StatsD, CloudWatch EMF, or a sidecar that expects a specific text format. Implement `export`, return your payload string, and expose it from your HTTP stack the same way the Prometheus example attaches `/metrics`.

**When to stop:** Avoid re-deriving business KPIs inside the exporter—the snapshot is **transport-level** (connections, bytes, RPC counts, errors). Application metrics belong in your usual observability layer, not inside datasole’s exporter hook.

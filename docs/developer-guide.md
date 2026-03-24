---
title: Developer Guide
description: Integration-first guide for experienced TypeScript developers adding datasole to existing full-stack apps.
---

# Developer Guide

This guide is for intermediate/advanced TypeScript full-stack developers who want to add realtime features to an existing app (or a minimal TypeScript app).

The fastest path is:

1. Wire the server in your existing HTTP process.
2. Define a shared app contract.
3. Connect the client with that same contract.
4. Add realtime primitives (RPC/events/state/CRDT) incrementally.

## 1) Start server-side integration first

Create `DatasoleServer` in the same Node.js process that owns your HTTP server, then call `attach(httpServer)`.

```ts
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import type { DatasoleContract } from 'datasole';

interface AppContract extends DatasoleContract {
  rpc: {
    getUser: { params: { id: string }; result: { id: string; name: string } };
  };
  events: {
    'chat:message': { roomId: string; text: string };
  };
  state: {
    dashboard: { onlineUsers: number; queueDepth: number };
  };
}

const httpServer = createServer();
const ds = new DatasoleServer<AppContract>();
ds.attach(httpServer);
httpServer.listen(3000);
```

- Default WebSocket path is `/__ds`.
- `attach()` can be called before or after `listen()`, as long as it is attached to the same HTTP server instance.
- Full server options are documented in [Server: Configuration Reference](server.md#configuration-reference).

### When to instantiate `DatasoleServer`

- Instantiate once during server bootstrap (the same place you initialize HTTP framework middleware and infrastructure clients).
- Keep it as a process-level singleton per Node process.
- Reuse existing app lifecycle hooks for graceful shutdown.

### Integrate into common server frameworks

Use the framework-specific patterns in [Integrations](integrations.md):

- Plain Node.js (`http.createServer`)
- Express
- NestJS
- Fastify
- Other adapters and integration patterns

If you need API-level details after wiring, continue in [Server API](server.md).

## 2) Define and share your `AppContract`

`DatasoleContract` is the base shape. Your app defines `AppContract` by filling in `rpc`, `events`, and `state` keys.

That one contract is used by both server and client generics:

- `new DatasoleServer<AppContract>()`
- `new DatasoleClient<AppContract>()`

Type helpers for extracting method/event/state shapes are documented in [Shared](shared.md):

- `RpcParams<T, K>`
- `RpcResult<T, K>`
- `EventData<T, K>`
- `StateValue<T, K>`

## 3) Then wire the client with the same contract

Once the server is attached, create one `DatasoleClient<AppContract>` per browser app runtime and connect it.

```ts
import { DatasoleClient } from 'datasole/client';

const client = new DatasoleClient<AppContract>({
  url: 'ws://localhost:3000',
  path: '/__ds',
  useWorker: true,
  workerUrl: '/datasole-worker.iife.min.js',
});

client.connect();
```

- `useWorker: true` is the default and recommended.
- For environments without Web Worker support (for example SSR or React Native), use `useWorker: false`.
- Full client constructor and connection options are in [Client API](client.md#datasoleclient).
- Worker architecture details are in [Client: Worker Architecture](client.md#worker-architecture).

### Client integration patterns by frontend framework

See [Integrations](integrations.md) for React, Vue, Next.js/Express, and other framework patterns.

If you need the full client method reference, continue in [Client API](client.md).

## 4) Next steps: add realtime primitives

Once `DatasoleServer` and `DatasoleClient` are connected, pick primitives by use case:

- RPC: [Server RPC Handlers](server.md#rpc-handlers) and [Client RPC](client.md#rpc-call-the-server)
- Events: [Server Events](server.md#events) and [Client Events](client.md#events-send-and-receive)
- Live state: [Server Live State](server.md#server-client-live-state) and [Client Live State](client.md#live-state-server-synced-data)
- CRDT sync: [Server CRDT API](server.md#full-method-reference) and [Client CRDTs](client.md#crdts-bidirectional-sync)
- Sync tuning, sessions, auth, rate limits: [Server API](server.md)

For architecture-level composition patterns, see [Composability](composability.md) and [Architecture](architecture.md).  
For a step-by-step build-up, follow [Tutorials](tutorials.md).

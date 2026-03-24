---
title: Developer Guide
description: Contract-first setup guide with server/client integrations and configuration references.
---

# Developer Guide

This guide is for experienced TypeScript developers integrating datasole into production apps.

## Quick Path

1. Define one shared `AppContract`.
2. Attach `DatasoleServer<AppContract>` to your HTTP server.
3. Connect `DatasoleClient<AppContract>` in the browser.
4. Add RPC, events, live state, and CRDT flows incrementally.

## 1) Define the App Contract first

`DatasoleContract` is the single source of truth for RPC methods, event payloads, and state shapes.

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

```html
<script src="/__ds/datasole.iife.min.js"></script>
<script>
  const client = new Datasole.DatasoleClient({ url: `ws://${location.host}` });
  client.connect();
</script>
```

## 4) Configuration reference

Use [Configuration Reference](configuration.md) for all server and client options.

## 5) Next steps

Once connected, pick primitives by use case:

- RPC: [Server RPC Handlers](server.md#rpc-handlers), [Client RPC](client.md#rpc-call-the-server)
- Events: [Server Events](server.md#events), [Client Events](client.md#events-send-and-receive)
- Live state: [Server Live State](server.md#server-client-live-state), [Client Live State](client.md#live-state-server-synced-data)
- CRDT: [Server CRDT API](server.md#full-method-reference), [Client CRDTs](client.md#crdts-bidirectional-sync)
- Sessions/auth/rate limits: [Server API](server.md)

For architecture-level composition, see [Architecture](architecture.md) and [Composability](composability.md). For progressive build-up, use [Tutorials](tutorials.md).

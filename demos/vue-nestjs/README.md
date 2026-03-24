# Vue 3 + NestJS Demo

Vue 3 SFC frontend with Vite 8, NestJS 11 backend — connected via datasole WebSocket with Web Worker transport and Pako compression.

## The Vue SFC Experience

This demo showcases how datasole's reactive data model integrates natively with Vue's reactivity system — **no Vuex, no Pinia, no state store at all.** The server is the store.

Three composables replace an entire state layer:

```vue
<script setup lang="ts">
// Server event → reactive ref. Updates arrive off-thread via Web Worker.
const metrics = useDatasoleEvent<Metrics>('system-metrics');

// Server state → reactive ref. Synced via JSON Patch over the wire.
const messages = useDatasoleState<ChatMessage[]>('chat:messages');

// Raw client for imperative calls (emit, rpc).
const ds = useDatasoleClient();
</script>

<template>
  <!-- Bind directly in your template — they're just refs -->
  <p>{{ metrics?.connections }} connected</p>
  <div v-for="msg in messages" :key="msg.id">{{ msg.text }}</div>
  <button @click="ds?.rpc('randomNumber', { min: 1, max: 100 })">Roll</button>
</template>
```

Computed properties compose naturally:

```typescript
const memoryPct = computed(() =>
  Math.round((metrics.value!.memoryMB / (metrics.value!.totalMemoryGB * 1024)) * 100),
);
```

Everything works because datasole updates `ref.value` from the Web Worker thread — Vue's reactivity system picks it up instantly and re-renders only what changed. The main thread stays free for smooth 60 fps animations.

## Quickstart

```bash
# from repo root — build datasole first
npm run build

# install & run dev
cd demos/vue-nestjs
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) (Vite dev server proxies WebSocket to NestJS on 4002).

## Production

```bash
npm run build
npm start
```

Then open [http://localhost:4002](http://localhost:4002).

## Stack

| Layer   | Technology                   |
| ------- | ---------------------------- |
| Server  | NestJS 11 + `DatasoleServer` |
| Client  | Vue 3 SFC + Vite 8           |
| Bundler | Vite 8                       |
| Types   | TypeScript 6 (strict)        |

## Ports

- **Dev**: Vite on `5174`, NestJS on `4002` (proxied via Vite)
- **Prod**: NestJS on `4002` serves built client via `@nestjs/serve-static`

Override backend port with `PORT` env var.

## Server-Side Integration

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DatasoleServer } from 'datasole/server';

const app = await NestFactory.create(AppModule);

// Serve datasole worker IIFE for web worker transport
const expressApp = app.getHttpAdapter().getInstance();
expressApp.get('/datasole-worker.iife.min.js', (_req, res) => {
  res.sendFile(workerPath);
});

// Attach datasole to NestJS's underlying HTTP server
const ds = new DatasoleServer();
ds.attach(app.getHttpServer());

await app.listen(4002);
```

Key points:

- `DatasoleServer` defaults to `thread-pool` concurrency with 4 Node.js `worker_threads`
- `reflect-metadata` must be imported **before** any NestJS code
- `app.getHttpServer()` returns the raw Node.js `http.Server` — this is what `ds.attach()` expects
- The worker file route is registered via the Express adapter, **before** NestJS handles requests
- `@nestjs/serve-static` serves the Vite-built client from `dist/client/` in production

## Client-Side Integration

The `useDatasole()` composable (called once at the app root) creates the client, connects, and provides it to all descendants via `inject()`:

```typescript
// App.vue
import { useDatasole } from './composables/useDatasole';
useDatasole(); // once at root — provides client to entire tree
```

Child components consume data with zero boilerplate:

```typescript
// Any child SFC
const metrics = useDatasoleEvent<Metrics>('system-metrics'); // server broadcasts → ref
const messages = useDatasoleState<ChatMsg[]>('chat:messages'); // server state → ref
const ds = useDatasoleClient(); // raw client for emit/rpc
const conn = useConnectionState(); // 'connected' | 'disconnected' | ...
```

No context wrapper components, no store modules, no actions/mutations. The composable returns a reactive `Ref` that updates when the server pushes data. Bind it in your template and forget about it.

## Vite Dev Proxy

In `vite.config.ts`, two paths are proxied to the NestJS backend:

```typescript
proxy: {
  '/__ds': { target: 'http://localhost:4002', ws: true },
  '/datasole-worker.iife.min.js': { target: 'http://localhost:4002' },
}
```

- `/__ds` — WebSocket upgrade for the datasole connection
- `/datasole-worker.iife.min.js` — Worker script fetched by the browser

## Framework Quirks

- `reflect-metadata` must be imported before any NestJS code
- `tsconfig.server.json` enables `experimentalDecorators` and `emitDecoratorMetadata` (required by NestJS decorators)
- `@nestjs/serve-static` is used in production to serve the Vite-built client from `dist/client/`
- Datasole attaches directly to the raw `http.Server` via `app.getHttpServer()` — no NestJS WebSocket gateway needed
- Worker file route must be registered via `app.getHttpAdapter().getInstance()` before static file serving kicks in

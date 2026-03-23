# Vue 3 + NestJS Demo

Vue 3 SFC frontend with Vite, NestJS backend, connected via datasole WebSocket.

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
| Client  | Vue 3 SFC + Vite             |
| Bundler | Vite 6                       |
| Types   | TypeScript 5 (strict)        |

## Port

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
// Default: thread-pool concurrency (4 Node.js worker_threads)
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

```typescript
import { DatasoleClient } from 'datasole/client';

const client = new DatasoleClient({
  url: `ws://${window.location.host}`,
  // useWorker: true (default) — WebSocket runs in Web Worker
  // workerUrl: '/datasole-worker.iife.min.js' (default)
});
client.connect();
```

The `useDatasole` composable manages the client lifecycle:

```typescript
const { ds, connectionState } = useDatasole();
// ds is a shallowRef<DatasoleClient | null>, available after mount
// connectionState tracks 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
```

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

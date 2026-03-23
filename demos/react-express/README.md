# React + Express Demo

React 19 frontend with Vite, Express backend, connected via datasole WebSocket.

## Quickstart

```bash
# from repo root — build datasole first
npm run build

# install & run dev
cd demos/react-express
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (Vite dev server proxies WebSocket to Express on 4001).

## Production

```bash
npm run build
npm start
```

Then open [http://localhost:4001](http://localhost:4001).

## Stack

| Layer   | Technology                   |
| ------- | ---------------------------- |
| Server  | Express 5 + `DatasoleServer` |
| Client  | React 19 + Vite              |
| Bundler | Vite 6                       |
| Types   | TypeScript 5 (strict)        |

## Port

- **Dev**: Vite on `5173`, Express on `4001` (proxied via Vite)
- **Prod**: Express on `4001` serves built client

Override backend port with `PORT` env var.

## Server-Side Integration

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const app = express();

// Serve the datasole worker IIFE for web worker transport
const dsWorkerPath = resolve(
  __dirname,
  '../node_modules/datasole/dist/client/datasole-worker.iife.min.js',
);
app.get('/datasole-worker.iife.min.js', (_req, res) => {
  res.sendFile(dsWorkerPath);
});

// In production, serve Vite-built client
app.use(express.static('dist/client'));

const httpServer = createServer(app);
const ds = new DatasoleServer();
// Default: thread-pool concurrency (4 Node.js worker_threads)
ds.attach(httpServer);
```

Key points:

- `DatasoleServer` defaults to `thread-pool` concurrency with 4 Node.js `worker_threads`
- The worker IIFE file must be served at `/datasole-worker.iife.min.js` (or a custom path matching `workerUrl`)
- The route for the worker file must appear **before** any catch-all SPA route

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

The `useDatasole` hook manages the client lifecycle:

```typescript
const { ds, connectionState } = useDatasole();
// ds is the DatasoleClient instance, available after mount
// connectionState tracks 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
```

## Vite Dev Proxy

In `vite.config.ts`, two paths are proxied to the Express backend:

```typescript
proxy: {
  '/__ds': { target: 'http://localhost:4001', ws: true },
  '/datasole-worker.iife.min.js': { target: 'http://localhost:4001' },
}
```

- `/__ds` — WebSocket upgrade for the datasole connection
- `/datasole-worker.iife.min.js` — Worker script fetched by the browser

## Notes

- `useDatasole` hook connects on mount, disconnects on unmount
- Production build: `vite build` outputs to `dist/client/`, Express serves it as static files
- Web Worker transport keeps the main thread free for React rendering
- Express 5 uses `/{*splat}` syntax for catch-all routes (not `*`)

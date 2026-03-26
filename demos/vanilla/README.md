# Vanilla JS Demo

Pure browser JavaScript + Node.js HTTP server. Zero frameworks, zero build step, zero dependencies beyond datasole.

This demo proves that datasole works without any build tooling or UI framework — ideal for prototyping, embedding in legacy apps, or learning how datasole works under the hood.

## What It Does

Three panels demonstrate datasole's core data-flow patterns:

| Panel          | Pattern                       | API Used                                                             |
| -------------- | ----------------------------- | -------------------------------------------------------------------- |
| Server Metrics | Server → client broadcast     | `ds.localServer.broadcast(...)` + `ds.on('system-metrics', handler)` |
| Chat Room      | Client ↔ server state sync    | `ds.subscribeState()` + `ds.emit()`                                  |
| RPC Random     | Client → server request/reply | `ds.rpc('randomNumber', { min, max })`                               |

All communication runs over a single WebSocket via a Web Worker (off the main thread).

## Quickstart

```bash
# from repo root — build datasole first
npm run build

# install & run dev (auto-restarts on server changes)
cd demos/vanilla
npm install
npm run dev
```

Open [http://localhost:4000](http://localhost:4000).

## Production

```bash
npm start
```

No build step needed — `client/` files are served directly.

## Stack

| Layer  | Technology                                     |
| ------ | ---------------------------------------------- |
| Server | Node.js `http.createServer` + `DatasoleServer` |
| Client | Vanilla DOM + datasole IIFE bundle             |
| Fonts  | Inter + JetBrains Mono (Google Fonts CDN)      |

## Port

Default `4000`. Override with `PORT` env var:

```bash
PORT=8080 npm start
```

## Server-Side Integration

`server/index.mjs` is a Node.js HTTP server (ESM, no framework):

```javascript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();

// Register event handlers, RPC methods, state, and metrics broadcast
ds.primitives.events.on('chat:send', (payload) => {
  /* ... */
});
ds.rpc.register('randomNumber', async ({ min, max }) => {
  /* ... */
});
await ds.localServer.setState('chat:messages', chatHistory);

// Attach to the raw Node.js HTTP server
const httpServer = createServer(serveStatic);
ds.transport.attach(httpServer);

httpServer.listen(4000);
```

Key points:

- `DatasoleServer` defaults to `thread-pool` concurrency (4 Node.js `worker_threads`)
- `ds.transport.attach(httpServer)` upgrades WebSocket connections on the `/__ds` path
- DatasoleServer auto-serves runtime assets:
  - `/__ds/datasole.iife.min.js` — client IIFE
  - `/__ds/datasole-worker.iife.min.js` — worker IIFE

## Client-Side Integration

`client/index.html` loads the datasole IIFE bundle via a `<script>` tag. The global `Datasole` namespace exposes `DatasoleClient`:

```html
<script src="/__ds/datasole.iife.min.js"></script>
<script>
  const ds = new Datasole.DatasoleClient({
    url: 'ws://' + location.host,
    // useWorker: true (default) — WebSocket runs in a Web Worker
    // workerUrl: '/__ds/datasole-worker.iife.min.js' (default)
  });
  ds.connect();
</script>
```

From there, all three patterns are plain JavaScript:

```javascript
// 1. Listen to broadcast events
ds.on('system-metrics', (ev) => updateDOM(ev.data));

// 2. Subscribe to server-managed state
ds.subscribeState('chat:messages', (messages) => renderMessages(messages));

// 3. Call an RPC method
const result = await ds.rpc('randomNumber', { min: 1, max: 100 });
```

## Testing

This demo is tested as part of the parent project's e2e suite:

```bash
# from repo root
npm run test:e2e:demos
```

The Playwright e2e test:

1. Runs `npm install` in this directory (if `node_modules/` is absent)
2. Starts the server in production mode (`npm start`)
3. Navigates to `http://localhost:4000`
4. Verifies real-time metric updates arrive within 5 seconds
5. Captures screenshots for visual regression

## Notes

- No build step — `client/` files are served directly by the Node.js HTTP server
- `npm run dev` uses `node --watch` for auto-restart on server file changes
- Web Worker transport keeps the main thread free for DOM rendering
- Set `useWorker: false` only for environments without Web Worker support (e.g., SSR)
- The IIFE bundle exposes `window.Datasole` — use this for `<script>`-tag integration

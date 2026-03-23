# Vanilla JS Demo

Pure browser JavaScript + Node.js HTTP server. Zero frameworks, zero build step.

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

```javascript
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();
// Default: thread-pool concurrency (4 workers), no extra config needed
ds.attach(httpServer);
```

The server uses `DatasoleServer` with default `thread-pool` concurrency (4 Node.js `worker_threads`). No additional server config is required.

The Node.js HTTP server explicitly serves two datasole client files from `node_modules/datasole/dist/client/`:

- `/datasole.iife.min.js` — the client IIFE bundle loaded via `<script>` tag
- `/datasole-worker.iife.min.js` — the Web Worker IIFE loaded by the client for off-thread WebSocket

## Client-Side Integration

```html
<script src="/datasole.iife.min.js"></script>
<script>
  const ds = new Datasole.DatasoleClient({
    url: 'ws://' + location.host,
    // useWorker: true (default) — WebSocket runs in Web Worker
    // workerUrl: '/datasole-worker.iife.min.js' (default)
  });
  ds.connect();
</script>
```

The client defaults to `useWorker: true`, offloading the WebSocket connection, binary frame encoding/decoding, and compression to a Web Worker. The worker script is loaded from `/datasole-worker.iife.min.js` (configurable via `workerUrl`).

## Notes

- No build step — `public/` files are served directly
- `npm run dev` uses `node --watch` for auto-restart on server file changes
- Web Worker transport keeps the main thread free for UI rendering
- Set `useWorker: false` only for environments without Web Worker support (e.g., SSR)

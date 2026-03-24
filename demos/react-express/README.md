# React + Express Demo

React 19 frontend with Vite 8, Express 5 backend — connected via datasole WebSocket with Web Worker transport and Pako compression.

## The React Hook Experience

This demo showcases how datasole's reactive data model integrates natively with React hooks — **no Redux, no Zustand, no state store at all.** The server is the store.

Three hooks replace an entire state layer:

```tsx
// Server broadcast events → React state (re-renders on update)
const metrics = useDatasoleEvent<Metrics>('system-metrics');

// Server-managed state → React state (synced via JSON Patch)
const messages = useDatasoleState<ChatMessage[]>('chat:messages');

// Raw client for imperative calls (emit, rpc)
const ds = useDatasoleClient();
```

Derived values compose naturally with `useMemo`:

```tsx
const memoryPct = useMemo(
  () => Math.round((metrics.memoryMB / (metrics.totalMemoryGB * 1024)) * 100),
  [metrics?.memoryMB, metrics?.totalMemoryGB],
);
```

Render directly in JSX — no selectors, no actions, no dispatch:

```tsx
return (
  <>
    <p>{metrics?.connections} connected</p>
    {messages?.map((msg) => (
      <div key={msg.id}>{msg.text}</div>
    ))}
    <button onClick={() => ds?.rpc('randomNumber', { min: 1, max: 100 })}>Roll</button>
  </>
);
```

Everything works because datasole updates state from the Web Worker thread — React re-renders only what changed and the main thread stays free for smooth 60 fps animations.

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
| Client  | React 19 + Vite 8            |
| Bundler | Vite 8                       |
| Types   | TypeScript 6 (strict)        |

## Ports

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
app.get('/datasole-worker.iife.min.js', (_req, res) => {
  res.sendFile(dsWorkerPath);
});

// In production, serve Vite-built client
app.use(express.static('dist/client'));

const httpServer = createServer(app);
const ds = new DatasoleServer();
ds.attach(httpServer);
```

Key points:

- `DatasoleServer` defaults to `thread-pool` concurrency with 4 Node.js `worker_threads`
- The worker IIFE file must be served at `/datasole-worker.iife.min.js` (or a custom path matching `workerUrl`)
- The route for the worker file must appear **before** any catch-all SPA route

## Client-Side Integration

The `DatasoleProvider` component (wrapping your app root) creates the client, connects, and makes it available to all descendants via React context:

```tsx
// App.tsx
import { DatasoleProvider } from './hooks/useDatasole';

export function App() {
  return (
    <DatasoleProvider>
      <Layout>
        <MetricsDashboard />
        <ChatRoom />
        <RpcDemo />
      </Layout>
    </DatasoleProvider>
  );
}
```

Child components consume data with zero boilerplate:

```tsx
// Any child component
const metrics = useDatasoleEvent<Metrics>('system-metrics'); // server broadcasts → state
const messages = useDatasoleState<ChatMsg[]>('chat:messages'); // server state → state
const ds = useDatasoleClient(); // raw client for emit/rpc
const conn = useConnectionState(); // 'connected' | 'disconnected' | ...
```

No context wrapper boilerplate beyond `DatasoleProvider`, no store modules, no actions/reducers. The hook returns current state and re-renders the component when the server pushes data. Render it in JSX and forget about it.

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

- `DatasoleProvider` connects on mount, disconnects on unmount (StrictMode safe)
- Production build: `vite build` outputs to `dist/client/`, Express serves it as static files
- Web Worker transport keeps the main thread free for React rendering
- Express 5 uses `/{*splat}` syntax for catch-all routes (not `*`)

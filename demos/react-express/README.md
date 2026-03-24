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

## What It Does

Three panels demonstrate datasole's core data-flow patterns:

| Panel          | Pattern                       | Hook Used                                           |
| -------------- | ----------------------------- | --------------------------------------------------- |
| Server Metrics | Server → client broadcast     | `useDatasoleEvent<Metrics>('system-metrics')`       |
| Chat Room      | Client ↔ server state sync    | `useDatasoleState<ChatMessage[]>('chat:messages')`  |
| RPC Random     | Client → server request/reply | `useDatasoleClient()` → `ds.rpc('randomNumber', …)` |

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
| Types   | TypeScript 5.9 (strict)      |

## Ports

- **Dev**: Vite on `5173`, Express on `4001` (proxied via Vite)
- **Prod**: Express on `4001` serves built client

Override backend port with `PORT` env var.

## Server-Side Integration

`server/index.ts` sets up Express 5 with `DatasoleServer`:

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const app = express();

// 1. In production, serve Vite-built client as static files
app.use(express.static('dist/client'));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(resolve(clientDist, 'index.html'));
});

// 2. Attach datasole to the underlying Node.js HTTP server
const httpServer = createServer(app);
const ds = new DatasoleServer();
ds.attach(httpServer);

httpServer.listen(4001);
```

Key points:

- `DatasoleServer` defaults to `thread-pool` concurrency with 4 Node.js `worker_threads`
- Datasole runtime assets are auto-served under `/__ds`
- Express 5 uses `/{*splat}` syntax for catch-all routes (not the old `*`)

## Client-Side Integration

### 1. Provider at the app root

`DatasoleProvider` creates the client, connects, and makes it available via React context:

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

### 2. Consume data with hooks

Child components import hooks — no prop drilling, no context boilerplate:

```tsx
const metrics = useDatasoleEvent<Metrics>('system-metrics'); // broadcast → state
const messages = useDatasoleState<ChatMsg[]>('chat:messages'); // server state → state
const ds = useDatasoleClient(); // raw client for emit/rpc
const conn = useConnectionState(); // 'connected' | 'disconnected' | ...
```

### 3. How it works

- `DatasoleProvider` connects on mount, disconnects on unmount (StrictMode safe)
- `useDatasoleEvent` registers a listener via `client.on()` — cleanup runs `client.off()` automatically
- `useDatasoleState` subscribes via `client.subscribeState()` — cleanup calls `sub.unsubscribe()` automatically
- All hooks return plain React state — re-renders are driven by `useState` setters called from the Web Worker thread

### 4. Deriving values

Use `useMemo` for any derivation from server data — standard React idiom, no store selectors:

```tsx
const uptimeDisplay = useMemo(() => formatUptime(metrics?.uptime ?? 0), [metrics?.uptime]);
const totalMessages = useMemo(
  () => (metrics?.messagesIn ?? 0) + (metrics?.messagesOut ?? 0),
  [metrics?.messagesIn, metrics?.messagesOut],
);
```

## Vite Dev Proxy

In `vite.config.ts`, datasole path traffic is proxied to the Express backend:

```typescript
proxy: {
  '/__ds': { target: 'http://localhost:4001', ws: true },
  '/__ds/datasole-worker.iife.min.js': { target: 'http://localhost:4001' },
}
```

- `/__ds` — WebSocket + runtime asset path

## Testing

This demo is tested as part of the parent project's e2e suite:

```bash
# from repo root
npm run test:e2e:demos
```

The Playwright e2e test:

1. Runs `npm install` in this directory (if `node_modules/` is absent)
2. Builds production assets (`npm run build`)
3. Starts the server in production mode (`npm start`)
4. Navigates to `http://localhost:4001`
5. Verifies real-time metric updates arrive within 5 seconds
6. Captures screenshots for visual regression

## Notes

- Production build: `vite build` outputs to `dist/client/`, Express serves it as static files
- Web Worker transport keeps the main thread free for React rendering and animations
- React 19's automatic memoization via the compiler makes `useMemo`/`useCallback` optional in many cases, but this demo uses them explicitly to demonstrate the pattern
- Express 5 automatically catches rejected promises from handlers (no unhandled rejection crashes)

# datasole

> High-performance, binary-framed, realtime full-stack TypeScript framework.

[![CI](https://github.com/mayanklahiri/datasole/actions/workflows/ci.yml/badge.svg)](https://github.com/mayanklahiri/datasole/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/datasole.svg)](https://www.npmjs.com/package/datasole)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

## Why datasole

Most realtime frameworks were designed for text-based messaging and leave performance on the table. JSON frames over main-thread WebSockets, manual reconnection logic, no compression, no state management, and type safety bolted on as an afterthought.

**datasole** takes a different approach. It runs the WebSocket connection in a dedicated Web Worker, communicates in compressed binary frames, synchronizes server state to clients using standards-based JSON Patch, and provides concurrent typed RPC — all from a single npm package that works with any frontend or backend framework.

The result: a realtime transport layer that doesn't jank your UI, doesn't waste bandwidth, and gives you full TypeScript inference from server handler to client call site.

## Get Started in 2 Minutes

```bash
npm install datasole
```

**Server** — 6 lines:

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();
const http = createServer();
ds.attach(http);
http.listen(3000, () => console.log('listening on :3000'));
```

**Client** — 4 lines:

```html
<script src="https://unpkg.com/datasole/dist/client/datasole.iife.min.js"></script>
<script>
  const ds = new Datasole.DatasoleClient({ url: 'ws://localhost:3000' });
  ds.connect();
</script>
```

That's a running WebSocket connection with binary frames, Web Worker transport, and auto-reconnection. Now add features:

## Learn by Building

The **[Tutorials](docs/tutorials.md)** build from this hello world into a full production app, one feature at a time. Each step adds ~10 lines and introduces one pattern:

| #   | Tutorial                                                                               | What You Build                         | Time   |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------- | ------ |
| 1   | [Hello World](docs/tutorials.md#1-hello-world--your-first-connection)                  | Connect client to server               | 2 min  |
| 2   | [RPC](docs/tutorials.md#2-rpc--call-the-server-get-a-response)                         | Typed request/response                 | 3 min  |
| 3   | [Server Events](docs/tutorials.md#3-server-events--a-live-stock-ticker)                | Live stock ticker broadcast            | 3 min  |
| 4   | [Live State](docs/tutorials.md#4-live-state--a-server-synced-dashboard)                | Server-synced dashboard (React/Vue)    | 5 min  |
| 5   | [Chat + Auth](docs/tutorials.md#5-client-events--auth--a-chat-room)                    | Authenticated chat room                | 5 min  |
| 6   | [CRDT](docs/tutorials.md#6-bidirectional-crdt--a-shared-counter)                       | Conflict-free shared counter           | 5 min  |
| 7   | [Sync Channels](docs/tutorials.md#7-sync-channels--controlled-flush-granularity)       | Tunable flush strategies               | 5 min  |
| 8   | [Sessions](docs/tutorials.md#8-session-persistence--surviving-reconnections)           | Reconnection-safe user state           | 5 min  |
| 9   | [Production](docs/tutorials.md#9-production--thread-pool-rate-limiting-redis-metrics)  | Thread pool, Redis, rate limiting, pm2 | 10 min |
| 10  | [Task Board](docs/tutorials.md#10-putting-it-all-together--a-collaborative-task-board) | All patterns in one app                | 15 min |

> **Live demos** — Every tutorial has a running instance at [demo.datasole.dev](https://demo.datasole.dev). Open in your browser and follow along.

## The Most Common Pattern

Most real-world datasole apps use this: **client sends actions via RPC, server updates its model, all clients see a live mirror.**

```typescript
// Server: mutate state — datasole sends only the diff
ds.rpc('addTodo', async ({ text }) => {
  todos.push({ id: Date.now(), text, done: false });
  await ds.setState('todos', todos); // JSON Patch broadcast
  return { ok: true };
});
```

```tsx
// Client (React): subscribe and render — no state management library needed
function TodoList() {
  const ds = useRef(new DatasoleClient({ url: 'ws://localhost:3000' }));
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    ds.current.connect();
    ds.current.subscribeState('todos', setTodos); // That's it.
    return () => {
      ds.current.disconnect();
    };
  }, []);

  return (
    <ul>
      {todos.map((t) => (
        <li key={t.id}>{t.text}</li>
      ))}
    </ul>
  );
}
```

The server owns the data. The client renders a live mirror. No Redux, no Vuex, no client-side state sync logic. See [Tutorial 4](docs/tutorials.md#4-live-state--a-server-synced-dashboard) for the full walkthrough.

## What Makes datasole Different

- **Worker-offloaded WebSocket transport.** The WebSocket runs in a Web Worker — no UI jank from network I/O. SharedArrayBuffer enables zero-copy transfer. No other general-purpose realtime framework does this.

- **Binary frames with end-to-end compression.** Every frame is a compact binary envelope. pako compression applied symmetrically on client (in-worker) and server. 60–80% smaller than raw JSON.

- **Standards-based state sync.** Server-to-client sync uses [RFC 6902 JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902). Minimal, deterministic, debuggable diffs.

- **CRDT support for bidirectional sync.** Built-in LWW registers, PN counters, and LWW maps for conflict-free client ↔ server state. Multiple clients edit simultaneously; values converge automatically.

- **Configurable sync channels.** Tune _when_ updates flush: `immediate` for latency-critical data, `batched` for throughput, `debounced` for user input. Per-key, mix-and-match.

- **Pluggable concurrency.** Four models: async (event loop), thread-per-connection, thread pool (default), process-per-connection. Cluster-friendly with pm2 out of the box.

- **Frame-level rate limiting.** `MemoryRateLimiter` for single-process, `RedisRateLimiter` for clusters. Per-method rules. Protects persistent WebSocket connections.

- **Session persistence.** Per-user state survives disconnections. Auto-flush to backend with configurable thresholds. Change streams for external event systems.

- **Concurrent, typed RPC.** Multiplexed over a single WebSocket. Full TypeScript generics — request and response types inferred at the call site.

- **Single package, zero framework lock-in.** One `npm install`. React, Vue 3, Svelte, React Native, vanilla JS. Express, NestJS, Fastify, native HTTP.

- **Pluggable persistence.** In-memory (default), Redis, Postgres. Clean interface for custom backends.

- **Observability built in.** Prometheus and OpenTelemetry exporters. Connection counts, message rates, latency, error rates.

- **Production-grade TypeScript.** Strict mode, `.d.ts` declarations on every export, `typesVersions` for older TS.

- **Minimal client bundle.** 20.9 KB gzip (client) + 14.7 KB gzip (worker) = 35.6 KB total. Tree-shaken, minified IIFE. Zero Node.js polyfills.

- **Comprehensive tests.** Unit tests (Vitest), e2e (Playwright + headless Chromium + production bundle), browser console error detection, performance metrics.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                        Browser                             │
│  ┌──────────────┐         ┌────────────────────────────┐  │
│  │  Main Thread  │◄──────►│        Web Worker           │  │
│  │ DatasoleClient│  SAB/  │  WebSocket (binary)         │  │
│  │ StateStore    │  PM    │  pako decompress            │  │
│  │ CrdtStore     │        │  Frame encode/decode        │  │
│  └──────────────┘         └─────────────┬──────────────┘  │
└──────────────────────────────────────────┼────────────────┘
                                           │ Binary frames
┌──────────────────────────────────────────┼────────────────┐
│                      Server              │                │
│  ┌───────────────────────────────────────┴──────────────┐ │
│  │               DatasoleServer                          │ │
│  │  WsServer · RPC · EventBus · State · Sessions         │ │
│  │  SyncChannels · CRDT · Metrics · RateLimit            │ │
│  │  Concurrency: async | thread | pool | process         │ │
│  │                   ┌─────────────────────┐             │ │
│  │                   │    State Backend     │             │ │
│  │                   │  memory / redis / pg │             │ │
│  │                   └─────────────────────┘             │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

## Data Flow Patterns

datasole supports seven composable patterns — use one, or combine them:

| Pattern          | Direction                | Mechanism            | Use Case                                                                                             |
| ---------------- | ------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------- |
| RPC              | client → server → client | Request/response     | Form submit, data lookup                                                                             |
| Server events    | server → clients         | Broadcast            | Stock ticker, notifications                                                                          |
| Client events    | client → server          | Fire-and-forget      | Chat messages, analytics                                                                             |
| Live state (s→c) | server → clients         | JSON Patch auto-sync | Dashboards, leaderboards                                                                             |
| Live state (c→s) | client → server          | JSON Patch           | Form sync, draft saving                                                                              |
| CRDT sync        | client ↔ server          | Merge, conflict-free | Collaborative editing, presence                                                                      |
| Combinations     | any                      | Compose freely       | [Task Board (Tutorial 10)](docs/tutorials.md#10-putting-it-all-together--a-collaborative-task-board) |

## Live Demos

Every example runs at [demo.datasole.dev](https://demo.datasole.dev):

| Demo           | Pattern          | URL                                                                |
| -------------- | ---------------- | ------------------------------------------------------------------ |
| Hello World    | Connection       | [demo.datasole.dev/hello](https://demo.datasole.dev/hello)         |
| Calculator     | RPC              | [demo.datasole.dev/rpc](https://demo.datasole.dev/rpc)             |
| Stock Ticker   | Server events    | [demo.datasole.dev/ticker](https://demo.datasole.dev/ticker)       |
| Dashboard      | Live state       | [demo.datasole.dev/dashboard](https://demo.datasole.dev/dashboard) |
| Chat Room      | Events + auth    | [demo.datasole.dev/chat](https://demo.datasole.dev/chat)           |
| Shared Counter | CRDT             | [demo.datasole.dev/counter](https://demo.datasole.dev/counter)     |
| Todo App       | RPC + live state | [demo.datasole.dev/todos](https://demo.datasole.dev/todos)         |
| Task Board     | All patterns     | [demo.datasole.dev/taskboard](https://demo.datasole.dev/taskboard) |

## Bundle Sizes

All bundles include their dependencies (pako, fast-json-patch). Server externalizes `ws` and Node builtins. Verified on every CI run.

| Bundle                | What loads it           |      Raw |        Gzip |
| --------------------- | ----------------------- | -------: | ----------: |
| **Client IIFE** (min) | `<script>` tag          |  67.1 KB | **20.9 KB** |
| **Client ESM**        | `import` from bundler   | 274.4 KB |     67.4 KB |
| **Worker IIFE** (min) | Web Worker              |  46.5 KB | **14.7 KB** |
| **Shared** (ESM)      | Server or client import |   9.7 KB |      2.3 KB |
| **Server** (ESM)      | Node.js `import`        | 430.8 KB |    100.5 KB |
| **Server** (CJS)      | Node.js `require()`     | 431.6 KB |    100.6 KB |

**What a browser actually downloads**: the IIFE client bundle (**20.9 KB** gzip) plus the worker (**14.7 KB** gzip) = **35.6 KB** total for the full realtime stack with compression, binary framing, JSON Patch, CRDTs, and Web Worker transport.

These sizes are measured by CI on every push. See the [documentation dashboard](https://mayanklahiri.github.io/datasole/dashboard/) for the latest numbers.

## Full Documentation

| Doc                                      | What's in it                          |
| ---------------------------------------- | ------------------------------------- |
| **[Tutorials](docs/tutorials.md)**       | Step-by-step, 10 progressive examples |
| **[Examples](docs/examples.md)**         | Copy-paste recipes by pattern         |
| [Client API](docs/client.md)             | Every client method                   |
| [Server API](docs/server.md)             | Every server method                   |
| [Architecture](docs/architecture.md)     | Protocol, diagrams, data flow         |
| [State Backends](docs/state-backends.md) | Memory, Redis, Postgres               |
| [Metrics](docs/metrics.md)               | Prometheus, OpenTelemetry             |
| [ADRs](docs/decisions.md)                | Why every major decision was made     |
| [Contributing](docs/contributing.md)     | Setup, commands, PR guidelines        |

## Contributing

See [docs/contributing.md](docs/contributing.md) for setup, commands, and PR guidelines.

All architecture decisions are recorded in [docs/decisions.md](docs/decisions.md).

## License

[Apache-2.0](LICENSE)

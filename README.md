# datasole

[![CI](https://github.com/mayanklahiri/datasole/actions/workflows/ci.yml/badge.svg)](https://github.com/mayanklahiri/datasole/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/datasole.svg)](https://www.npmjs.com/package/datasole)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

A realtime TypeScript framework for full-stack apps that need binary WebSocket transport, server-to-client state synchronization, typed RPC, and CRDTs — shipped as a single npm package with 35.6 KB on the wire (gzip, client + worker).

datasole moves the WebSocket connection into a Web Worker so network I/O never touches your UI thread. Frames are binary envelopes compressed with pako. State diffs use [RFC 6902 JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902). The server side supports four concurrency models (async, thread-per-connection, thread pool, process isolation), pluggable persistence (memory, Redis, Postgres), and rate limiting that operates at the frame level rather than at HTTP. Everything is strictly typed end-to-end — the same TypeScript interfaces flow from server handler to client call site without a code generation step.

```bash
npm install datasole
```

## Quick start

**Server** — attach to any Node.js HTTP server:

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();
const http = createServer();
ds.attach(http);
http.listen(3000, () => console.log('listening on :3000'));
```

**Client** — connect from a browser (or import as ESM/CJS in a bundler):

```html
<script src="https://unpkg.com/datasole/dist/client/datasole.iife.min.js"></script>
<script>
  const ds = new Datasole.DatasoleClient({ url: 'ws://localhost:3000' });
  ds.connect();
</script>
```

This gives you a reconnecting WebSocket over binary frames running in a Web Worker. From here you can add RPC methods, event subscriptions, live state channels, and CRDTs incrementally — the [tutorial](docs/tutorials.md) walks through each pattern in ~10 lines of code per step.

## The common pattern: server-owned state, client-rendered mirror

The majority of datasole applications follow one shape: the client calls an RPC, the server mutates its model, and all connected clients receive a JSON Patch diff of the change. No client-side state management library is needed.

```typescript
// server
ds.rpc('addTodo', async ({ text }) => {
  todos.push({ id: Date.now(), text, done: false });
  await ds.setState('todos', todos);
  return { ok: true };
});
```

```tsx
// client (React)
function TodoList() {
  const ds = useRef(new DatasoleClient({ url: 'ws://localhost:3000' }));
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    ds.current.connect();
    ds.current.subscribeState('todos', setTodos);
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

The server owns the data, diffs it on mutation, and broadcasts patches. The client applies them. No Redux, no Vuex, no manual sync logic. [Tutorial 4](docs/tutorials.md#4-live-state--a-server-synced-dashboard) covers this end to end.

## What datasole provides

**Transport** — The WebSocket runs in a dedicated Web Worker. Frames are 9-byte-header binary envelopes with pako compression (60–80% smaller than raw JSON). On browsers that support it, SharedArrayBuffer enables zero-copy transfer between the worker and main thread. A fallback transport handles environments without Worker support.

**State synchronization** — Server-to-client state sync produces RFC 6902 JSON Patch operations, so clients receive only what changed. For bidirectional sync, built-in CRDTs (LWW registers, PN counters, LWW maps) let multiple clients edit the same data structure concurrently with automatic convergence. Sync channels let you tune flush behavior per key — `immediate` for latency-sensitive data, `batched` for throughput, `debounced` for user input.

**RPC and events** — Typed RPC calls are multiplexed over the single WebSocket with correlation IDs, timeouts, and concurrent in-flight support. Events flow in both directions (server broadcast, client-to-server fire-and-forget). TypeScript generics propagate request/response types to the call site without codegen.

**Server concurrency and isolation** — Four pluggable concurrency strategies: in-process async (event loop, lowest overhead), thread-per-connection (`worker_threads`), thread pool (fixed `worker_threads`, the default), and process-per-connection (child processes with serialized packet forwarding). All are cluster-friendly via pm2.

**Persistence and rate limiting** — State backends are pluggable: in-memory (default), Redis, Postgres. Session state persists across disconnections with configurable flush thresholds and change streams for external event systems. Frame-level rate limiting ships with `MemoryRateLimiter` (single process) and `RedisRateLimiter` (distributed), with per-method rules.

**Observability** — Prometheus and OpenTelemetry metric exporters for connection counts, message rates, latencies, and error rates.

**Compatibility** — Works with React, Vue 3, Svelte, React Native, and vanilla JS on the frontend. Express, NestJS, Fastify, and native `http.createServer()` on the backend. Published as a single npm package with ESM, CJS, and IIFE bundles, `.d.ts` declarations on every export, and `typesVersions` for older TypeScript.

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

## Data flow patterns

These seven patterns are composable — use one, or layer them:

| Pattern          | Direction                | Mechanism            | Typical use                  |
| ---------------- | ------------------------ | -------------------- | ---------------------------- |
| RPC              | client → server → client | Request/response     | Form submit, data lookup     |
| Server events    | server → clients         | Broadcast            | Stock ticker, notifications  |
| Client events    | client → server          | Fire-and-forget      | Chat messages, analytics     |
| Live state (s→c) | server → clients         | JSON Patch auto-sync | Dashboards, leaderboards     |
| Live state (c→s) | client → server          | JSON Patch           | Form sync, draft saving      |
| CRDT sync        | client ↔ server          | Merge, conflict-free | Collaborative editing        |
| Combinations     | any                      | Compose freely       | See Tutorial 10 (Task Board) |

## Bundle sizes

All bundles include their runtime dependencies (pako, fast-json-patch). The server bundle externalizes `ws` and Node builtins. These numbers are verified by CI on every push.

| Bundle                | Loaded by               |      Raw |        Gzip |
| --------------------- | ----------------------- | -------: | ----------: |
| **Client IIFE** (min) | `<script>` tag          |  67.1 KB | **20.9 KB** |
| **Client ESM**        | `import` from bundler   | 274.4 KB |     67.4 KB |
| **Worker IIFE** (min) | Web Worker              |  46.5 KB | **14.7 KB** |
| **Shared** (ESM)      | Server or client import |   9.7 KB |      2.3 KB |
| **Server** (ESM)      | Node.js `import`        | 430.8 KB |    100.5 KB |
| **Server** (CJS)      | Node.js `require()`     | 431.6 KB |    100.6 KB |

A browser downloads the client IIFE (**20.9 KB** gzip) and the worker (**14.7 KB** gzip) for a total of **35.6 KB** — that includes compression, binary framing, JSON Patch diffing, CRDTs, and the Web Worker transport.

## Test coverage

The quality gate runs on every push and enforces:

- **122 unit tests** across 26 test files (Vitest, v8 coverage)
- **13 end-to-end tests** across 5 spec files (Playwright, headless Chromium, production IIFE bundle)
- Coverage thresholds: 45% lines, 40% branches, 35% functions, 45% statements
- E2E tests exercise the full stack: a real `DatasoleServer` with `ws`, a real browser loading the IIFE bundle, WebSocket connections, RPC calls, state sync patches, bidirectional events, and auth token validation

The gate also validates formatting (Prettier), linting (ESLint flat config + `tsc --noEmit`), bundle builds, `.d.ts` emission, metrics collection, and docs site generation — `npm run gate` runs everything in sequence.

## Tutorial

The [tutorial](docs/tutorials.md) is structured as a progressive series that builds from a bare connection to a production deployment. Each step adds a single concept in ~10 lines:

| #   | Topic         | What you build                         |
| --- | ------------- | -------------------------------------- |
| 1   | Hello World   | Connect client to server               |
| 2   | RPC           | Typed request/response                 |
| 3   | Server Events | Live stock ticker broadcast            |
| 4   | Live State    | Server-synced dashboard (React/Vue)    |
| 5   | Chat + Auth   | Authenticated chat room                |
| 6   | CRDTs         | Conflict-free shared counter           |
| 7   | Sync Channels | Tunable flush strategies               |
| 8   | Sessions      | Reconnection-safe user state           |
| 9   | Production    | Thread pool, Redis, rate limiting, pm2 |
| 10  | Task Board    | All patterns combined                  |

## Documentation

| Document                                 | Contents                                |
| ---------------------------------------- | --------------------------------------- |
| **[Tutorials](docs/tutorials.md)**       | Progressive 10-step guide               |
| **[Examples](docs/examples.md)**         | Copy-paste recipes organized by pattern |
| [Client API](docs/client.md)             | All client methods and options          |
| [Server API](docs/server.md)             | All server methods and options          |
| [Architecture](docs/architecture.md)     | Wire protocol, diagrams, data flow      |
| [State Backends](docs/state-backends.md) | Memory, Redis, Postgres configuration   |
| [Metrics](docs/metrics.md)               | Prometheus and OpenTelemetry setup      |
| [Decisions](docs/decisions.md)           | Architecture Decision Records           |
| [Contributing](docs/contributing.md)     | Dev setup, commands, PR guidelines      |

For AI coding agents, see [AGENTS.md](AGENTS.md) — it covers the quality gate, coding conventions, and ADR workflow.

## License

[Apache-2.0](LICENSE)

---
title: Decisions
order: 7
description: Architecture Decision Records for the datasole project.
---

# Architecture Decision Records

## ADR-001: Single npm package with conditional exports

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** The framework has client, server, and shared code. Options: monorepo with separate packages, single package with subpath exports, or separate repos.
- **Decision:** Single npm package with `package.json` `exports` map providing `datasole`, `datasole/client`, `datasole/server` subpaths.
- **Consequences:** Simpler versioning (one version number), simpler installation (`npm install datasole`), tree-shaking relies on bundler `exports` support. Trade-off: larger package download includes both client and server code, though only used portions are bundled.

## ADR-002: Worker-first WebSocket transport with SharedArrayBuffer

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** WebSocket I/O on the main thread causes jank during heavy message processing. Web Workers offload I/O but add postMessage serialization overhead.
- **Decision:** WebSocket connection lives in a Web Worker. SharedArrayBuffer ring-buffer enables zero-copy data transfer when available; postMessage with Transferable ArrayBuffer as fallback.
- **Consequences:** Main thread stays free for UI rendering. Requires COOP/COEP headers for SAB. Adds complexity in worker lifecycle management. Fallback transport ensures compatibility with environments without Workers (React Native, older browsers).

## ADR-003: Binary frames with pako compression end-to-end

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** JSON text frames are human-readable but wasteful. WebSocket per-message-deflate is CPU-intensive on the server for many connections.
- **Decision:** Custom binary frame envelope (opcode + correlation ID + payload length + payload). Application-level pako compression above a configurable threshold (256 bytes). Same codec on client (in-worker) and server.
- **Consequences:** 60-80% smaller payloads than raw JSON. Compression runs in the worker thread (no main-thread CPU cost). Per-message-deflate is disabled. Trade-off: frames are not human-readable in browser DevTools without a decoder.

## ADR-004: JSON Patch (RFC 6902) for state synchronization

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** State sync options: CRDTs (complex, large library), OT (complex, server-centric), proprietary binary diff (non-standard), or JSON Patch (standard, simple).
- **Decision:** Use RFC 6902 JSON Patch for server-to-client state diffs. `fast-json-patch` library for production; minimal custom impl in shared/diff as fallback.
- **Consequences:** Standard, debuggable patches. Smaller than full state snapshots for incremental changes. Trade-off: not as bandwidth-efficient as binary diffs for large arrays; no conflict resolution (server is authoritative).

## ADR-005: Pluggable state backends via interface

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Different deployments need different persistence: in-memory for dev, Redis for multi-process, Postgres for persistence.
- **Decision:** `StateBackend` interface with get/set/delete/subscribe/publish. Built-in: MemoryBackend (default), RedisBackend (optional peer dep), PostgresBackend (optional peer dep). Interface is public for custom backends.
- **Consequences:** Clean separation of state management from transport. Optional peer deps keep the core lightweight. Trade-off: each backend must implement pub/sub semantics, which is non-trivial for SQL databases.

## ADR-006: Framework-agnostic client with no runtime framework deps

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** The client must work with React, Vue 3, Svelte, React Native, and vanilla JS. Options: provide framework-specific wrappers, or keep the core framework-free.
- **Decision:** `DatasoleClient` is a plain TypeScript class with no framework imports. Returns plain objects compatible with any reactivity system. Framework-specific hooks/composables can be built on top but are not part of the core.
- **Consequences:** Maximum compatibility. No framework-specific dependencies in the client bundle. Trade-off: users must write their own integration glue (a few lines per framework).

## ADR-007: Default WebSocket path `/__ds`

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Need a default path for the WebSocket endpoint that is unlikely to conflict with application routes.
- **Decision:** Default path is `/__ds` (double-underscore prefix convention for framework internals, "ds" for datasole). Configurable via `DatasoleClientOptions.path` and `DatasoleServerOptions.path`.
- **Consequences:** Avoids collision with common paths like `/ws`, `/socket`, `/api`. The double-underscore convention signals "framework internal". Trade-off: slightly unconventional, but memorable and short.

## ADR-008: ConnectionContext as shared per-connection state bag

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Multiple subsystems (RPC handlers, event handlers, rate limiters, session managers) need access to per-connection information: auth identity, metadata from upgrade headers, and arbitrary user-set state. Threading the auth result through every callback is ergonomically poor.
- **Decision:** `ConnectionContext` interface, instantiated once per connection from the upgrade auth result, passed as part of `RpcContext` and available to event handlers. Provides typed `get<T>/set/delete` for arbitrary state, plus immutable `auth`, `userId`, `metadata`, `tags`.
- **Consequences:** Clean, single object for all per-connection state. Auth data from upgrade headers is automatically populated. Custom middleware can enrich context via `set()`. Trade-off: mutable bag can accumulate unbounded state if not disciplined.

## ADR-009: CRDT support for bidirectional client ↔ server synchronization

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** JSON Patch (ADR-004) is server-authoritative, which is ideal for server→client live data. But collaborative editing, shared counters, and multi-client state require conflict-free bidirectional sync.
- **Decision:** Built-in CRDT primitives in `src/shared/crdt/`: `LWWRegister<T>` (last-writer-wins scalar), `PNCounter` (positive-negative counter with per-node vector), and `LWWMap<T>` (last-writer-wins map of registers). All implement a common `Crdt<T>` interface with `apply(op)`, `merge(state)`, `state()`, and `value()`. Operations are transmitted as `CrdtOperation` frames over the binary protocol. Client-side `CrdtStore` queues local ops for immediate local application + async server sync. Server merges all clients' ops and rebroadcasts the resolved state.
- **Consequences:** Enables conflict-free collaborative state (counters, presence, shared documents). Reuses the existing binary frame protocol. Trade-off: CRDTs are eventually consistent—no strong ordering guarantees. Current primitives cover common cases; richer CRDTs (OR-Set, RGA for text) can be added later via the `Crdt<T>` interface.

## ADR-010: SyncChannel with configurable flush strategies

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Different real-time use cases need different synchronization granularities. A stock ticker needs immediate pushes; a dashboard can batch updates; a form auto-save should debounce.
- **Decision:** `SyncChannel<T>` manages a queue of `StatePatch` operations with three flush strategies: `immediate` (flush on every enqueue), `batched` (flush after N ops or M milliseconds, whichever comes first), and `debounced` (flush after M ms of inactivity). Channels are created per key via `ds.primitives.live.createSyncChannel()` with direction (`server-to-client`, `client-to-server`, `bidirectional`) and mode (`json-patch`, `crdt`, `snapshot`).
- **Consequences:** One API covers all real-time patterns—stock tickers, collaborative editing, form sync, live dashboards. Trade-off: batched/debounced strategies introduce latency; `immediate` is the default for lowest-latency use cases.

## ADR-011: Data flow patterns as composable primitives

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** The framework must support a mix-and-match set of patterns: RPC, server→client events (broadcast), client→server events, bidirectional events (CRDTs), server→client live data structures (JSON Patch), client→server live data, and combinations thereof. Each pattern has different consistency, latency, and API characteristics.
- **Decision:** Data flow patterns are defined as the `DataFlowPattern` discriminated union. Each pattern is served by a corresponding subsystem: `RpcDispatcher` for RPC, `EventBus` for events, `SyncChannel` with `json-patch` mode for live data structures, `SyncChannel` with `crdt` mode for bidirectional sync. The framework composes these freely—a single connection can use multiple patterns concurrently. The minimum viable set of use cases is: (1) pure RPC, (2) server event broadcast (e.g. stock ticker), (3) client→server RPC + server→client live state for seamless frontend data binding (React/Vue reactive model backed by server-side state).
- **Consequences:** Users pick only the patterns they need. Composability avoids framework lock-in to a single paradigm. Trade-off: more concepts to learn, but each is independently useful and well-documented.

## ADR-012: Decompose DatasoleServer into Composable Layers

- **Status:** Accepted
- **Date:** 2026-03-23

- **Context:** DatasoleServer was a 452-line god class conflating transport, frame routing, rate limiting, domain primitives, data-flow orchestration, and lifecycle. The concurrency module was dead code. Backend usage was limited to StateManager/SessionManager. Auth and rate-limiting were standalone modules not integrated with the backend distribution layer.

- **Decision:** Decompose into four layers:
  1. **Transport** — pure byte pipe (ServerTransport)
  2. **Executor** — compressed frame processing + isolation (AsyncExecutor, ThreadExecutor, PoolExecutor)
  3. **Backends** — distribution layer (StateBackend with factory + serializable config)
  4. **Primitives** — all backend-powered services (RPC, Events, State, CRDT, Sessions, Sync, Auth, Rate-limit, Data-flow)

  Additionally:
  - DatasoleServer/DatasoleClient become generic with required DatasoleContract type parameter
  - All stateful services receive StateBackend via constructor injection
  - EventBus, CrdtManager, SyncChannel, RateLimiter are backend-powered
  - Old concurrency module replaced by ConnectionExecutor

- **Consequences:** Breaking API change: all method calls changed (`ds.rpc.register()` vs `ds.rpc()`). DatasoleContract type parameter is required (no DefaultContract). All demos restructured with `shared/contract.ts`. Better testability via constructor injection and interface-first design. Better extensibility: new primitives implement RealtimePrimitive interface. Distribution via backend swap (MemoryBackend → RedisBackend).

## ADR-013: Zero eslint-disable — fix types, don't suppress rules

- **Status:** Accepted
- **Date:** 2026-03-23

- **Context:** `eslint-disable` comments are a code smell. They hide type errors behind suppressions instead of fixing the root cause. Even in test code, `as any` casts propagate type-unsafety and make refactoring blind. Two eslint-disable comments existed: one for `@typescript-eslint/no-explicit-any` in a unit test RPC handler that used `ctx: any` instead of `RpcContext`, and one for `no-control-regex` in the build summary printer that matched ANSI escape sequences.

- **Decision:** Adopt a zero-tolerance policy for `eslint-disable` comments and `as any` casts:
  1. **No `eslint-disable`** — if a rule fires, fix the code. If the rule is wrong for the project, disable it in `.eslintrc` globally with justification.
  2. **No `as any`** — use proper generics, `unknown` with type guards, or well-typed interfaces. The only acceptable type escape hatches are `as never` (for generic variance boundaries in internal plumbing) and `as unknown as T` (for test doubles where the full interface isn't needed).
  3. **Typed browser globals** — E2E tests declare a `Window` augmentation (`test/e2e/types/test-window.d.ts`) so Playwright `page.evaluate()` calls are fully typed instead of using `window as any`.
  4. **`catch (e: unknown)`** — error handlers use `unknown` with `instanceof Error` guards, never `catch (e: any)`.

- **Consequences:** All type errors surface at compile time. Refactoring tools can follow types through the entire codebase including tests. No hidden suppressions. Trade-off: slightly more verbose catch blocks and occasionally verbose generic constraints, but this is a feature, not a cost — it forces explicit handling of edge cases.

## ADR-014: Standardize demos into client/server/shared layout

- **Status:** Accepted
- **Date:** 2026-03-24
- **Context:** Demo projects used mixed top-level layouts (`public/`, `src/`, root `server.mjs`) that made onboarding and framework comparison inconsistent.
- **Decision:** All demos use top-level `client/`, `server/`, and `shared/` directories. The `shared/` contract is the single source of truth for RPC methods, events, state keys, and payload types.
- **Consequences:** Better DX and clearer parity across vanilla, React+Express, and Vue+NestJS demos. Build tooling needs path updates for Vite and server entry points.

## ADR-015: DatasoleServer serves client runtime assets

- **Status:** Accepted
- **Date:** 2026-03-24
- **Context:** Integrations and demos repeatedly implemented custom routes for `datasole.iife.min.js` and `datasole-worker.iife.min.js`, causing duplication and drift.
- **Decision:** `DatasoleServer.transport.attach()` serves production client/worker runtime assets at the configured Datasole path with fixed filenames:
  - `{path}/datasole.iife.min.js`
  - `{path}/datasole-worker.iife.min.js`
    Server responses include ETag, `If-None-Match` handling, and `304 Not Modified` support.
- **Consequences:** Integrations no longer need bespoke runtime asset routes. Server build packaging must always include the client and worker production bundles.

## ADR-016: backendConfig wiring, `init()`, and thread executors delegating to async routing

- **Status:** Accepted (lifecycle entry superseded by ADR-019 naming; behavior unchanged)
- **Date:** 2026-03-24
- **Context:** `DatasoleServerOptions.backendConfig` was documented but ignored; Redis/Postgres backends require `connect()` before use; `thread` / `thread-pool` executors dropped frames on the floor while sharing the same public API as `async`.
- **Decision:**
  - Resolve `stateBackend` vs `backendConfig` (mutually exclusive); `createBackend(backendConfig)` when no explicit `stateBackend` is passed.
  - Async startup is `await datasoleServer.init()` (runs optional backend `connect()`; no-op for `MemoryBackend`). See ADR-019.
  - Implement `ThreadExecutor` and `PoolExecutor` as thin wrappers around `AsyncExecutor` so frame routing and `wireFrameHandlers` behave identically until real `worker_threads` isolation exists.
  - Validate `PostgresBackend` `tableName` as a safe SQL identifier before interpolation.
- **Consequences:** Declarative backend config works; distributed backends can be brought up safely; non-async executor models no longer silently break the protocol. Trade-off: thread models do not yet provide CPU isolation—only the same routing path as `async`.
- **Worker asset headers:** `datasole-worker.iife.min.js` uses the same COOP/COEP as the main bundle, but **`Cross-Origin-Resource-Policy: cross-origin`** instead of `same-origin`. `CORP: same-origin` on the worker script breaks `new Worker()` for typical HTML pages that do not enable cross-origin isolation; `cross-origin` keeps workers loadable for both COEP test pages and normal SPAs.

## ADR-017: Contract-first integration style for apps, docs, and generated code

- **Status:** Accepted
- **Date:** 2026-03-24
- **Context:** Raw string literals for RPC methods, event names, and state keys drift between client and server, break refactors, and tempt LLMs to invent inconsistent APIs. Tutorials and demos need a single pattern that is both type-safe and easy to copy.
- **Decision:** Production-oriented examples use a shared **`AppContract` extending `DatasoleContract`**, colocated with **`enum` (or equivalent const-key maps) for `RpcMethod`, `Event`, and `StateKey`**. The same module is imported on client and server. Public docs and agent-generated snippets should default to this pattern unless the snippet is intentionally minimal (e.g. one-liner hello world).
- **Consequences:** End-to-end typing, grep-friendly method names, and alignment with `RpcParams` / `RpcResult` / `EventData` / `StateValue` helpers. Agents and humans produce compatible code more often. Trade-off: slightly more boilerplate than string-only examples.

## ADR-018: Server extension surface — what exists vs. what agents must not invent

- **Status:** Accepted
- **Date:** 2026-03-24
- **Context:** Automated coding agents often hallucinate framework hooks (custom middleware chains, injectable rate-limiter classes, multiple backends per server). Documenting the **actual** extension points reduces bad patches and impossible APIs.
- **Decision:** Treat the following as canonical for analysis, codegen, and review:
  1. **One `StateBackend` per `DatasoleServer`** — multi-store setups use a **composite/facade** implementing `StateBackend`, not multiple `stateBackend` options (see ADR-005).
  2. **Rate limiting** — Default implementation is **`DefaultRateLimiter`**, constructed with the same **`StateBackend`** unless **`rateLimiter`** is injected. Tune behavior with **`rateLimit`** (`defaultRule`, `rules`, `keyExtractor`). Custom **`RateLimiter`** implementations may expose optional **`connect()`** for startup (see ADR-019).
  3. **Authentication** — **`authHandler`** runs on the **HTTP WebSocket upgrade** only (`IncomingMessage` → `AuthResult`). There is no per-frame auth callback on the datasole protocol.
  4. **Metrics** — in-process **`MetricsCollector`** on **`ds.metrics`**; push to vendors by calling **`MetricsExporter.export(ds.metrics.snapshot())`** from application code (or your framework’s metrics hook). Application/business metrics belong in the host app’s observability stack.
- **Consequences:** Agents can wire Redis/Postgres backends, inject or default the limiter, tune rules, and add JWT/cookie auth without inventing fake constructor options.

## ADR-019: Hierarchical `DatasoleServer` API, DI, and `init()`

- **Status:** Accepted
- **Date:** 2026-03-25
- **Context:** `DatasoleServer` exposed a flat surface mixing transport, orchestration, and primitives; `DefaultRateLimiter` naming did not signal default behavior; framework integrations (NestJS async providers, injected Redis clients) need a clear composition root and phased startup.
- **Decision:**
  - **Hierarchy:** `ds.transport` (attach, connection count; wraps `ServerTransport` + wire handlers), `ds.rpc`, `ds.metrics`, `ds.primitives` (`state`, `events`, **`live`** — setState/getState, sync/data channels, **`fanout`** — broadcast to clients, `crdt`, `sessions`, `rateLimiter`). Top-level orchestration methods are removed from `DatasoleServer`.
  - **Parent pointer:** `DatasoleServerTransportFacade` exposes **`readonly server: DatasoleServer<T>`** for nested code that needs the composition root.
  - **Lifecycle:** **`await ds.init()`** replaces **`initialize()`**; runs **`StateBackend.connect()`** when present and optional **`RateLimiter.connect()`**. **`ds.transport.attach(httpServer)`** after **`init()`** for distributed backends.
  - **Rename:** `DefaultRateLimiter` → **`DefaultRateLimiter`** (same implementation; constructor takes the server’s **`StateBackend`**).
  - **DI:** Optional **`rateLimiter`** in **`DatasoleServerOptions`**; default **`new DefaultRateLimiter(backend)`**.
- **Consequences:** Breaking API for direct `ds.attach` / `ds.broadcast` / flat primitive fields; docs and demos updated. Phased NestJS setup: async providers for infra → factory constructs **`DatasoleServer`** → **`onModuleInit`**: **`await ds.init()`** then **`ds.transport.attach`**.

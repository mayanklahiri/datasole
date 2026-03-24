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

## ADR-006: Rollup for multi-target bundling

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Need IIFE + ESM + CJS client bundles, a worker bundle, and server CJS + ESM bundles. Options: esbuild (fast, less tree-shaking control), tsup (esbuild wrapper), webpack (heavy), Rollup (mature, best tree-shaking).
- **Decision:** Rollup with @rollup/plugin-typescript, @rollup/plugin-node-resolve, @rollup/plugin-commonjs, @rollup/plugin-terser, @rollup/plugin-replace.
- **Consequences:** Superior tree-shaking for minimal client bundles. Multi-output from single config. Build is slower than esbuild but acceptable. Trade-off: Rollup configuration is verbose for complex multi-target setups.

## ADR-007: Vitest for unit tests

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Need a test runner with native ESM and TypeScript support. Options: Jest (requires ts-jest/transform config), Vitest (native ESM, native TS, same API as Jest).
- **Decision:** Vitest with @vitest/coverage-v8 for coverage.
- **Consequences:** Zero configuration for TypeScript. Fast watch mode with HMR. Same describe/it/expect API as Jest. Trade-off: newer ecosystem, fewer plugins than Jest.

## ADR-008: Playwright for e2e tests

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Need headless browser automation to test the production IIFE bundle. Options: Puppeteer (Chrome only), Cypress (own runner, heavy), Playwright (multi-browser, lightweight, good API).
- **Decision:** Playwright with Chromium for e2e tests. Tests load the production build via script tags and assert functional correctness + capture console logs and performance metrics.
- **Consequences:** Tests validate the actual production artifact. Console error detection catches runtime issues. Performance metrics (page.evaluate + Performance API) enable regression tracking. Trade-off: requires browser binary download in CI.

## ADR-009: Framework-agnostic client with no runtime framework deps

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** The client must work with React, Vue 3, Svelte, React Native, and vanilla JS. Options: provide framework-specific wrappers, or keep the core framework-free.
- **Decision:** `DatasoleClient` is a plain TypeScript class with no framework imports. Returns plain objects compatible with any reactivity system. Framework-specific hooks/composables can be built on top but are not part of the core.
- **Consequences:** Maximum compatibility. No framework-specific dependencies in the client bundle. Trade-off: users must write their own integration glue (a few lines per framework).

## ADR-010: Default WebSocket path `/__ds`

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Need a default path for the WebSocket endpoint that is unlikely to conflict with application routes.
- **Decision:** Default path is `/__ds` (double-underscore prefix convention for framework internals, "ds" for datasole). Configurable via `DatasoleClientOptions.path` and `DatasoleServerOptions.path`.
- **Consequences:** Avoids collision with common paths like `/ws`, `/socket`, `/api`. The double-underscore convention signals "framework internal". Trade-off: slightly unconventional, but memorable and short.

## ADR-011: Pluggable concurrency models (async / thread / thread-pool)

- **Status:** Superseded by ADR-018

- **Date:** 2026-03-19
- **Context:** Different deployment scenarios benefit from different concurrency models. Chat apps need lightweight async per-connection; CPU-heavy game logic benefits from thread-per-connection; high-throughput API gateways need pooled threads.
- **Decision:** `ConnectionExecutor` interface with three implementations: `AsyncExecutor` (default Node.js event loop, no isolation), `ThreadExecutor` (new `worker_threads` per connection), `PoolExecutor` (fixed thread pool with least-connections assignment, **default**). Process-per-connection was removed — the same isolation can be achieved by running CPU-bound work inside a thread-per-connection executor with custom `workerScript`. All RPC, events, and messages are 1:1 mapped from a connected WebSocket to its assigned worker. The main process handles WebSocket I/O and dispatches serialized frames. Selection via `DatasoleServerOptions.executor.model`. Cluster-friendly: no shared mutable state in the main process beyond the connection registry—compatible with `pm2 cluster` mode out of the box.
- **Consequences:** Three well-defined concurrency models cover all practical workloads. Thread-pool default gives good isolation without fork overhead. Trade-off: thread strategies add serialization cost for frame forwarding.

## ADR-012: Rate limiting with pluggable backends

- **Status:** Superseded by ADR-018
- **Date:** 2026-03-19
- **Context:** WebSocket servers need protection against abusive clients. Unlike HTTP rate limiting (well-served by existing middleware), persistent connections require per-connection, per-method rate limiting at the frame level.
- **Decision:** `RateLimiter` interface with `check`/`consume`/`reset`. Two built-in implementations: `MemoryRateLimiter` (sliding-window counters, suitable for single-process) and `RedisRateLimiter` (atomic INCR+EXPIRE, shares the same Redis connection as the state backend, suitable for clustered deployments). Configurable per-method rules via `RateLimitConfig.rules` map. Default: 100 requests/minute/connection.
- **Consequences:** Frame-level rate limiting prevents abuse without dropping the WebSocket connection. Redis backend enables consistent limiting across a pm2 cluster. Trade-off: per-frame overhead (one Map lookup or Redis round-trip).

## ADR-013: ConnectionContext as shared per-connection state bag

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Multiple subsystems (RPC handlers, event handlers, rate limiters, session managers) need access to per-connection information: auth identity, metadata from upgrade headers, and arbitrary user-set state. Threading the auth result through every callback is ergonomically poor.
- **Decision:** `ConnectionContext` interface, instantiated once per connection from the upgrade auth result, passed as part of `RpcContext` and available to event handlers. Provides typed `get<T>/set/delete` for arbitrary state, plus immutable `auth`, `userId`, `metadata`, `tags`.
- **Consequences:** Clean, single object for all per-connection state. Auth data from upgrade headers is automatically populated. Custom middleware can enrich context via `set()`. Trade-off: mutable bag can accumulate unbounded state if not disciplined.

## ADR-014: Session manager with configurable persistence flush

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Users reconnecting after network drops should not lose accumulated state. Full state persistence after every mutation is wasteful. Change streams are needed for external event-driven systems.
- **Decision:** `SessionManager` wraps the `StateBackend` with per-user in-memory session maps. Dirty writes accumulate and flush to persistence either (a) when a configurable threshold is reached (`flushThreshold`, default 10 mutations), or (b) on a periodic timer (`flushIntervalMs`, default 5s), or (c) on explicit `flushUser()`/`flushAll()`. Flush triggers `backend.publish()` which feeds the existing change-stream/subscription mechanism. `snapshot()`/`restore()` on reconnect hydrate from persistence.
- **Consequences:** Reconnections are seamless with minimal persistence I/O. Change streams integrate with existing `StateBackend.subscribe()`. Trade-off: data can be lost between flush intervals if the process crashes; configurable thresholds allow tuning this window per use case.

## ADR-015: CRDT support for bidirectional client ↔ server synchronization

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** JSON Patch (ADR-004) is server-authoritative, which is ideal for server→client live data. But collaborative editing, shared counters, and multi-client state require conflict-free bidirectional sync.
- **Decision:** Built-in CRDT primitives in `src/shared/crdt/`: `LWWRegister<T>` (last-writer-wins scalar), `PNCounter` (positive-negative counter with per-node vector), and `LWWMap<T>` (last-writer-wins map of registers). All implement a common `Crdt<T>` interface with `apply(op)`, `merge(state)`, `state()`, and `value()`. Operations are transmitted as `CrdtOperation` frames over the binary protocol. Client-side `CrdtStore` queues local ops for immediate local application + async server sync. Server merges all clients' ops and rebroadcasts the resolved state.
- **Consequences:** Enables conflict-free collaborative state (counters, presence, shared documents). Reuses the existing binary frame protocol. Trade-off: CRDTs are eventually consistent—no strong ordering guarantees. Current primitives cover common cases; richer CRDTs (OR-Set, RGA for text) can be added later via the `Crdt<T>` interface.

## ADR-016: SyncChannel with configurable flush strategies

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** Different real-time use cases need different synchronization granularities. A stock ticker needs immediate pushes; a dashboard can batch updates; a form auto-save should debounce.
- **Decision:** `SyncChannel<T>` manages a queue of `StatePatch` operations with three flush strategies: `immediate` (flush on every enqueue), `batched` (flush after N ops or M milliseconds, whichever comes first), and `debounced` (flush after M ms of inactivity). Channels are created per key via `DatasoleServer.createSyncChannel()` with direction (`server-to-client`, `client-to-server`, `bidirectional`) and mode (`json-patch`, `crdt`, `snapshot`).
- **Consequences:** One API covers all real-time patterns—stock tickers, collaborative editing, form sync, live dashboards. Trade-off: batched/debounced strategies introduce latency; `immediate` is the default for lowest-latency use cases.

## ADR-017: Data flow patterns as composable primitives

- **Status:** Accepted
- **Date:** 2026-03-19
- **Context:** The framework must support a mix-and-match set of patterns: RPC, server→client events (broadcast), client→server events, bidirectional events (CRDTs), server→client live data structures (JSON Patch), client→server live data, and combinations thereof. Each pattern has different consistency, latency, and API characteristics.
- **Decision:** Data flow patterns are defined as the `DataFlowPattern` discriminated union. Each pattern is served by a corresponding subsystem: `RpcDispatcher` for RPC, `EventBus` for events, `SyncChannel` with `json-patch` mode for live data structures, `SyncChannel` with `crdt` mode for bidirectional sync. The framework composes these freely—a single connection can use multiple patterns concurrently. The minimum viable set of use cases is: (1) pure RPC, (2) server event broadcast (e.g. stock ticker), (3) client→server RPC + server→client live state for seamless frontend data binding (React/Vue reactive model backed by server-side state).
- **Consequences:** Users pick only the patterns they need. Composability avoids framework lock-in to a single paradigm. Trade-off: more concepts to learn, but each is independently useful and well-documented.

## ADR-018: Decompose DatasoleServer into Composable Layers

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
  - Old concurrency module (ADR-011) replaced by ConnectionExecutor

- **Consequences:** Breaking API change: all method calls changed (`ds.rpc.register()` vs `ds.rpc()`). DatasoleContract type parameter is required (no DefaultContract). All demos restructured with `shared/contract.ts`. Better testability via constructor injection and interface-first design. Better extensibility: new primitives implement RealtimePrimitive interface. Distribution via backend swap (MemoryBackend → RedisBackend).

## ADR-019: Remove ProcessExecutor, default to thread-pool

- **Status:** Accepted
- **Date:** 2026-03-23

- **Context:** The `ProcessExecutor` (`child_process` fork per connection) was a stub with no real implementation — the dispatch method was a no-op. Process-per-connection isolation doubles memory per connection, adds IPC serialization overhead, and complicates backend sharing. The same isolation guarantee can be achieved in userland by running CPU-bound work inside a `thread`-model executor with a custom `workerScript`. Meanwhile, the default executor was `async` (single event loop), which provides no isolation at all.

- **Decision:** Remove `ProcessExecutor` entirely. Reduce `ExecutorModel` to three options: `async` (default), `thread`, `thread-pool` (recommended for production). The `async` model remains the default because it is the only fully implemented executor — `thread` and `thread-pool` are stub implementations ready for `workerScript`-based extension. `thread-pool` defaults to `os.availableParallelism()` threads. Threads can initialize their own backend instance or share the parent's — this covers the distributed coordination concern that motivated process isolation.

- **Consequences:** Simpler executor surface (3 models instead of 4). Default is now production-appropriate out of the box. Process-level isolation can still be achieved via pm2 cluster mode or Kubernetes pods. Trade-off: users who specifically need child_process isolation must implement it themselves, but no existing users depended on the stub implementation.

## ADR-020: Zero eslint-disable — fix types, don't suppress rules

- **Status:** Accepted
- **Date:** 2026-03-23

- **Context:** `eslint-disable` comments are a code smell. They hide type errors behind suppressions instead of fixing the root cause. Even in test code, `as any` casts propagate type-unsafety and make refactoring blind. Two eslint-disable comments existed: one for `@typescript-eslint/no-explicit-any` in a unit test RPC handler that used `ctx: any` instead of `RpcContext`, and one for `no-control-regex` in the build summary printer that matched ANSI escape sequences.

- **Decision:** Adopt a zero-tolerance policy for `eslint-disable` comments and `as any` casts:
  1. **No `eslint-disable`** — if a rule fires, fix the code. If the rule is wrong for the project, disable it in `.eslintrc` globally with justification.
  2. **No `as any`** — use proper generics, `unknown` with type guards, or well-typed interfaces. The only acceptable type escape hatches are `as never` (for generic variance boundaries in internal plumbing) and `as unknown as T` (for test doubles where the full interface isn't needed).
  3. **Typed browser globals** — E2E tests declare a `Window` augmentation (`test/e2e/types/test-window.d.ts`) so Playwright `page.evaluate()` calls are fully typed instead of using `window as any`.
  4. **`catch (e: unknown)`** — error handlers use `unknown` with `instanceof Error` guards, never `catch (e: any)`.

- **Consequences:** All type errors surface at compile time. Refactoring tools can follow types through the entire codebase including tests. No hidden suppressions. Trade-off: slightly more verbose catch blocks and occasionally verbose generic constraints, but this is a feature, not a cost — it forces explicit handling of edge cases.

## ADR-021: CI pipeline — full validation with skip-ci artifact commits

- **Status:** Accepted
- **Date:** 2026-03-23

- **Context:** The local quality gate (`npm run gate`) runs format, lint, build, unit tests, functional E2E, metrics collection, and docs build. Performance benchmarks (`test:bench`) are excluded locally to keep push times fast (~60s vs ~3min+). CI needs to run _everything_ — including benchmarks and demo package validation — but bot-generated artifact commits (metrics, screenshots) must not re-trigger CI, creating infinite loops.

- **Decision:** Establish a two-tier validation pipeline with `[skip ci]` loop prevention:
  1. **Local (pre-push hook):** `npm run gate` — all non-performance checks. Bench tests excluded via `grepInvert: /@bench/` in the default Playwright config. Auto-commits updated artifacts with `[skip ci]`.
  2. **CI (push/PR to main):** `npm run gate:full` = gate + `gate:bench` (performance benchmarks) + demo package installation and builds. On push to main, auto-commits updated artifacts with `[skip ci]`. GitHub Actions natively skips workflows on `[skip ci]` commits, preventing infinite loops.
  3. **Nightly (scheduled):** Upgrades all dependencies (root + demos via `ncu`), installs everywhere, runs `gate:full`. Commits updated lockfiles, package.json files, and build artifacts with `[skip ci]`.

  Commit messages follow intention-driven Conventional Commits: title expresses _why_, body explains _what_. Bot commits use `chore:` type with `[skip ci]`.

- **Consequences:** Performance benchmarks run on every CI push without blocking local development. Demo packages are validated in CI, catching breakage from upstream dependency changes. `[skip ci]` prevents infinite commit loops from bot artifact commits. Trade-off: CI runs take longer (~3-5min vs ~60s local), but this is acceptable for a CI job that runs asynchronously.

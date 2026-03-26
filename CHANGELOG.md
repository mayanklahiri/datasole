# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Unreleased

Complete rewrite of datasole. The 0.x line was a Webpack/Pug/SCSS/WebSocket prototyping tool;
1.0.0 is a production-grade, binary-framed, realtime full-stack TypeScript framework.

### Changed

#### Server API hierarchy [ADR-019]

- **`DatasoleServer`** exposes **`ds.transport`** (attach, connection count), **`ds.localServer`** (broadcast, typed state, sync/data channels), **`ds.rpc`**, **`ds.metrics`**, and **`ds.primitives`** (`state`, `events`, `crdt`, `sessions`, `rateLimiter`). Transport and local-server facades expose **`readonly server`** for sibling access.
- **`initialize()`** removed; use **`await ds.init()`** before **`ds.transport.attach(httpServer)`** for backends with **`connect()`** (and optional **`RateLimiter.connect()`**).
- **`BackendRateLimiter`** renamed to **`DefaultRateLimiter`**; optional **`rateLimiter`** injection in **`DatasoleServerOptions`**.
- **`metricsExporter`** removed from server options — call **`MetricsExporter.export(ds.metrics.snapshot())`** from application code.

### Added

#### Documentation & ADRs

- **ADR-017** — Contract-first integration style (`AppContract` + enums) for apps, docs, and generated code
- **ADR-018** — Canonical server extension surface (one `StateBackend`, `rateLimit` / injectable `RateLimiter`, upgrade-only `authHandler`); avoids hallucinated hooks in agentic tooling
- **ADR-019** — Hierarchical `DatasoleServer` API, `init()`, `DefaultRateLimiter`, facade `server` back-reference
- **README** — Project snapshot table (version, tests, coverage, bundles) with capture timestamp

#### Architecture

- **Composable layer architecture**: DatasoleServer decomposed into Transport, Executor, Backends, and Primitives layers [ADR-012]
- **Type-safe contracts**: `DatasoleContract` generic type parameter required on `DatasoleServer<T>` and `DatasoleClient<T>`
- **Enum-based keys**: RPC methods, events, and state keys use TypeScript enums shared between client and server
- **Contract key aliases**: `RpcMethodKey<T>`, `EventName<T>`, and `StateKeyName<T>` exported from `datasole` for explicit API signatures (pair with string enums / `as const` key maps)
- **Backend as distribution layer**: All stateful services (EventBus, CrdtManager, SyncChannel, RateLimiter) receive StateBackend via constructor injection
- **ConnectionExecutor**: Replaces dead-code concurrency module with frame-processing isolation (async, thread, pool, process models)
- **ServerTransport**: Pure byte pipe with pre-executor rate limit gate
- **FrameRouter**: Opcode-based frame dispatch inside executor context
- **DefaultRateLimiter**: Unified rate limiter backed by StateBackend (replaces MemoryRateLimiter + RedisRateLimiter)
- **CrdtManager**: Extracted CRDT logic into backend-powered primitive
- **RealtimePrimitive interface**: Shared `destroy()` lifecycle for all services
- **BackendConfig + createBackend()**: Serializable factory pattern for multi-context backend instantiation
- **Demo shared contracts**: Each demo has `shared/contract.ts` with AppContract + enums
- Exposed API: `ds.rpc`, `ds.metrics`, `ds.transport`, `ds.localServer`, `ds.primitives` (`state`, `events`, `crdt`, `sessions`, `rateLimiter`)

#### Core Framework

- Binary WebSocket wire protocol with 9-byte frame envelope (opcode, correlation ID, payload length)
- Seven composable data-flow patterns: RPC, server events, client events, server→client live state, client→server live state, CRDT sync, and arbitrary combinations
- `DatasoleClient` — framework-agnostic browser client (React, Vue 3, Svelte, vanilla JS)
- `DatasoleServer` — Node.js server with `transport.attach(httpServer)` integration
- Web Worker transport (WebSocket runs off the main thread by default; no UI jank)
- SharedArrayBuffer zero-copy path with automatic `postMessage` fallback
- pako compression (60–80% smaller than raw JSON) running in the worker thread; zlib magic-byte detection for robust compression identification
- `workerUrl` option on `DatasoleClientOptions` — configurable path for the Web Worker script (default: `${path}/datasole-worker.iife.min.js`)

#### State Synchronization

- JSON Patch–based incremental state sync (server→client)
- `SyncChannel` with configurable flush strategies: immediate, batched, debounced
- Pluggable state backends: in-memory (default), Redis, PostgreSQL

#### CRDTs

- `PNCounter` — positive-negative counter with distributed increment/decrement
- `LWWRegister` — last-writer-wins register with HLC timestamps
- `LWWMap` — last-writer-wins map built on LWWRegister entries
- `CrdtStore` — client-side store with type registration, merge, and serialization

#### Server Infrastructure

- Three concurrency models: async (event loop), thread (worker_threads), thread pool (default)
- In-memory and Redis rate limiters with sliding-window counters (configurable per-method rules, default 100 req/min/connection)
- Prometheus and OpenTelemetry metric exporters (connection counts, message rates, latencies)
- Per-connection session persistence with save/restore across reconnections
- Framework adapters: Express, NestJS, Fastify, native `http.createServer()`

#### Security

- Maximum frame size validation (configurable, default 1 MB) — oversized frames are dropped
- Maximum connections per server (configurable, default 10 000)
- Event name validation (length limit, character whitelist, reserved-prefix rejection)
- RPC method name validation (length limit, character whitelist)
- Decompression bomb protection (maximum decompressed payload size 10 MB)
- JSON parse error isolation — malformed frames do not crash the server
- Auth handler exception isolation — thrown errors deny access gracefully

#### RPC & Events

- Typed RPC dispatcher with correlation IDs and error propagation
- Bidirectional event bus with namespaced event routing
- Auth handler hook (`authHandler`) with per-connection identity and metadata

#### Build & Distribution

- Single npm package with ESM (`.mjs`), CJS (`.cjs`), and IIFE bundles plus `.d.ts` declarations
- `package.json` `exports` map with `import`/`require`/`browser`/`types` conditions
- `typesVersions` for older TypeScript resolution
- Rollup multi-target build: client IIFE (~22 KB gzip), worker IIFE (~15 KB gzip), client ESM/CJS, server ESM/CJS, shared ESM/CJS
- Shared dependencies (`pako`, `fast-json-patch`) bundled inline for Node ESM compatibility
- Colored build artifact summary (`build/print-build-summary.ts`) with ANSI-aware column alignment, printed after every build
- npm release workflow with dry-run support
- Pre-push hook auto-commits gate artifacts (screenshots, metrics)

#### Demos

- Three independent demo apps: Vanilla JS/Node.js, React + Express, Vue 3 + NestJS
- Each demo implements live server metrics (CPU, memory, load, CPU count, RAM size, local time, timezone), global chat room with history replay, and RPC random number generator
- Dev and production modes with framework-native build tooling (Vite for React/Vue, plain Node.js for vanilla)
- GitHub repository link and contextual help text in each demo component
- Demo e2e test suite (`npm run test:e2e:demos`) with Playwright: installs, builds, starts in production mode, validates real-time features, and generates screenshots
- Demo build artifacts included in build summary when present
- React demo: `DatasoleProvider` context + `useDatasoleEvent` / `useDatasoleState` / `useDatasoleClient` hooks — no Redux, no Zustand, just hooks that return state
- Vue demo: `useDatasole()` provide/inject composable + `useDatasoleEvent` / `useDatasoleState` / `useDatasoleClient` composables — no Vuex, no Pinia, just reactive refs
- CSS animations in React and Vue demos: connection dot pulse, message slide-in, RPC result pop, history slide-in, hover glow on metric cards, message count and avg latency badges
- Derived values in React (`useMemo`) and Vue (`computed`) demos to showcase idiomatic framework integration

#### Testing & Quality

- 485 Vitest unit tests across 50 test files with v8 coverage
- 60 Playwright e2e tests (48 core + 12 demos) across desktop/mobile viewports
- E2e benchmark framework measuring throughput, latency, and main-thread impact:
  - Server→client broadcast flood
  - Server→client state mutation flood
  - Client→server RPC echo throughput
  - Binary frame streaming (e.g., audio/video metadata)
  - Under-threshold RPC throughput (small packets, no compression)
  - Over-threshold RPC throughput (large packets, compressed)
  - Two-way low-latency emit (game tick / trade confirmation pattern)
  - Mixed workload (concurrent RPC + events + state)
  - Main-thread blocking comparison: worker vs no-worker with 4× CPU throttling, measuring Long Tasks, rAF jitter, jank frames, and dropped frames
- Keyed screenshot baselines with pixelmatch pixel-diff comparison
- Browser console error/warning tracking per benchmark scenario (recorded in metrics table and time-series graphs)
- System info collection in benchmarks (OS, CPU, cores, memory, Node.js version) displayed on performance dashboard
- Unified quality gate (`npm run gate`): format → lint → build → unit tests → e2e → benchmarks → metrics → docs → summary
- Pre-commit (lint-staged) and pre-push (full gate) git hooks
- CI: GitHub Actions matrix on Node 22 LTS and Node 24
- Nightly dependency update workflow includes all demo packages

#### Documentation

- VitePress documentation site with 21 pages
- Progressive 10-step tutorial from hello-world to collaborative task board
- Copy-paste examples organized by pattern
- Full client and server API reference with Mermaid architecture diagrams
- Wire protocol specification
- Integration guides (NestJS + Vue 3, Next.js + Express, Express + React, AdonisJS + vanilla JS)
- Demo walkthrough pages with code samples and auto-generated screenshots
- Performance dashboard with historical benchmark trends (throughput, latency, main-thread impact)
- Composability documentation showing mix-and-match data-flow patterns
- Competitive analysis (vs Socket.IO, Liveblocks, PartyKit, Yjs, Automerge)
- 16 Architecture Decision Records (ADRs)
- `AGENTS.md` for AI coding assistants with integration patterns and codebase-health skill
- File-level docblocks on all source, test, and build modules
- `.prettierignore` to exclude build artifacts, lockfiles, and binaries from formatting

### Changed

- **BREAKING**: `DatasoleClient` now defaults to `useWorker: true` (was `false`) — WebSocket runs in a Web Worker by default; set `useWorker: false` for environments without Workers (React Native, SSR, Node.js)
- Package name retained as `datasole`; description updated
- Minimum Node.js version: **22** (was unspecified in 0.x)
- Default branch renamed from `master` to `main`
- Compression detection uses zlib magic byte instead of size-threshold heuristic for reliable identification of pre-compressed frames
- Main Playwright config excludes demo specs (run separately via `test:e2e:demos`)
- Performance benchmarks run in isolation via dedicated Playwright config (`playwright.bench.config.ts`, `workers: 1`, sequential execution)
- Metrics history deduplicates by calendar date (one entry per day, latest wins)
- `format` / `format:check` scripts widened from narrow `src/test` globs to `prettier --write .` (covers entire project via `.prettierignore`)
- `lint-staged` expanded to cover `build/`, `test/e2e/`, `demos/`, `docs/` file types in addition to `src/` and `test/unit/`
- Demo dependencies upgraded to latest versions (React 19, Vue 3, Express 5, NestJS 11, Vite 8, TypeScript 5.9)
- React demo client walkthrough in docs replaced `useDatasole` prop-drilling pattern with `DatasoleProvider` + hooks
- Vue demo client walkthrough in docs replaced manual `onMounted`/`onUnmounted` with composable-based pattern
- Docs onboarding IA refreshed: new Developer Guide landing path, Getting Started sidebar now prioritizes Developer Guide and removes Examples, and homepage CTAs were shortened (`Get started`, `Protocol Spec`)
- Optional dependency loaders (`pg`, `ioredis`) and OpenTelemetry metrics use narrower runtime checks and typed bridges instead of double casts; static asset responses silence subsequent `setHeader`/`writeHead`/`end` with typed no-ops; PN-counter merge reads vector metadata via a small parser; README and docs-site landing numbers match current build output and Vitest/Playwright counts; live-server unit tests use a shared `liveSrv()` helper and explicit HTTP teardown where `DatasoleServer.close()` runs alone; React + Express demo e2e runs load, metrics, chat, and RPC in one Playwright session inside a fresh context so a second cold navigation does not hit a long `reconnecting` stall after the first WebSocket teardown

### Fixed

- ESM server/shared import compatibility (`.mjs` extensions, bundled shared deps)
- `@eslint/js` added as explicit dev dependency for ESLint 10 compatibility
- `DatasoleServer` honors `backendConfig` (mutually exclusive with `stateBackend`) and exposes `init()` for backends with `connect()` (Redis, Postgres) [ADR-016]
- `thread` / `thread-pool` executors delegate frame routing to the same `AsyncExecutor` path as `async` instead of dropping frames [ADR-016]
- `PostgresBackend` rejects unsafe `tableName` values before SQL interpolation
- Vue + NestJS demo: `DatasoleServer.transport.attach()` runs before `listen()`; client uses default worker transport again
- Worker runtime asset (`datasole-worker.iife.min.js`) uses `Cross-Origin-Resource-Policy: cross-origin` (other isolation headers unchanged) so `new Worker()` works for typical SPAs and for COEP-enabled pages (e2e / SharedArrayBuffer)
- **`DatasoleClient.connect()`**: disposes any existing worker/WebSocket transport before opening a new one (reconnect no longer orphans the previous Worker, which could strand the session in `reconnecting` and break demo e2e on slow CI runners)
- **Client `StateStore`**: subscribers receive the current snapshot immediately on subscribe; incoming `STATE_PATCH` / `STATE_SNAPSHOT` frames create the per-key store if none exists yet (avoids dropped patches before the first subscriber)
- **Demo chat servers**: initial `setState('chat:messages', chatHistory)` now passes `[...chatHistory]` — `MemoryBackend` retains the array by reference; pushing into the same array and then `setState([...chatHistory])` previously produced an empty diff and no broadcast
- **CI `deploy-docs` job**: `actions/deploy-pages@v5` / `upload-pages-artifact@v5` are not published — pin to `deploy-pages@v4` and `upload-pages-artifact@v3` (v3 retains `.nojekyll`; v4 of upload-pages-artifact omits dotfiles)
- **CI artifact commit**: use `git commit --no-verify` / `git push --no-verify` for the bot’s metrics commit so Husky does not run `npm run gate` (which deletes `docs-site/dist` before the docs-site artifact upload)

### Removed

- Entire 0.x codebase: Webpack, Pug, SCSS, Express dev server, HMR, CLI scaffolding
- All 0.x dependencies (90+ packages replaced by ~15)

---

## [0.4.4] — 2020-01-15

_Legacy release. Last version of the original prototyping tool._

### Fixed

- Minor bug fixes and dependency updates

## [0.4.3] — 2019-12-10

### Fixed

- Dependency security patches

## [0.4.2] — 2019-11-20

### Fixed

- Build output fixes

## [0.4.1] — 2019-11-15

### Fixed

- Minor fixes

## [0.4.0] — 2019-11-10

### Added

- Initial public release of datasole prototyping tool

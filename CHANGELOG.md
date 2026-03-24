# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No unreleased changes._

---

## [1.0.0] — 2026-03-20

Complete rewrite of datasole. The 0.x line was a Webpack/Pug/SCSS prototyping tool;
1.0.0 is a production-grade, binary-framed, realtime full-stack TypeScript framework.

### Added

#### Core Framework

- Binary WebSocket wire protocol with 9-byte frame envelope (opcode, correlation ID, payload length)
- Seven composable data-flow patterns: RPC, server events, client events, server→client live state, client→server live state, CRDT sync, and arbitrary combinations
- `DatasoleClient` — framework-agnostic browser client (React, Vue 3, Svelte, vanilla JS)
- `DatasoleServer` — Node.js server with `attach(httpServer)` integration
- Web Worker transport (WebSocket runs off the main thread by default; no UI jank)
- SharedArrayBuffer zero-copy path with automatic `postMessage` fallback
- pako compression (60–80% smaller than raw JSON) running in the worker thread; zlib magic-byte detection for robust compression identification
- `workerUrl` option on `DatasoleClientOptions` — configurable path for the Web Worker script (default: `/datasole-worker.iife.min.js`)

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

- Four concurrency models: async (event loop), thread (worker_threads), thread pool (default), process (child_process)
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

#### Testing & Quality

- 525 Vitest unit tests across 52 test files with v8 coverage (~90% line coverage)
- 65 Playwright e2e tests across 10 spec files (desktop 1280×720 + Pixel 7 mobile viewports)
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
- Unified quality gate (`npm run gate`): format → lint → build → unit tests → e2e → metrics → docs → summary
- Pre-commit (lint-staged) and pre-push (full gate) git hooks
- CI: GitHub Actions matrix on Node 22 LTS and Node 24
- Nightly dependency update workflow includes all demo packages

#### Documentation

- VitePress documentation site with 22 pages
- Progressive 10-step tutorial from hello-world to collaborative task board
- Copy-paste examples organized by pattern
- Full client and server API reference with Mermaid architecture diagrams
- Wire protocol specification
- Integration guides (NestJS + Vue 3, Next.js + Express, Express + React, AdonisJS + vanilla JS)
- Demo walkthrough pages with code samples and auto-generated screenshots
- Performance dashboard with historical benchmark trends (throughput, latency, main-thread impact)
- Composability documentation showing mix-and-match data-flow patterns
- Competitive analysis (vs Socket.IO, Liveblocks, PartyKit, Yjs, Automerge)
- 17 Architecture Decision Records (ADRs)
- `AGENTS.md` for AI coding assistants with integration patterns and codebase-health skill
- File-level docblocks on all source, test, and build modules

### Changed

- **BREAKING**: `DatasoleClient` now defaults to `useWorker: true` (was `false`) — WebSocket runs in a Web Worker by default; set `useWorker: false` for environments without Workers (React Native, SSR, Node.js)
- Package name retained as `datasole`; description updated
- Minimum Node.js version: **22** (was unspecified in 0.x)
- Default branch renamed from `master` to `main`
- Compression detection uses zlib magic byte instead of size-threshold heuristic for reliable identification of pre-compressed frames
- Main Playwright config excludes demo specs (run separately via `test:e2e:demos`)

### Fixed

- ESM server/shared import compatibility (`.mjs` extensions, bundled shared deps)
- `@eslint/js` added as explicit dev dependency for ESLint 10 compatibility

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

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-03-20

Complete rewrite of datasole. The 0.x line was a Webpack/Pug/SCSS prototyping tool;
1.0.0 is a production-grade, binary-framed, realtime full-stack TypeScript framework.

### Added

#### Core Framework

- Binary WebSocket wire protocol with 9-byte frame envelope (opcode, correlation ID, payload length)
- Seven composable data-flow patterns: RPC, server events, client events, server→client live state, client→server live state, CRDT sync, and arbitrary combinations
- `DatasoleClient` — framework-agnostic browser client (React, Vue 3, Svelte, vanilla JS)
- `DatasoleServer` — Node.js server with `attach(httpServer)` integration
- Web Worker transport (WebSocket runs off the main thread; no UI jank)
- SharedArrayBuffer zero-copy path with automatic `postMessage` fallback
- pako compression (60–80% smaller than raw JSON) running in the worker thread

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
- In-memory rate limiter with sliding window (Redis adapter stub)
- Prometheus and OpenTelemetry metric exporters (connection counts, message rates, latencies)
- Per-connection session persistence with save/restore across reconnections
- Framework adapters: Express, NestJS, Fastify, native `http.createServer()`

#### RPC & Events

- Typed RPC dispatcher with correlation IDs and error propagation
- Bidirectional event bus with namespaced event routing
- Auth handler hook (`authHandler`) with per-connection identity and metadata

#### Build & Distribution

- Single npm package with ESM (`.mjs`), CJS (`.cjs`), and IIFE bundles plus `.d.ts` declarations
- `package.json` `exports` map with `import`/`require`/`browser`/`types` conditions
- `typesVersions` for older TypeScript resolution
- Rollup multi-target build: client IIFE (20.9 KB gzip), client ESM/CJS, worker IIFE, server ESM/CJS, shared ESM/CJS
- Shared dependencies (`pako`, `fast-json-patch`) bundled inline for Node ESM compatibility

#### Testing & Quality

- 122 Vitest unit tests across 26 test files with v8 coverage
- 38 Playwright e2e tests (19 specs × 2 viewports: desktop 1280×720 + Pixel 7 mobile)
- Keyed screenshot baselines with pixelmatch pixel-diff comparison
- Unified quality gate (`npm run gate`): format → lint → build → unit tests → e2e → metrics → docs → summary
- Pre-commit (lint-staged) and pre-push (full gate) git hooks
- CI: GitHub Actions matrix on Node 22 LTS and Node 24

#### Documentation

- VitePress documentation site with 15 pages
- Progressive 10-step tutorial from hello-world to collaborative task board
- Copy-paste examples organized by pattern
- Full client and server API reference
- Architecture diagrams, wire protocol spec, ADR log
- Competitive analysis (vs Socket.IO, Liveblocks, PartyKit, Yjs, Automerge)
- `AGENTS.md` for AI coding assistants

### Changed

- Package name retained as `datasole`; description updated
- Minimum Node.js version: **22** (was unspecified in 0.x)
- Default branch renamed from `master` to `main`

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

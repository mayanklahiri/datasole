# 0001 — Datasole Directory Structure and Build Architecture

## Overview

Design and scaffold the complete directory structure, build system, and test harness for "datasole" — a modern, realtime, binary-framed, full-stack TypeScript framework published as a single npm package with multi-target builds (browser IIFE, ESM/CJS modules, server bundles), shared code, Web Worker transport, pluggable backends, and comprehensive unit + e2e testing.

## Source Layout

Three top-level source modules with strict dependency direction: `shared` has zero internal deps; `client` and `server` depend only on `shared`.

- `src/shared/` — Protocol (opcodes, binary frames), codec (pako compression, serialization), diff (RFC 6902 JSON Patch), types, constants, build-constants
- `src/client/` — Worker transport (WebSocket in Web Worker, SharedArrayBuffer), main-thread proxy, state store, RPC client, events, auth provider, DatasoleClient class
- `src/server/` — WS server transport, pluggable auth, state manager with pluggable backends (memory/redis/postgres), RPC dispatcher, event bus, metrics (Prometheus/OTel), framework adapters (Express/NestJS/native HTTP), DatasoleServer class
- `src/index.ts` — Root barrel re-exporting client, server, shared

## Build System

Rollup with multi-target output:

- Client: IIFE (script tag), ESM, CJS bundles + worker IIFE
- Server: CJS + ESM (bundles ws, utf-8-validate, bufferutil)
- Shared: CJS + ESM
- Type declarations for all targets

## Key Decisions (see docs/decisions.md for full ADRs)

- ADR-001: Single npm package with conditional exports
- ADR-002: Worker-first WebSocket transport with SharedArrayBuffer
- ADR-003: Binary frames with pako compression end-to-end
- ADR-004: JSON Patch (RFC 6902) for state synchronization
- ADR-005: Pluggable state backends via interface
- ADR-006: Rollup for multi-target bundling
- ADR-007: Vitest for unit tests
- ADR-008: Playwright for e2e
- ADR-009: Framework-agnostic client
- ADR-010: Default WebSocket path `/__ds`

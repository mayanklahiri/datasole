---
layout: home
title: datasole
titleTemplate: Realtime TypeScript Framework
hero:
  name: datasole
  text: Realtime TypeScript framework
  tagline: Binary WebSocket transport in a Web Worker. JSON Patch state sync. Typed RPC. CRDTs. 36.2 KB gzip on the wire. One npm install.
  actions:
    - theme: brand
      text: Start the tutorial
      link: /tutorials
    - theme: alt
      text: See examples
      link: /examples
    - theme: alt
      text: GitHub
      link: https://github.com/mayanklahiri/datasole

features:
  - icon: ⚡
    title: Performance
    details: WebSocket runs in a Web Worker — no UI jank. Binary frames with pako compression (60–80% smaller than JSON). SharedArrayBuffer zero-copy transfer. Four server concurrency models. Client IIFE 21.5 KB gzip.
  - icon: ✓
    title: Correctness
    details: 122 unit tests + 38 e2e tests (Playwright, headless Chromium, production bundle — desktop 1280×720 + Pixel 7 mobile). CI matrix on Node 22 LTS and Node 24. Coverage thresholds enforced on every push. Strict TypeScript with .d.ts on every export. Shared types between client and server — no codegen, no drift.
  - icon: 🛠
    title: Developer experience
    details: Single npm package for client, server, shared types, and Web Worker. Works with React, Vue, Svelte, Next.js, Express, NestJS, Fastify. Progressive 10-step tutorial. Copy-paste examples. AGENTS.md for AI coding assistants.
  - icon: 🔄
    title: State synchronization
    details: Server→client sync via RFC 6902 JSON Patch (only diffs over the wire). Bidirectional sync via built-in CRDTs — LWW registers, PN counters, LWW maps. Configurable sync channels with immediate, batched, or debounced flush.
  - icon: 🏗
    title: Server architecture
    details: 'Four concurrency strategies: async (event loop), thread-per-connection, thread pool, process isolation. Pluggable persistence: memory, Redis, Postgres. Frame-level rate limiting. Session persistence across reconnections.'
  - icon: 📊
    title: Observability
    details: Prometheus and OpenTelemetry metric exporters. Connection counts, message rates, latency histograms, error rates. Quality gate with bundle size tracking on every CI push.
---

## Data flow patterns

datasole supports seven composable patterns — use one, or layer them:

| Pattern       | Direction                | Mechanism                                       |
| ------------- | ------------------------ | ----------------------------------------------- |
| RPC           | client → server → client | Typed request/response with correlation IDs     |
| Server events | server → clients         | Broadcast (stock ticker, notifications)         |
| Client events | client → server          | Fire-and-forget (chat, analytics)               |
| Live state    | server → clients         | JSON Patch auto-sync (dashboards, leaderboards) |
| CRDT sync     | client ↔ server          | Conflict-free merge (collaborative editing)     |
| Sync channels | configurable             | Immediate, batched, or debounced flush          |
| Combinations  | any                      | All patterns compose freely                     |

## Bundle sizes

All bundles include their runtime dependencies (pako, fast-json-patch). Verified by CI on every push.

| Bundle                | Loaded by               |      Raw |        Gzip |
| --------------------- | ----------------------- | -------: | ----------: |
| **Client IIFE** (min) | `<script>` tag          |  67.1 KB | **21.5 KB** |
| **Worker IIFE** (min) | Web Worker              |  46.5 KB | **14.7 KB** |
| **Shared** (ESM)      | Server or client import | 261.0 KB |     64.5 KB |
| **Server** (ESM)      | Node.js `import`        | 430.8 KB |    100.5 KB |

A browser downloads the client IIFE (**21.5 KB** gzip) and the worker (**14.7 KB** gzip) = **36.2 KB** total.

## How it compares

See the full [comparison with Socket.IO, Ably, Pusher, Liveblocks, and PartyKit](/comparison).

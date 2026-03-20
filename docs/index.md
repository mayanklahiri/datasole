---
layout: home
title: datasole
titleTemplate: Realtime TypeScript Framework
hero:
  name: datasole
  text: The full-stack realtime primitive for TypeScript
  tagline: 'Production-proven at Fortune 50 scale. One npm install — you own the server, the data, and the deployment.'
  actions:
    - theme: brand
      text: Get started in 2 minutes
      link: /tutorials
    - theme: alt
      text: See live examples
      link: /examples
    - theme: alt
      text: GitHub
      link: https://github.com/mayanklahiri/datasole

features:
  - icon: 🏢
    title: Battle-tested at scale
    details: Powers realtime control-plane infrastructure at a Fortune 50 cloud provider. Not a weekend project — built for production workloads with thousands of concurrent connections.
  - icon: 🧵
    title: Off-main-thread by default
    details: 'WebSocket runs in a dedicated Web Worker. Your UI thread never touches network I/O. On supported browsers, SharedArrayBuffer enables zero-copy frame transfer.'
  - icon: 📦
    title: One package, zero vendor lock-in
    details: 'Client, server, shared types, Web Worker, and .d.ts declarations — all from a single npm install. No platform signup. No per-message pricing. Deploy anywhere.'
  - icon: 🔄
    title: Automatic state synchronization
    details: 'Server mutates state, clients get diffs — not full snapshots. JSON Patch operations mean the wire carries only what changed. No manual diffing code to write.'
  - icon: 🤝
    title: Built-in CRDTs
    details: 'LWW registers, PN counters, LWW maps — conflict-free bidirectional sync out of the box. Multiple clients edit the same data structure concurrently with guaranteed convergence.'
  - icon: ⚡
    title: Binary compressed wire protocol
    details: '9-byte binary frame headers with pako compression. 60–80% smaller than JSON text on the wire. The entire client + worker is 36 KB gzip.'
  - icon: 📞
    title: Typed RPC over WebSocket
    details: 'Multiplexed request/response with correlation IDs, timeouts, and concurrent in-flight. TypeScript generics flow from server handler to client call site — no codegen step.'
  - icon: 📡
    title: Bidirectional events
    details: 'Server broadcast (stock tickers, notifications) and client-to-server fire-and-forget (analytics, chat). Type-safe, multiplexed on the same connection.'
  - icon: 🔀
    title: Four server concurrency models
    details: 'Event loop (lowest overhead), thread-per-connection (worker_threads), thread pool (default), process isolation (child_process). All cluster-friendly with pm2.'
  - icon: 💾
    title: Pluggable state backends
    details: 'In-memory (default), Redis (ioredis), or PostgreSQL (pg). Session persistence across disconnections. Change streams for external event systems.'
  - icon: 🛡️
    title: Frame-level rate limiting
    details: 'Rate limit at the WebSocket frame level, not HTTP. Per-method rules. MemoryRateLimiter for single process, RedisRateLimiter for distributed deployments.'
  - icon: 🎯
    title: Sync channels with tunable flush
    details: 'Control when diffs reach clients: immediate (latency-sensitive), batched (throughput), or debounced (user input). Per-key configuration.'
  - icon: 📊
    title: Observability built in
    details: 'Prometheus and OpenTelemetry metric exporters. Connection counts, message rates, latency histograms, error rates. Bundle size tracking in CI.'
  - icon: 🔧
    title: Works with your stack
    details: 'React, Vue, Svelte, React Native, vanilla JS on the frontend. Express, NestJS, Fastify, http.createServer() on the backend. ESM, CJS, and IIFE bundles.'
  - icon: ✅
    title: Rigorous quality gate
    details: '203 unit tests + 38 e2e tests (Playwright, desktop + mobile). CI on Node 22 LTS and 24. Strict TypeScript. Format, lint, build, coverage, e2e, metrics, and docs — enforced on every push.'
  - icon: 🧩
    title: Fully composable
    details: 'RPC, events, live state, CRDTs, sync channels, sessions — use one or all seven on the same connection. No mode switches, no channel subscriptions, no routing config. They just work together.'
  - icon: 📖
    title: Progressive tutorial
    details: '10 steps from hello-world to production. Each step adds one concept in ~10 lines of code. Every step has a working example and e2e screenshot.'
---

<style>
.fortune50-callout {
  margin: 2rem auto;
  padding: 1rem 1.5rem;
  border-left: 4px solid var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
  border-radius: 0 8px 8px 0;
  font-size: 1.05rem;
  max-width: 720px;
}
.fortune50-callout strong {
  color: var(--vp-c-brand-1);
}
</style>

## Seven composable patterns

Use one, or combine them freely on a single WebSocket connection:

| Pattern       | Direction                | What it does                                   |
| ------------- | ------------------------ | ---------------------------------------------- |
| RPC           | client → server → client | Typed request/response with correlation IDs    |
| Server events | server → clients         | Broadcast to all connected clients             |
| Client events | client → server          | Fire-and-forget (chat, analytics, telemetry)   |
| Live state    | server → clients         | Automatic JSON Patch sync (dashboards, boards) |
| CRDT sync     | client ↔ server          | Conflict-free merge (collaborative editing)    |
| Sync channels | configurable             | Immediate, batched, or debounced flush per key |
| Combinations  | any                      | All patterns compose on one connection         |

**No other library gives you all seven as first-class APIs on one connection.** See [Composability](/composability) for examples of combining patterns (dashboard + actions, chat + presence, collab + voting, analytics pipeline).

## Bundle sizes

Shared and server bundles externalize runtime deps. Client bundles inline everything for zero-dependency browser use.

| Bundle                | Loaded by             |     Raw |        Gzip |
| --------------------- | --------------------- | ------: | ----------: |
| **Client IIFE** (min) | `<script>` tag        | 69.7 KB | **21.4 KB** |
| **Worker IIFE** (min) | Web Worker            | 47.6 KB | **15.0 KB** |
| **Shared** (ESM)      | `import` from bundler | 10.3 KB |      2.5 KB |
| **Server** (ESM)      | Node.js `import`      | 64.0 KB |     12.7 KB |

## How it compares

See the full [comparison with Socket.IO, Ably, Pusher, Liveblocks, and PartyKit](/comparison).

---
layout: home
title: datasole
titleTemplate: Realtime TypeScript Framework
hero:
  name: datasole
  text: The full-stack realtime primitive for TypeScript
  tagline: 'One npm install — server, client, shared types, CRDTs, and Web Worker all included. Self-hosted, Apache-2.0, free forever.'
  image:
    src: /datasole-logo.png
    alt: datasole
  actions:
    - theme: brand
      text: Get started
      link: /developer-guide
    - theme: alt
      text: Protocol Spec
      link: /protocol
    - theme: alt
      text: GitHub
      link: https://github.com/mayanklahiri/datasole

features:
  - icon:
      src: /features/full-stack-ts.jpg
    title: Fully native TypeScript, one package
    details: 'Written entirely in TypeScript with strict mode end-to-end. Server, client, shared types, Web Worker, and .d.ts declarations — all from a single npm install. No codegen, no separate client/server packages. ESM, CJS, and IIFE bundles included.'
  - icon:
      src: /features/frameworks.jpg
    title: Works with your stack
    details: 'React, Vue, Svelte, React Native, vanilla JS on the frontend. Express, NestJS, Fastify, http.createServer() on the backend. ESM, CJS, and IIFE bundles. Drop it into any existing project.'
  - icon:
      src: /features/off-main-thread.jpg
    title: Off-main-thread networking + compression
    details: 'WebSocket runs in a dedicated Web Worker — your UI thread never touches network I/O. Every binary frame >256 B is compressed with pako in user-space. No permessage-deflate negotiation, no per-connection zlib state, no browser compat issues.'
  - icon:
      src: /features/binary-protocol.jpg
    title: Binary wire protocol
    details: '9-byte binary frame headers with pako compression. 60–80% smaller than JSON text on the wire. The entire client + worker is ~37.5 KB gzip.'
  - icon:
      src: /features/battle-tested.jpg
    title: Battle-tested in production
    details: Built for production workloads with thousands of concurrent connections. Not a weekend project — a deeply tested, observable, and scalable framework with end-to-end benchmarks on every CI run.
  - icon:
      src: /features/state-sync.jpg
    title: Automatic state synchronization
    details: 'Server mutates state, clients get diffs — not full snapshots. JSON Patch operations mean the wire carries only what changed. No manual diffing code to write.'
  - icon:
      src: /features/crdts.jpg
    title: Built-in CRDTs
    details: 'LWW registers, PN counters, LWW maps — conflict-free bidirectional sync out of the box. Multiple clients edit the same data structure concurrently with guaranteed convergence.'
  - icon:
      src: /features/typed-rpc.jpg
    title: Typed RPC over WebSocket
    details: 'Multiplexed request/response with correlation IDs, timeouts, and concurrent in-flight. TypeScript generics flow from server handler to client call site — no codegen step.'
  - icon:
      src: /features/events.jpg
    title: Bidirectional events
    details: 'Server broadcast (stock tickers, notifications) and client-to-server fire-and-forget (analytics, chat). Type-safe, multiplexed on the same connection.'
  - icon:
      src: /features/composable.jpg
    title: Fully composable
    details: 'RPC, events, live state, CRDTs, sync channels, sessions — use one or all seven on the same connection. No mode switches, no channel subscriptions, no routing config. They just work together.'
  - icon:
      src: /features/backends.jpg
    title: Pluggable state backends
    details: 'In-memory (default), Redis (ioredis), or PostgreSQL (pg). Session persistence across disconnections. Change streams for external event systems.'
  - icon:
      src: /features/rate-limiting.jpg
    title: Frame-level rate limiting
    details: 'Rate limit at the WebSocket frame level, not HTTP. Per-method rules. DefaultRateLimiter uses the configured StateBackend — automatically distributed with Redis or Postgres.'
  - icon:
      src: /features/sync-channels.jpg
    title: Sync channels with tunable flush
    details: 'Control when diffs reach clients: immediate (latency-sensitive), batched (throughput), or debounced (user input). Per-key configuration.'
  - icon:
      src: /features/observability.jpg
    title: Observability built in
    details: 'Prometheus and OpenTelemetry metric exporters. Connection counts, message rates, latency histograms, error rates. Bundle size tracking in CI.'
  - icon:
      src: /features/apache-license.jpg
    title: Apache-2.0, free forever
    details: 'Open source, corp-friendly license. No per-message pricing. No vendor lock-in. No "enterprise tier for production use." Self-host on your infra, your terms.'
  - icon:
      src: /features/scale.jpg
    title: Scale without "contact sales"
    details: 'Swap in Redis or Postgres endpoints and go from single-process to distributed — zero code changes. Three concurrency models (async, thread, thread-pool). pm2/k8s ready. Horizontal scaling is built in, not a pricing tier.'
  - icon:
      src: /features/tutorial.jpg
    title: Progressive tutorial
    details: 'Start with the Developer Guide for integration into existing apps, then use the 10-step tutorial for a full walkthrough from hello-world to production.'
---

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

## Performance benchmarks

Measured end-to-end with headless Chromium against a live Node.js server — not synthetic microbenchmarks. Every gate run re-measures. Web Worker transport and pako compression enabled (defaults).

| What                       |              Result | What it means                                                                     |
| -------------------------- | ------------------: | --------------------------------------------------------------------------------- |
| **RPC round-trip**         |    **p50 < 0.5 ms** | Call a server function and get a typed response back in under half a millisecond  |
| **RPC small payload**      |    **p50 < 0.4 ms** | Tiny JSON body under compression threshold — minimal overhead                     |
| **RPC large JSON**         |      **p50 ~18 ms** | Randomized ~1 KB JSON payload, pako-compressed on the wire                        |
| **Binary frame streaming** | **~6,900 frames/s** | Server pushes 1 KB binary-like frames (audio/video metadata) at max rate          |
| **Two-way game tick**      |       **p50 ~4 ms** | Client emit → server echo → client ack — full round-trip at emit speed            |
| **Server event broadcast** |   **~920 events/s** | Push live updates to connected clients at nearly 1,000 events per second          |
| **Client fire-and-forget** |  **~235K events/s** | Client → server emit throughput: 235,000+ events per second                       |
| **CRDT sync**              |    **~1,300 ops/s** | Conflict-free counter increments with full round-trip sync                        |
| **Mixed workload**         |    **p50 < 0.4 ms** | RPC + events + state combined — sub-millisecond median under mixed load           |
| **Main-thread blocking**   |       **near zero** | With Web Worker transport, the UI thread sees no Long Tasks even under flood load |
| **Console errors**         |            **zero** | Zero browser console errors or warnings across all benchmark scenarios            |

<p style="font-size: 0.82rem; color: var(--vp-c-text-3); margin-top: -0.5rem;">
3 s sustained load per scenario, single Node.js process, Chromium browser. Main-thread impact measured via Long Tasks API + rAF jitter. Console health tracked per-scenario.
<a href="/datasole/performance">Full benchmark results, historical trends, and charts →</a>
</p>

## Bundle sizes

Client bundles inline everything for zero-dependency browser use. Server and shared bundles externalize runtime deps.

| Bundle                | Loaded by             |     Raw |        Gzip |
| --------------------- | --------------------- | ------: | ----------: |
| **Client IIFE** (min) | `<script>` tag        | 72.0 KB | **22.2 KB** |
| **Worker IIFE** (min) | Web Worker            | 48.3 KB | **15.3 KB** |
| **Shared** (CJS)      | `import` from bundler | 15.3 KB |      4.0 KB |
| **Server** (CJS)      | Node.js `require`     | 72.1 KB |     16.1 KB |

## Use cases

datasole is a good fit anywhere you need performant, scalable realtime communication:

| Category           | Examples                                                             |
| ------------------ | -------------------------------------------------------------------- |
| **Games**          | Multiplayer lobbies, turn-based games, realtime scoreboards          |
| **Internal tools** | Admin dashboards, monitoring panels, ops consoles                    |
| **Analytics**      | Live metrics dashboards, A/B test monitors, funnel viewers           |
| **Native apps**    | Bun single-executable, Node SEA, Electron, Tauri — with rich web UIs |
| **Streaming**      | Internet radio, watch parties, live commentary sync                  |
| **Local servers**  | Dev tool frontends, CLI web UIs, process managers                    |
| **Collaboration**  | Shared whiteboards, collaborative editing, design tools              |
| **IoT**            | Device control panels, telemetry viewers, sensor networks            |
| **Finance**        | Trading data feeds, portfolio trackers, auction platforms            |
| **Communication**  | Live chat, customer support, classroom Q&A                           |
| **DevOps**         | CI/CD pipeline walls, deployment status, log streaming               |

## How it compares

See the full [comparison with Socket.IO, Ably, Pusher, Liveblocks, and PartyKit](/comparison).

---
layout: home
title: datasole
titleTemplate: Realtime TypeScript Framework
hero:
  name: datasole
  text: The full-stack realtime primitive for TypeScript
  tagline: 'Production-proven at Fortune 50 scale. One npm install — server, client, shared types, CRDTs, and Web Worker all included. Self-hosted, Apache-2.0, free forever.'
  image:
    src: /datasole-logo.png
    alt: datasole
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
  - icon:
      src: /features/battle-tested.png
    title: Battle-tested at Fortune 50
    details: Powers realtime control-plane infrastructure at a Fortune 50 cloud provider. Not a weekend project — built for production workloads with thousands of concurrent connections.
  - icon:
      src: /features/full-stack-ts.png
    title: Full-stack TypeScript, one package
    details: 'Server, client, shared types, Web Worker, and .d.ts declarations — all from a single npm install. No codegen, no separate client/server packages. ESM, CJS, and IIFE. The single-language full-stack coverage that no other realtime library offers.'
  - icon:
      src: /features/compression.png
    title: Guaranteed compression
    details: 'Every binary frame >256 B is compressed with pako in user-space. No permessage-deflate negotiation, no per-connection zlib state, no browser compat issues. Socket.IO disabled permessage-deflate by default due to memory leaks — datasole sidesteps the problem entirely.'
  - icon:
      src: /features/scale.png
    title: Scale without "contact sales"
    details: 'Swap in Redis or Postgres endpoints and go from single-process to distributed — zero code changes. Four concurrency models (async, thread, pool, process). pm2/k8s ready. Horizontal scaling is built in, not a pricing tier.'
  - icon:
      src: /features/apache-license.png
    title: Apache-2.0, free forever
    details: 'Open source, corp-friendly license. No per-message pricing. No vendor lock-in. No "enterprise tier for production use." Self-host on your infra, your terms.'
  - icon:
      src: /features/off-main-thread.png
    title: Off-main-thread networking
    details: 'WebSocket runs in a dedicated Web Worker. Your UI thread never touches network I/O. On supported browsers, SharedArrayBuffer enables zero-copy frame transfer.'
  - icon:
      src: /features/state-sync.png
    title: Automatic state synchronization
    details: 'Server mutates state, clients get diffs — not full snapshots. JSON Patch operations mean the wire carries only what changed. No manual diffing code to write.'
  - icon:
      src: /features/crdts.png
    title: Built-in CRDTs
    details: 'LWW registers, PN counters, LWW maps — conflict-free bidirectional sync out of the box. Multiple clients edit the same data structure concurrently with guaranteed convergence.'
  - icon:
      src: /features/binary-protocol.png
    title: Binary wire protocol
    details: '9-byte binary frame headers with pako compression. 60–80% smaller than JSON text on the wire. The entire client + worker is 36 KB gzip.'
  - icon:
      src: /features/typed-rpc.png
    title: Typed RPC over WebSocket
    details: 'Multiplexed request/response with correlation IDs, timeouts, and concurrent in-flight. TypeScript generics flow from server handler to client call site — no codegen step.'
  - icon:
      src: /features/events.png
    title: Bidirectional events
    details: 'Server broadcast (stock tickers, notifications) and client-to-server fire-and-forget (analytics, chat). Type-safe, multiplexed on the same connection.'
  - icon:
      src: /features/backends.png
    title: Pluggable state backends
    details: 'In-memory (default), Redis (ioredis), or PostgreSQL (pg). Session persistence across disconnections. Change streams for external event systems.'
  - icon:
      src: /features/rate-limiting.png
    title: Frame-level rate limiting
    details: 'Rate limit at the WebSocket frame level, not HTTP. Per-method rules. MemoryRateLimiter for single process, RedisRateLimiter for distributed deployments.'
  - icon:
      src: /features/sync-channels.png
    title: Sync channels with tunable flush
    details: 'Control when diffs reach clients: immediate (latency-sensitive), batched (throughput), or debounced (user input). Per-key configuration.'
  - icon:
      src: /features/observability.png
    title: Observability built in
    details: 'Prometheus and OpenTelemetry metric exporters. Connection counts, message rates, latency histograms, error rates. Bundle size tracking in CI.'
  - icon:
      src: /features/frameworks.png
    title: Works with your stack
    details: 'React, Vue, Svelte, React Native, vanilla JS on the frontend. Express, NestJS, Fastify, http.createServer() on the backend. ESM, CJS, and IIFE bundles.'
  - icon:
      src: /features/composable.png
    title: Fully composable
    details: 'RPC, events, live state, CRDTs, sync channels, sessions — use one or all seven on the same connection. No mode switches, no channel subscriptions, no routing config. They just work together.'
  - icon:
      src: /features/tutorial.png
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

---
title: Architecture
order: 1
description: High-level system design, data flow, protocol specification, and learning path.
---

# Architecture

> **New to datasole?** Start with the [Tutorials](tutorials.md) — they'll get you from zero to a running app faster than reading architecture docs. Come back here when you're curious about *why* things work the way they do.

## Learning Path

```
Start here
    │
    ▼
Tutorials ──────────── Run your first server + client in 2 minutes
    │                  Build up to a full real-time app in 10 steps
    │
    ▼
Examples ───────────── Copy-paste recipes organized by pattern
    │                  (RPC, events, live state, CRDT, combos)
    │
    ▼
Client API / Server API   Comprehensive reference for every method
    │
    ▼
Architecture (you are here)   Why the protocol, worker, and sync
    │                          model work the way they do
    │
    ▼
State Backends / Metrics      Swap persistence, wire up observability
    │
    ▼
ADRs (decisions.md) ──────── The full rationale for every major choice
```

## Overview

Datasole is a full-stack TypeScript framework for realtime applications. It provides synchronized server-to-client data structures, bidirectional events, concurrent RPC, and CRDT-based bidirectional sync — all over a single binary WebSocket connection.

## Data Flow Patterns

Datasole supports seven composable patterns. Use one, or combine them freely on a single connection:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. RPC              client ──request──► server ──response──►   │
│                                                                 │
│  2. Server events    server ────broadcast────► all clients      │
│                                                                 │
│  3. Client events    client ────event────► server               │
│                                                                 │
│  4. Live state       server ──JSON Patch──► client (auto-sync)  │
│      (s→c)                                                      │
│                                                                 │
│  5. Live state       client ──JSON Patch──► server              │
│      (c→s)                                                      │
│                                                                 │
│  6. CRDT sync        client ◄──merge──► server (conflict-free)  │
│                                                                 │
│  7. Combinations     any of the above, simultaneously           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The most common pattern for real-world apps is **client → server RPC + server → client live state**: the client sends actions, the server processes them and updates its model, and all clients see a live mirror. See [Tutorial 4](tutorials.md#4-live-state--a-server-synced-dashboard) and [Tutorial 10](tutorials.md#10-putting-it-all-together--a-collaborative-task-board).

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│  ┌──────────────┐      ┌──────────────────────────┐ │
│  │  Main Thread  │◄────►│      Web Worker          │ │
│  │              │ SAB/  │  ┌────────────────────┐  │ │
│  │ DatasoleClient│ PM   │  │  WebSocket (binary) │  │ │
│  │ StateStore   │      │  │  pako decompress    │  │ │
│  │ CrdtStore    │      │  │  Frame decode       │  │ │
│  │ RPC Client   │      │  └─────────┬──────────┘  │ │
│  └──────────────┘      │  └─────────┼─────────────┘ │
└──────────────────────────────────────┼───────────────┘
                                       │ Binary frames
                                       │ (pako compressed)
┌──────────────────────────────────────┼───────────────┐
│                   Server              │               │
│  ┌────────────────────────────────────┴────────────┐ │
│  │              DatasoleServer                      │ │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │ │
│  │  │ WsServer │ │ RPC      │ │ State Manager   │ │ │
│  │  │ (ws lib) │ │ Dispatch │ │ (JSON Patch)    │ │ │
│  │  └──────────┘ └──────────┘ └────────┬────────┘ │ │
│  │  ┌──────────┐ ┌──────────┐          │          │ │
│  │  │ EventBus │ │ Sessions │  ┌───────┴────────┐ │ │
│  │  └──────────┘ └──────────┘  │ State Backend  │ │ │
│  │  ┌──────────┐ ┌──────────┐  │ (memory/redis/ │ │ │
│  │  │ Metrics  │ │ RateLimit│  │  postgres)     │ │ │
│  │  └──────────┘ └──────────┘  └────────────────┘ │ │
│  │  ┌───────────────────────────────────────────┐  │ │
│  │  │ Concurrency: async|thread|pool|process    │  │ │
│  │  └───────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Wire Protocol

All communication uses binary frames with the following envelope:

| Byte Offset | Size | Field |
|---|---|---|
| 0 | 1 | Opcode (see `src/shared/protocol/opcodes.ts`) |
| 1 | 4 | Correlation ID (uint32, big-endian) |
| 5 | 4 | Payload length (uint32, big-endian) |
| 9 | N | Payload (pako-compressed if above threshold) |

Opcodes cover: RPC request/response, event, state snapshot, state patch, CRDT operation, CRDT state, ping/pong, error.

## Connection Lifecycle

1. Client creates `DatasoleClient` and calls `connect()`
2. Web Worker opens WebSocket to `wss://server/__ds`
3. Server receives HTTP upgrade → `authHandler` validates credentials
4. On success: `ConnectionContext` created with auth identity, metadata
5. Concurrency strategy assigns a worker (event loop / thread / process)
6. Server pushes initial state snapshots
7. Ongoing: incremental JSON Patches, events, RPC, CRDT ops — all multiplexed
8. On disconnect: session flushed to persistence for future restore

## Sync Channel Architecture

Sync channels decouple *what* is synchronized from *when* it's flushed:

```
Server state mutation
        │
        ▼
  SyncChannel.enqueue(patches)
        │
        ├── immediate → flush now
        ├── batched   → flush after N ops or M ms
        └── debounced → flush after M ms of quiet
                │
                ▼
        Serialize → compress → binary frame → WebSocket → client
```

## CRDT Merge Flow

```
Client A                    Server                    Client B
   │                          │                          │
   │  op: increment(+1)       │                          │
   ├─────────────────────────►│  apply(op)               │
   │                          ├─────────────────────────►│
   │                          │  broadcast merged state   │
   │◄─────────────────────────┤                          │
   │  merge(state)            │◄─────────────────────────┤
   │                          │  op: increment(+1)       │
   │                          │  apply(op)               │
   │◄─────────────────────────┤─────────────────────────►│
   │  merge(state)            │  broadcast merged state   │
   │                          │                          │
   │  counter: 2              │  counter: 2              │  counter: 2
```

All three nodes converge to the same value regardless of operation order.

## Further Reading

| Topic | Where |
|---|---|
| Step-by-step learning | [Tutorials](tutorials.md) |
| Copy-paste recipes | [Examples](examples.md) |
| Client methods | [Client API](client.md) |
| Server methods | [Server API](server.md) |
| Persistence options | [State Backends](state-backends.md) |
| Observability | [Metrics](metrics.md) |
| Why each decision was made | [ADRs](decisions.md) |

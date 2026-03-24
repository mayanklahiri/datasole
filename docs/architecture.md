---
title: Architecture
order: 1
description: High-level system design, data flow, protocol specification, and learning path.
---

# Architecture

> **New to datasole?** Start with the [Tutorials](tutorials.md) — they'll get you from zero to a running app faster than reading architecture docs. Come back here when you're curious about _why_ things work the way they do.

## Learning Path

```mermaid
flowchart TD
    A["Start here"] --> B["<b>Tutorials</b><br/>Run your first server + client in 2 minutes<br/>Build up to a full real-time app in 10 steps"]
    B --> C["<b>Examples</b><br/>Copy-paste recipes organized by pattern<br/>(RPC, events, live state, CRDT, combos)"]
    C --> D["<b>Client API / Server API</b><br/>Comprehensive reference for every method"]
    D --> E["<b>Architecture</b> — you are here<br/>Why the protocol, worker, and sync<br/>model work the way they do"]
    E --> F["<b>State Backends / Metrics</b><br/>Swap persistence, wire up observability"]
    F --> G["<b>ADRs</b> (decisions.md)<br/>The full rationale for every major choice"]
```

## Overview

Datasole is a full-stack TypeScript framework for realtime applications. It provides synchronized server-to-client data structures, bidirectional events, concurrent RPC, and CRDT-based bidirectional sync — all over a single binary WebSocket connection.

## Data Flow Patterns

Datasole supports seven composable patterns. Use one, or combine them freely on a single connection:

```mermaid
flowchart LR
    C([Client])
    S([Server])

    C -->|"1 · RPC request"| S
    S -->|"1 · RPC response"| C
    S -->|"2 · Server events (broadcast)"| C
    C -->|"3 · Client events"| S
    S -->|"4 · Live state s→c (JSON Patch)"| C
    C -->|"5 · Live state c→s (JSON Patch)"| S
    C <-->|"6 · CRDT sync (conflict-free)"| S
```

The most common pattern for real-world apps is **client → server RPC + server → client live state**: the client sends actions, the server processes them and updates its model, and all clients see a live mirror. See [Tutorial 4](tutorials.md#4-live-state--a-server-synced-dashboard) and [Tutorial 10](tutorials.md#10-putting-it-all-together--a-collaborative-task-board).

## System Diagram

```mermaid
flowchart TB
    subgraph Browser
        subgraph MT["Main Thread"]
            DC["DatasoleClient&lt;T&gt;"]
            SS[StateStore]
            CS[CrdtStore]
            RC[RPC Client]
        end
        subgraph WW["Web Worker"]
            WS["WebSocket (binary)"]
            PK["pako decompress"]
            FD["Frame decode"]
        end
        MT <-->|"SAB / postMessage"| WW
    end

    WS <-->|"Binary frames (pako compressed)"| WSS

    subgraph Server
        subgraph DS["DatasoleServer&lt;T&gt; (facade)"]
            subgraph Transport["Transport Layer"]
                WSS["ServerTransport → WsServer → Connection"]
            end
            subgraph Executor["Executor Layer"]
                FR["FrameRouter"]
                EX["ConnectionExecutor (async / thread / pool / process)"]
            end
            subgraph Backend["Backend Layer"]
                SBE["StateBackend (memory / redis / postgres)"]
            end
            subgraph Primitives["Primitives (all backend-powered)"]
                RPCd["ds.rpc — RpcDispatcher"]
                EB["ds.events — EventBus"]
                SM["ds.state — StateManager"]
                CRDT["ds.crdt — CrdtManager"]
                Sess["ds.sessions — SessionManager"]
                Sync["ds.sync — SyncChannel"]
                Auth["ds.auth — AuthHandler"]
                RLim["ds.rateLimit — RateLimiter"]
                DF["ds.dataFlow — ChannelManager"]
                Met["ds.metrics"]
            end
            Transport --> Executor --> Primitives
            Primitives --> Backend
        end
    end
```

### Directory Structure (server)

```
src/server/
├── backends/        # StateBackend implementations + factory
│   ├── memory.ts    # MemoryBackend (default)
│   ├── redis.ts     # RedisBackend (optional peer dep)
│   ├── postgres.ts  # PostgresBackend (optional peer dep)
│   ├── factory.ts   # createBackend(config)
│   └── types.ts     # StateBackend interface
├── executor/        # ConnectionExecutor implementations + FrameRouter
│   ├── async-executor.ts
│   ├── thread-executor.ts
│   ├── pool-executor.ts
│   ├── process-executor.ts
│   ├── frame-router.ts
│   ├── factory.ts   # createExecutor(config)
│   └── types.ts     # ConnectionExecutor interface
├── primitives/      # All backend-powered services
│   ├── rpc/         # RpcDispatcher
│   ├── events/      # EventBus
│   ├── state/       # StateManager, SessionManager
│   ├── crdt/        # CrdtManager
│   ├── sync/        # SyncChannel
│   ├── auth/        # AuthHandler
│   ├── rate-limit/  # BackendLimiter
│   └── data-flow/   # ChannelManager
├── transport/       # ServerTransport + WsServer + Connection
├── server.ts        # DatasoleServer<T> facade
└── types.ts
```

## Wire Protocol

All communication uses binary frames with the following envelope:

| Byte Offset | Size | Field                                         |
| ----------- | ---- | --------------------------------------------- |
| 0           | 1    | Opcode (see `src/shared/protocol/opcodes.ts`) |
| 1           | 4    | Correlation ID (uint32, big-endian)           |
| 5           | 4    | Payload length (uint32, big-endian)           |
| 9           | N    | Payload (pako-compressed if above threshold)  |

Opcodes cover: RPC request/response, event, state snapshot, state patch, CRDT operation, CRDT state, ping/pong, error.

## Connection Lifecycle

1. Client creates `DatasoleClient<T>` and calls `connect()`
2. Web Worker opens WebSocket to `wss://server/__ds`
3. ServerTransport receives HTTP upgrade → `AuthHandler` validates credentials
4. On success: `ConnectionContext` created with auth identity, metadata
5. FrameRouter assigns connection to a ConnectionExecutor (async / thread / pool / process)
6. Primitives push initial state snapshots via StateBackend
7. Ongoing: incremental JSON Patches, events, RPC, CRDT ops — all multiplexed
8. On disconnect: SessionManager flushes to StateBackend for future restore

## Sync Channel Architecture

Sync channels decouple _what_ is synchronized from _when_ it's flushed:

```mermaid
flowchart TD
    A["Server state mutation"] --> B["SyncChannel.enqueue(patches)"]
    B --> C{Flush strategy}
    C -->|immediate| D["Flush now"]
    C -->|batched| E["Flush after N ops or M ms"]
    C -->|debounced| F["Flush after M ms of quiet"]
    D --> G["Serialize → compress → binary frame → WebSocket → client"]
    E --> G
    F --> G
```

## CRDT Merge Flow

```mermaid
sequenceDiagram
    participant A as Client A
    participant S as Server
    participant B as Client B

    A->>S: op: increment(+1)
    S->>S: apply(op)
    S->>B: broadcast merged state
    S->>A: merge(state)
    B->>S: op: increment(+1)
    S->>S: apply(op)
    S->>A: broadcast merged state
    S->>B: broadcast merged state
    Note over A,B: All converge → counter: 2
```

All three nodes converge to the same value regardless of operation order.

## Further Reading

| Topic                      | Where                               |
| -------------------------- | ----------------------------------- |
| Step-by-step learning      | [Tutorials](tutorials.md)           |
| Copy-paste recipes         | [Examples](examples.md)             |
| Client methods             | [Client API](client.md)             |
| Server methods             | [Server API](server.md)             |
| Persistence options        | [State Backends](state-backends.md) |
| Observability              | [Metrics](metrics.md)               |
| Why each decision was made | [ADRs](decisions.md)                |

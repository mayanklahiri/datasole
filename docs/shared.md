---
title: Shared
order: 4
description: Shared types, protocol constants, codec API, and CRDTs — used by both client and server.
---

# Shared Module

Code shared between client and server. Import from `datasole` (root).

> **New here?** See the [Tutorials](tutorials.md) for working examples of every type listed below.

## Types

### Protocol

- `Frame` — Binary frame structure
- `Envelope` — Frame with protocol metadata
- `Opcode` — Message type enum

### State

- `StatePatch` — RFC 6902 JSON Patch operation
- `StateSnapshot` — Keyed state with version

### RPC

- `RpcRequest` / `RpcResponse` — RPC envelope types
- `RpcError` — Error payload

### Events

- `EventPayload` — Event envelope type

### Auth

- `AuthCredentials` / `AuthResult` / `AuthContext` — Auth types

### Data Flow

- `DataFlowPattern` — `'rpc' | 'server-event' | 'client-event' | 'bidirectional-event' | 'server-live-state' | 'client-live-state' | 'bidirectional-crdt'`
- `SyncGranularity` — `'immediate' | 'batched' | 'debounced' | 'manual'`
- `LiveStateConfig` / `LiveStateHandle` / `DataChannel` — Typed channel setup

## CRDTs

Built-in conflict-free replicated data types for bidirectional sync:

| Type             | Description               | Use Case                        |
| ---------------- | ------------------------- | ------------------------------- |
| `LWWRegister<T>` | Last-writer-wins scalar   | Single value (username, status) |
| `PNCounter`      | Positive-negative counter | Votes, likes, online count      |
| `LWWMap<T>`      | LWW map of registers      | Shared document, form fields    |

All implement the `Crdt<T>` interface:

```typescript
interface Crdt<T> {
  readonly type: CrdtType;
  readonly nodeId: string;
  value(): T;
  apply(op: CrdtOperation): void;
  merge(remote: CrdtState<T>): void;
  state(): CrdtState<T>;
}
```

> **Tutorial:** [Bidirectional CRDT — A Shared Counter](tutorials.md#6-bidirectional-crdt--a-shared-counter)

## Build Constants

`BUILD_CONSTANTS` in `src/shared/build-constants.ts` is the single source of truth:

| Constant                | Value               | Description                      |
| ----------------------- | ------------------- | -------------------------------- |
| `PACKAGE_NAME`          | `datasole`          | npm package name                 |
| `VERSION`               | (from package.json) | Injected at build time by Rollup |
| `PROTOCOL_VERSION`      | `1`                 | Wire protocol version            |
| `DEFAULT_WS_PATH`       | `/__ds`             | Default WebSocket path           |
| `MAX_FRAME_SIZE`        | `1048576`           | 1MB max frame                    |
| `COMPRESSION_THRESHOLD` | `256`               | Compress above this size         |

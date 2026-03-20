---
title: Composability
order: 1.2
description: How datasole's seven patterns compose freely on a single connection.
---

# Composability

datasole's core design principle is **composability**: every pattern works independently, and any combination of patterns shares a single WebSocket connection without configuration overhead.

## The seven primitives

```mermaid
flowchart TB
  subgraph Primitives
    RPC["RPC<br/>request → response"]
    SE["Server Events<br/>server → clients"]
    CE["Client Events<br/>client → server"]
    LS["Live State<br/>server-owned, client-mirrored"]
    CRDT["CRDTs<br/>conflict-free bidirectional"]
    SC["Sync Channels<br/>flush control per key"]
    SESS["Sessions<br/>persistence across reconnections"]
  end
```

Each primitive is independent — you can use RPC without ever touching CRDTs, or use live state without events. But the real power comes from combining them.

## How composition works

All primitives multiplex over the same binary WebSocket connection via opcodes in the 9-byte frame header. There's no "mode" to set, no channel subscription to manage. You just call the API:

```typescript
import { PNCounter } from 'datasole/shared';

// Server — all on the same DatasoleServer instance
ds.rpc('addTask', handler); // RPC
ds.broadcast('notification', data); // Server event
ds.on('typing', handler); // Client event
await ds.setState('board', board); // Live state
ds.registerCrdt('votes', new PNCounter('server')); // CRDT
ds.createSyncChannel({
  key: 'cursors',
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'debounced', debounceMs: 50 },
}); // Sync channel
```

```typescript
// Client — all on the same DatasoleClient instance
await ds.rpc('addTask', { text: 'Ship it' }); // RPC
ds.on('notification', ({ data }) => show(data)); // Server event
ds.emit('typing', { user: 'alice' }); // Client event
ds.subscribeState('board', setBoard); // Live state
const store = ds.registerCrdt('node1'); // CRDT
const counter = store.register('votes', 'pn-counter');
counter.increment(1);
```

No separate connections. No routing config. No pub/sub channels to manage.

## Composition patterns

### Dashboard with actions (most common)

**Patterns**: RPC + Live State

The server owns a state tree. The client subscribes to diffs. When the user acts, the client calls an RPC, the server mutates state, and all clients see the update via JSON Patch.

```typescript
// Server
ds.rpc('toggleDone', async ({ id }) => {
  const todo = todos.find((t) => t.id === id);
  if (todo) todo.done = !todo.done;
  await ds.setState('todos', todos);
});

// Client
ds.subscribeState('todos', render);
button.onclick = () => ds.rpc('toggleDone', { id: 42 });
```

### Chat room with presence

**Patterns**: Client Events + Server Events + Sessions

Clients fire chat messages as events. The server broadcasts them to everyone. Session persistence means reconnected users get their nickname back.

```typescript
// Server
ds.on('chat', ({ data }) => {
  ds.broadcast('chat', { user: data.user, text: data.text });
});

// Client
ds.emit('chat', { text: 'hello' });
ds.on('chat', ({ data }) => appendMessage(data));
```

### Collaborative editing with voting

**Patterns**: CRDTs + Live State + RPC

Shared counters for voting (CRDT convergence), a server-owned task board (live state), and RPCs for structured mutations.

```typescript
import { PNCounter } from 'datasole/shared';

// Server
ds.registerCrdt('votes:task-1', new PNCounter('server'));
ds.rpc('moveTask', async ({ id, column }) => {
  board[id].column = column;
  await ds.setState('board', board);
});

// Client A
const storeA = ds.registerCrdt('clientA');
const votesA = storeA.register('votes:task-1', 'pn-counter');
votesA.increment(1); // vote

// Client B (simultaneously)
const storeB = ds.registerCrdt('clientB');
const votesB = storeB.register('votes:task-1', 'pn-counter');
votesB.increment(1); // also votes
// Both converge to 2 — no conflicts
```

### Real-time analytics pipeline

**Patterns**: Client Events + Sync Channels + Live State

Clients stream analytics events. The server aggregates them into a dashboard state with debounced flushing (don't send 1000 patches/second — batch them).

```typescript
// Server
ds.createSyncChannel({
  key: 'analytics',
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'batched', batchIntervalMs: 1000, maxBatchSize: 50 },
});
ds.on('pageview', async ({ data }) => {
  stats.pageviews++;
  await ds.setState('analytics', stats); // routed through sync channel
});

// Client
ds.emit('pageview', { path: '/pricing' });
ds.subscribeState('analytics', updateDashboard);
```

## Why this matters

Most realtime frameworks force you to pick a paradigm:

| Framework  | Primary paradigm     | Adding other patterns                         |
| ---------- | -------------------- | --------------------------------------------- |
| Socket.IO  | Events only          | Manual: build your own RPC, state sync, CRDTs |
| Liveblocks | CRDT collaboration   | Limited: events and storage, no RPC           |
| PartyKit   | Durable Object state | Manual: build your own RPC and events         |
| Ably       | Pub/sub channels     | Manual: no state sync, no CRDTs, no RPC       |

datasole gives you all seven primitives as first-class APIs on a single connection. You don't "add" RPC to an event system or bolt CRDTs onto a pub/sub channel. They're all there from the start, sharing the same binary transport, the same auth, the same rate limiting, and the same session persistence.

## The composability guarantee

Any combination of the seven primitives works on the same `DatasoleServer` + `DatasoleClient` pair. There are no conflicts, no ordering constraints, and no performance penalties for using multiple patterns simultaneously. The binary frame envelope handles multiplexing at the protocol level — each opcode identifies which subsystem handles the frame.

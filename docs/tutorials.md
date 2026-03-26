---
title: Tutorials
order: 0
description: Learn datasole step by step — from a 10-line hello world to a production real-time application.
---

# Tutorials

Each tutorial builds on the one before it. Start at the top, and by the end you'll have used every major feature. Every example is a **complete, runnable** server + client pair.

Each tutorial includes screenshots from the automated e2e test suite, captured against a real server running the production bundle in headless Chromium.

---

## Contract-first (same as the demos)

Every tutorial uses a shared **`shared/contract.ts`**: `AppContract` extends `DatasoleContract`, and string **`enum`s** (`RpcMethod`, `Event`, `StateKey`) hold every RPC name, event name, and state key so call sites use `RpcMethod.Add`, not `'add'`. That matches [`demos/*/shared/contract.ts`](../demos/react-express/shared/contract.ts) and the [Developer Guide](developer-guide.md).

```typescript
import type { DatasoleContract } from 'datasole';

export enum RpcMethod {
  /* added per tutorial */
}
export enum Event {
  /* added per tutorial */
}
export enum StateKey {
  /* added per tutorial */
}

export interface AppContract extends DatasoleContract {
  rpc: {
    /* [RpcMethod.Foo]: { params: P; result: R } */
  };
  events: {
    /* [Event.Bar]: Payload */
  };
  state: {
    /* [StateKey.Baz]: Value */
  };
}
```

Server and client are always typed: `new DatasoleServer<AppContract>()` and `new DatasoleClient<AppContract>({ ... })`. Helper types: `RpcParams`, `RpcResult`, `EventData`, `StateValue`.

HTML snippets below use the IIFE global (`Datasole.DatasoleClient`). In TypeScript/React/Vue, import from `datasole/client` and pass `<AppContract>`.

---

## 1. Hello World — Your First Connection

**What you'll learn:** Install datasole, connect a client to a server, confirm the WebSocket works.

**Time:** 2 minutes

### Shared — `shared/contract.ts` (no RPC/events/state yet)

Until you add handlers, use empty maps so `DatasoleServer<AppContract>` type-checks:

```typescript
import type { DatasoleContract } from 'datasole';

export interface AppContract extends DatasoleContract {
  rpc: Record<never, never>;
  events: Record<never, never>;
  state: Record<never, never>;
}
```

### Server — `server.ts`

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import type { AppContract } from './shared/contract.js';

const ds = new DatasoleServer<AppContract>();
const http = createServer();
ds.transport.attach(http);
http.listen(3000, () => console.log('listening on :3000'));
```

### Client — `index.html`

```html
<script src="https://unpkg.com/datasole/dist/client/datasole.iife.min.js"></script>
<script>
  const ds = new Datasole.DatasoleClient({ url: 'ws://localhost:3000' });
  ds.connect();
  console.log('connection state:', ds.getConnectionState());
</script>
```

That's it. No config, no adapters, no plugins. The server listens for WebSocket upgrades on `/__ds`, the client connects, and the binary handshake completes in the Web Worker.

![Tutorial 1: Connection established](/screenshots/tutorial-1-connection.png)

---

## 2. RPC — Call the Server, Get a Response

**What you'll learn:** Register a typed RPC handler on the server, call it from the client, get a typed response.

**Time:** 3 minutes

**Building on:** Tutorial 1

### Shared — extend `shared/contract.ts`

```typescript
import type { DatasoleContract } from 'datasole';

export enum RpcMethod {
  Add = 'add',
}

export interface AppContract extends DatasoleContract {
  rpc: {
    [RpcMethod.Add]: { params: { a: number; b: number }; result: { sum: number } };
  };
  events: Record<never, never>;
  state: Record<never, never>;
}
```

### Server — add RPC handler

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { RpcMethod, type AppContract } from './shared/contract.js';

const ds = new DatasoleServer<AppContract>();

ds.rpc.register(RpcMethod.Add, async (params) => {
  return { sum: params.a + params.b };
});

const http = createServer();
ds.transport.attach(http);
http.listen(3000);
```

### Client — call the RPC

```html
<script src="https://unpkg.com/datasole/dist/client/datasole.iife.min.js"></script>
<script>
  const ds = new Datasole.DatasoleClient({ url: 'ws://localhost:3000' });
  ds.connect();

  // Wait for connection, then call the RPC (string value matches RpcMethod.Add)
  setTimeout(async () => {
    const result = await ds.rpc('add', { a: 17, b: 25 });
    console.log('17 + 25 =', result.sum); // 42
  }, 500);
</script>
```

In TypeScript, import `RpcMethod` from `./shared/contract.ts` and call `ds.rpc(RpcMethod.Add, { a: 17, b: 25 })`.

### Same thing in TypeScript + React

```tsx
import { DatasoleClient } from 'datasole/client';
import { RpcMethod, type AppContract } from './shared/contract';
import { useEffect, useRef, useState } from 'react';

function Calculator() {
  const ds = useRef(new DatasoleClient<AppContract>({ url: 'ws://localhost:3000' }));
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    ds.current.connect();
    return () => {
      ds.current.disconnect();
    };
  }, []);

  const add = async (a: number, b: number) => {
    const res = await ds.current.rpc(RpcMethod.Add, { a, b });
    setResult(res.sum);
  };

  return (
    <div>
      <button onClick={() => add(17, 25)}>17 + 25 = ?</button>
      {result !== null && <p>Result: {result}</p>}
    </div>
  );
}
```

![Tutorial 2: RPC call result](/screenshots/tutorial-2-rpc.png)

---

## 3. Server Events — A Live Stock Ticker

**What you'll learn:** Push events from the server to all connected clients. No polling, no subscriptions to configure — just `broadcast()`.

**Time:** 3 minutes

**Building on:** Tutorial 1

### Shared — `shared/contract.ts`

```typescript
import type { DatasoleContract } from 'datasole';

export enum Event {
  Price = 'price',
}

export interface PricePayload {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface AppContract extends DatasoleContract {
  rpc: Record<never, never>;
  events: {
    [Event.Price]: PricePayload;
  };
  state: Record<never, never>;
}
```

### Server — broadcast a price every second

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { Event, type AppContract } from './shared/contract.js';

const ds = new DatasoleServer<AppContract>();
const http = createServer();
ds.transport.attach(http);
http.listen(3000);

setInterval(() => {
  ds.localServer.broadcast(Event.Price, {
    symbol: 'TSLA',
    price: 250 + Math.random() * 10,
    timestamp: Date.now(),
  });
}, 1000);
```

### Client — listen for price events

```html
<script src="https://unpkg.com/datasole/dist/client/datasole.iife.min.js"></script>
<h1>TSLA: <span id="price">—</span></h1>
<script>
  const ds = new Datasole.DatasoleClient({ url: 'ws://localhost:3000' });
  ds.connect();
  ds.on('price', ({ data }) => {
    document.getElementById('price').textContent = '$' + data.price.toFixed(2);
  });
</script>
```

### Vue 3 SFC version

```vue
<script setup lang="ts">
import { DatasoleClient } from 'datasole/client';
import { Event, type AppContract, type PricePayload } from './shared/contract';
import { onMounted, onUnmounted, ref } from 'vue';

const client = new DatasoleClient<AppContract>({ url: 'ws://localhost:3000' });
const price = ref<string>('—');

onMounted(() => {
  client.connect();
  client.on<PricePayload>(Event.Price, ({ data }) => {
    price.value = `$${data.price.toFixed(2)}`;
  });
});

onUnmounted(() => client.disconnect());
</script>

<template>
  <h1>TSLA: {{ price }}</h1>
</template>
```

This is the simplest possible pattern for one-way server pushes: dashboards, notifications, live feeds. The client never asks — the server just broadcasts whenever it has something.

![Tutorial 3: Server broadcast event](/screenshots/tutorial-3-events.png)

---

## 4. Live State — A Server-Synced Dashboard

**What you'll learn:** Use `setState` on the server and `subscribeState` on the client to keep a complex data structure perfectly in sync. The server owns the data; the client sees a live mirror. Under the hood, datasole sends only the JSON Patch diff — not the full state.

**Time:** 5 minutes

**Building on:** Tutorial 1

This is the **most common datasole pattern** for building reactive frontends: the server mutates its model, and your React/Vue template automatically re-renders. No manual event mapping. No client-side state management library.

### Shared — `shared/contract.ts`

```typescript
import type { DatasoleContract } from 'datasole';

export enum StateKey {
  Dashboard = 'dashboard',
}

export interface Dashboard {
  visitors: number;
  activeNow: number;
  serverUptime: number;
  lastUpdated: string;
}

export interface AppContract extends DatasoleContract {
  rpc: Record<never, never>;
  events: Record<never, never>;
  state: {
    [StateKey.Dashboard]: Dashboard;
  };
}
```

### Server — a dashboard that updates every second

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { StateKey, type AppContract } from './shared/contract.js';

const ds = new DatasoleServer<AppContract>();
const http = createServer();
ds.transport.attach(http);
http.listen(3000);

let visitors = 0;

setInterval(async () => {
  visitors += Math.floor(Math.random() * 5);
  await ds.localServer.setState(StateKey.Dashboard, {
    visitors,
    activeNow: Math.floor(Math.random() * 100),
    serverUptime: process.uptime(),
    lastUpdated: new Date().toISOString(),
  });
}, 1000);
```

### Client (React) — the template just works

```tsx
import { DatasoleClient } from 'datasole/client';
import { StateKey, type AppContract, type Dashboard } from './shared/contract';
import { useEffect, useRef, useState } from 'react';

function LiveDashboard() {
  const ds = useRef(new DatasoleClient<AppContract>({ url: 'ws://localhost:3000' }));
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    ds.current.connect();
    ds.current.subscribeState(StateKey.Dashboard, setData);
    return () => {
      ds.current.disconnect();
    };
  }, []);

  if (!data) return <p>Connecting...</p>;

  return (
    <div>
      <h1>Live Dashboard</h1>
      <p>Total visitors: {data.visitors}</p>
      <p>Active now: {data.activeNow}</p>
      <p>Server uptime: {data.serverUptime.toFixed(0)}s</p>
      <p>Last update: {data.lastUpdated}</p>
    </div>
  );
}
```

### Client (Vue 3 SFC) — equally simple

```vue
<script setup lang="ts">
import { DatasoleClient } from 'datasole/client';
import { StateKey, type AppContract, type Dashboard } from './shared/contract';
import { onMounted, onUnmounted, reactive } from 'vue';

const client = new DatasoleClient<AppContract>({ url: 'ws://localhost:3000' });
const dashboard = reactive<Dashboard>({
  visitors: 0,
  activeNow: 0,
  serverUptime: 0,
  lastUpdated: '',
});

onMounted(() => {
  client.connect();
  client.subscribeState(StateKey.Dashboard, (s) => Object.assign(dashboard, s));
});

onUnmounted(() => client.disconnect());
</script>

<template>
  <h1>Live Dashboard</h1>
  <p>Total visitors: {{ dashboard.visitors }}</p>
  <p>Active now: {{ dashboard.activeNow }}</p>
  <p>Server uptime: {{ dashboard.serverUptime.toFixed(0) }}s</p>
  <p>Last update: {{ dashboard.lastUpdated }}</p>
</template>
```

Notice: no event handlers, no state reducers, no polling. The `subscribeState` callback fires every time the server calls `setState` — and only the diff is sent over the wire.

![Tutorial 4: Live state sync](/screenshots/tutorial-4-state.png)

---

## 5. Client Events + Auth — A Chat Room

**What you'll learn:** Send events from client to server, authenticate connections, use connection context to track users.

**Time:** 5 minutes

**Building on:** Tutorials 1–3

Same pattern as the [demos](demos.md): clients **`emit`** `Event.ChatSend` (payload: text + username); the server **`broadcast`s** `Event.ChatMessage` (full message with id + timestamp) and can mirror history in **`StateKey.ChatMessages`**.

### Shared — `shared/contract.ts`

```typescript
import type { DatasoleContract } from 'datasole';

export enum Event {
  ChatSend = 'chat:send',
  ChatMessage = 'chat:message',
}

export enum StateKey {
  ChatMessages = 'chat:messages',
}

export interface ChatMessage {
  id: string;
  text: string;
  username: string;
  ts: number;
}

export interface AppContract extends DatasoleContract {
  rpc: Record<never, never>;
  events: {
    [Event.ChatSend]: { text: string; username: string };
    [Event.ChatMessage]: ChatMessage;
  };
  state: {
    [StateKey.ChatMessages]: ChatMessage[];
  };
}
```

### Server — authenticated chat with user tracking

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { Event, StateKey, type AppContract, type ChatMessage } from './shared/contract.js';

const app = express();
app.use(express.static('public'));

const ds = new DatasoleServer<AppContract>({
  authHandler: async (req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const name = url.searchParams.get('token');
    if (!name) return { authenticated: false };
    return { authenticated: true, userId: name, metadata: { displayName: name } };
  },
});

const http = createServer(app);
ds.transport.attach(http);

const chatHistory: ChatMessage[] = [];

ds.primitives.events.on(Event.ChatSend, ({ data }) => {
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    text: data.text,
    username: data.username,
    ts: Date.now(),
  };
  chatHistory.push(msg);
  if (chatHistory.length > 50) chatHistory.shift();
  void ds.localServer.setState(StateKey.ChatMessages, [...chatHistory]);
  ds.localServer.broadcast(Event.ChatMessage, msg);
});

http.listen(3000);
```

### Client — send and receive chat messages

```html
<script src="https://unpkg.com/datasole/dist/client/datasole.iife.min.js"></script>
<div id="messages"></div>
<input id="input" placeholder="Type a message..." />
<button id="send">Send</button>

<script>
  const username = prompt('Your name?') || 'anon';
  const ds = new Datasole.DatasoleClient({
    url: 'ws://localhost:3000',
    auth: { token: username },
  });
  ds.connect();

  ds.subscribeState('chat:messages', function (messages) {
    document.getElementById('messages').innerHTML = messages
      .map(function (m) {
        return '<div>[' + m.username + '] ' + m.text + '</div>';
      })
      .join('');
  });

  document.getElementById('send').onclick = () => {
    const input = document.getElementById('input');
    ds.emit('chat:send', { text: input.value, username: username });
    input.value = '';
  };
</script>
```

### React version

```tsx
import { DatasoleClient } from 'datasole/client';
import { StateKey, type AppContract, type ChatMessage } from './shared/contract';
import { useEffect, useRef, useState } from 'react';

function ChatRoom({ username }: { username: string }) {
  const ds = useRef(
    new DatasoleClient<AppContract>({
      url: 'ws://localhost:3000',
      auth: { token: username },
    }),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const client = ds.current;
    client.connect();
    client.subscribeState(StateKey.ChatMessages, setMessages);
    return () => {
      client.disconnect();
    };
  }, []);

  const send = () => {
    ds.current.emit(Event.ChatSend, { text: input, username });
    setInput('');
  };

  return (
    <div>
      <div>
        {messages.map((m) => (
          <p key={m.id}>
            [{m.username}] {m.text}
          </p>
        ))}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={send}>Send</button>
    </div>
  );
}
```

---

## 6. Bidirectional CRDT — A Shared Counter

**What you'll learn:** Use CRDTs for conflict-free bidirectional state. Multiple clients can increment/decrement a counter simultaneously — no conflicts, no server arbitration, values converge automatically.

**Time:** 5 minutes

**Building on:** Tutorials 1–4

### Shared — `shared/contract.ts`

```typescript
import type { DatasoleContract } from 'datasole';

export enum RpcMethod {
  CrdtGetState = 'crdt:getState',
}

export enum Event {
  CrdtOp = 'crdt:op',
  CrdtState = 'crdt:state',
}

/** Narrow these to your CRDT op / serialized state types as you harden the app */
export interface AppContract extends DatasoleContract {
  rpc: {
    [RpcMethod.CrdtGetState]: { params: void; result: unknown };
  };
  events: {
    [Event.CrdtOp]: unknown;
    [Event.CrdtState]: unknown;
  };
  state: Record<never, never>;
}
```

### Server — host a shared CRDT counter

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { PNCounter } from 'datasole';
import { Event, RpcMethod, type AppContract } from './shared/contract.js';

const ds = new DatasoleServer<AppContract>();
const http = createServer();
ds.transport.attach(http);
http.listen(3000);

const counter = new PNCounter('server');

ds.primitives.events.on(Event.CrdtOp, ({ data: op }) => {
  counter.apply(op);
  ds.localServer.broadcast(Event.CrdtState, counter.state());
});

ds.rpc.register(RpcMethod.CrdtGetState, async () => counter.state());
```

### Client — increment from anywhere, state converges

```tsx
import { DatasoleClient, CrdtStore } from 'datasole/client';
import { PNCounter } from 'datasole';
import { Event, RpcMethod, type AppContract } from './shared/contract';
import { useEffect, useRef, useState } from 'react';

function SharedCounter() {
  const ds = useRef(new DatasoleClient<AppContract>({ url: 'ws://localhost:3000' }));
  const store = useRef(new CrdtStore('client-' + Math.random().toString(36).slice(2)));
  const [count, setCount] = useState(0);

  useEffect(() => {
    const counter = store.current.register('votes', 'pn-counter');
    ds.current.connect();

    ds.current.on(Event.CrdtState, ({ data: state }) => {
      store.current.mergeRemoteState('votes', state);
      setCount(counter.value());
    });

    ds.current.rpc(RpcMethod.CrdtGetState).then((state) => {
      store.current.mergeRemoteState('votes', state);
      setCount(counter.value());
    });

    return () => {
      ds.current.disconnect();
    };
  }, []);

  const increment = () => {
    const counter = store.current.get<PNCounter>('votes')!;
    const op = counter.increment();
    ds.current.emit(Event.CrdtOp, op);
    setCount(counter.value());
  };

  const decrement = () => {
    const counter = store.current.get<PNCounter>('votes')!;
    const op = counter.decrement();
    ds.current.emit(Event.CrdtOp, op);
    setCount(counter.value());
  };

  return (
    <div>
      <h1>Shared Counter: {count}</h1>
      <button onClick={decrement}>−</button>
      <button onClick={increment}>+</button>
      <p>Open this page in multiple tabs — the counter stays in sync.</p>
    </div>
  );
}
```

![Tutorial 6: CRDT shared counter](/screenshots/tutorial-6-crdt.png)

---

## 7. Sync Channels — Controlled Flush Granularity

**What you'll learn:** Create sync channels that flush at different rates — immediate for latency-critical data, batched for throughput, debounced for user input.

**Time:** 5 minutes

**Building on:** Tutorials 1, 4

Sync channel **`key`** strings should match the same naming discipline as state keys — use a small **`enum`** so they stay consistent with `setState` / `subscribeState` if you later route the same logical data through live state.

### Shared — `shared/contract.ts` (minimal; channels are orthogonal to RPC/events)

```typescript
import type { DatasoleContract } from 'datasole';

/** Keys passed to `createSyncChannel({ key })` — same string values everywhere */
export enum SyncChannelKey {
  Alerts = 'alerts',
  Metrics = 'metrics',
  SearchResults = 'search-results',
}

export interface AppContract extends DatasoleContract {
  rpc: Record<never, never>;
  events: Record<never, never>;
  state: Record<never, never>;
}
```

### Server — three channels, three strategies

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { SyncChannelKey, type AppContract } from './shared/contract.js';

const ds = new DatasoleServer<AppContract>();
const http = createServer();
ds.transport.attach(http);
http.listen(3000);

const alerts = ds.localServer.createSyncChannel({
  key: SyncChannelKey.Alerts,
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'immediate' },
});

const metrics = ds.localServer.createSyncChannel({
  key: SyncChannelKey.Metrics,
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'batched', batchIntervalMs: 200 },
});

const search = ds.localServer.createSyncChannel({
  key: SyncChannelKey.SearchResults,
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'debounced', debounceMs: 500 },
});

setInterval(() => {
  metrics.enqueue([
    {
      op: 'replace',
      path: '/cpu',
      value: Math.random() * 100,
    },
  ]);
}, 50);
```

The same server can mix immediate, batched, and debounced channels on different keys — each tuned for its use case.

---

## 8. Session Persistence — Surviving Reconnections

**What you'll learn:** Store per-user state that survives disconnections. When a user reconnects, their session is automatically restored from the persistence backend.

**Time:** 5 minutes

**Building on:** Tutorials 4–5

### Shared — `shared/contract.ts`

```typescript
import type { DatasoleContract } from 'datasole';

export enum RpcMethod {
  SaveProgress = 'saveProgress',
  GetProgress = 'getProgress',
}

export interface AppContract extends DatasoleContract {
  rpc: {
    [RpcMethod.SaveProgress]: {
      params: { level: number; score: number };
      result: { ok: boolean };
    };
    [RpcMethod.GetProgress]: {
      params: void;
      result: { level: number; score: number };
    };
  };
  events: Record<never, never>;
  state: Record<never, never>;
}
```

### Server — persist user progress

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { RpcMethod, type AppContract } from './shared/contract.js';

const app = express();
const ds = new DatasoleServer<AppContract>({
  authHandler: async (req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const userId = url.searchParams.get('token');
    return userId ? { authenticated: true, userId } : { authenticated: false };
  },
  session: {
    flushThreshold: 5,
    flushIntervalMs: 3000,
  },
});

const http = createServer(app);
ds.transport.attach(http);

ds.rpc.register(RpcMethod.SaveProgress, async (params, ctx) => {
  ds.primitives.sessions.set(ctx.connection.userId!, 'level', params.level);
  ds.primitives.sessions.set(ctx.connection.userId!, 'score', params.score);
  return { ok: true };
});

ds.rpc.register(RpcMethod.GetProgress, async (_params, ctx) => {
  const level = ds.primitives.sessions.get<number>(ctx.connection.userId!, 'level') ?? 1;
  const score = ds.primitives.sessions.get<number>(ctx.connection.userId!, 'score') ?? 0;
  return { level, score };
});

ds.primitives.sessions.onChange((userId, key, value, version) => {
  console.log(`${userId} changed ${key} to ${value} (v${version})`);
});

http.listen(3000);
```

### Client — reconnect and resume

```tsx
import { DatasoleClient } from 'datasole/client';
import { RpcMethod, type AppContract } from './shared/contract';
import { useEffect, useRef, useState } from 'react';

function Game({ userId }: { userId: string }) {
  const ds = useRef(
    new DatasoleClient<AppContract>({
      url: 'ws://localhost:3000',
      auth: { token: userId },
    }),
  );
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);

  useEffect(() => {
    ds.current.connect();

    ds.current.rpc(RpcMethod.GetProgress).then((p) => {
      setLevel(p.level);
      setScore(p.score);
    });

    return () => {
      ds.current.disconnect();
    };
  }, []);

  const completeLevel = async () => {
    const newLevel = level + 1;
    const newScore = score + 100;
    setLevel(newLevel);
    setScore(newScore);
    await ds.current.rpc(RpcMethod.SaveProgress, { level: newLevel, score: newScore });
  };

  return (
    <div>
      <h1>
        Level {level} — Score {score}
      </h1>
      <button onClick={completeLevel}>Complete Level</button>
      <p>Close this tab and reopen it — your progress persists.</p>
    </div>
  );
}
```

![Tutorial 8: Session persistence](/screenshots/tutorial-8-sessions.png)

---

## 9. Production — Thread Pool, Rate Limiting, Redis, Metrics

**What you'll learn:** Configure datasole for production with thread-pool concurrency, rate limiting, Redis persistence, and Prometheus metrics. Deploy with pm2 for clustering.

**Time:** 10 minutes

**Building on:** All previous tutorials

### Shared — `shared/contract.ts`

```typescript
import type { DatasoleContract } from 'datasole';

export enum RpcMethod {
  Ping = 'ping',
  HeavyWork = 'heavy-rpc',
}

export interface AppContract extends DatasoleContract {
  rpc: {
    [RpcMethod.Ping]: { params: void; result: { pong: number } };
    [RpcMethod.HeavyWork]: { params: { payload: string }; result: { ok: boolean } };
  };
  events: Record<never, never>;
  state: Record<never, never>;
}
```

Rate-limit **`rules`** keys must match the **RPC method string** — use `RpcMethod.HeavyWork` (or `RpcMethod.HeavyWork.toString()` is unnecessary; the enum value is the wire name).

### Server — production configuration

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer, RedisBackend, PrometheusExporter } from 'datasole/server';
import { RpcMethod, type AppContract } from './shared/contract.js';

const app = express();

const redisBackend = new RedisBackend({ url: 'redis://localhost:6379', prefix: 'ds:' });
await redisBackend.connect();

const ds = new DatasoleServer<AppContract>({
  authHandler: async (req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) return { authenticated: false };
    return { authenticated: true, userId: token, roles: ['user'] };
  },

  executor: { model: 'thread-pool', poolSize: 4 },

  stateBackend: redisBackend,

  rateLimit: {
    defaultRule: { windowMs: 60_000, maxRequests: 200 },
    rules: {
      [RpcMethod.HeavyWork]: { windowMs: 60_000, maxRequests: 10 },
    },
  },

  session: { flushThreshold: 10, flushIntervalMs: 5000 },
});

const http = createServer(app);
await ds.init();
ds.transport.attach(http);

app.get('/metrics', async (_req, res) => {
  const exporter = new PrometheusExporter('datasole');
  const text = await exporter.export(ds.metrics.snapshot());
  res.type('text/plain').send(text);
});

ds.rpc.register(RpcMethod.Ping, async () => ({ pong: Date.now() }));
ds.rpc.register(RpcMethod.HeavyWork, async () => ({ ok: true }));

http.listen(3000);
console.log('Production datasole server on :3000');
```

### Deploy with pm2 (clustering)

```bash
# ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'datasole',
    script: 'dist/server.js',
    instances: 'max',      // One process per CPU core
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      REDIS_URL: 'redis://localhost:6379',
    },
  }],
};
```

```bash
pm2 start ecosystem.config.cjs
pm2 monit
```

Because datasole's concurrency model keeps no shared mutable state in the main process, and Redis provides cross-process pub/sub, pm2 cluster mode works out of the box.

### Concurrency model cheat sheet

| Model         | Use case                                         | Overhead                                    |
| ------------- | ------------------------------------------------ | ------------------------------------------- |
| `async`       | **Default.** Chat, notifications (I/O-bound)     | Lowest — single event loop                  |
| `thread`      | Per-connection game logic (CPU-bound)            | Medium — one `worker_thread` per connection |
| `thread-pool` | **Recommended for production.** General-purpose. | Low–medium — fixed thread pool              |

<!-- Tutorial 9 covers production deployment with Redis and pm2 — no standalone e2e demo. -->

---

## 10. Putting It All Together — A Collaborative Task Board

**What you'll learn:** Combine RPC, live state, events, CRDTs, session persistence, and auth into a single cohesive application.

**Time:** 15 minutes

**Building on:** All previous tutorials

This is a simplified Trello-like board where:

- The board state is a **live server→client data structure** (JSON Patch)
- Adding/moving tasks uses **RPC** (server validates, updates state, clients see the diff)
- User presence ("who's online") uses **CRDT counters** (bidirectional, conflict-free)
- Chat uses **bidirectional events**
- Session persistence **restores your view** on reconnect
- **Rate limiting** prevents spam

### Shared — `shared/contract.ts`

```typescript
import type { DatasoleContract } from 'datasole';

export enum RpcMethod {
  AddTask = 'addTask',
  MoveTask = 'moveTask',
}

export enum Event {
  UserJoin = 'user:join',
  UserLeave = 'user:leave',
  Presence = 'presence',
  ChatSend = 'chat:send',
  ChatMessage = 'chat:message',
}

export enum StateKey {
  Board = 'board',
}

export interface Task {
  id: string;
  title: string;
  column: string;
  assignee?: string;
}

export interface Board {
  tasks: Task[];
  columns: string[];
}

export interface AppContract extends DatasoleContract {
  rpc: {
    [RpcMethod.AddTask]: { params: { title: string }; result: { id: string } };
    [RpcMethod.MoveTask]: { params: { taskId: string; column: string }; result: { ok: boolean } };
  };
  events: {
    [Event.UserJoin]: Record<string, never>;
    [Event.UserLeave]: Record<string, never>;
    [Event.Presence]: unknown;
    [Event.ChatSend]: { text: string };
    [Event.ChatMessage]: { text: string; timestamp: number };
  };
  state: {
    [StateKey.Board]: Board;
  };
}
```

### Server

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { PNCounter } from 'datasole';
import { Event, RpcMethod, StateKey, type AppContract, type Board } from './shared/contract.js';

const app = express();
app.use(express.static('public'));

const ds = new DatasoleServer<AppContract>({
  authHandler: async (req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const name = url.searchParams.get('token');
    return name
      ? { authenticated: true, userId: name, metadata: { displayName: name } }
      : { authenticated: false };
  },
  executor: { model: 'thread-pool', poolSize: 2 },
  session: { flushThreshold: 3, flushIntervalMs: 2000 },
});

const http = createServer(app);
ds.transport.attach(http);

const board: Board = {
  columns: ['todo', 'in-progress', 'done'],
  tasks: [],
};

async function syncBoard() {
  await ds.localServer.setState(StateKey.Board, board);
}
void syncBoard();

ds.rpc.register(RpcMethod.AddTask, async (params) => {
  const id = `task-${Date.now()}`;
  board.tasks.push({ id, title: params.title, column: 'todo' });
  await syncBoard();
  return { id };
});

ds.rpc.register(RpcMethod.MoveTask, async (params) => {
  const task = board.tasks.find((t) => t.id === params.taskId);
  if (task) task.column = params.column;
  await syncBoard();
  return { ok: !!task };
});

const onlineCounter = new PNCounter('server');

ds.primitives.events.on(Event.UserJoin, () => {
  onlineCounter.increment();
  ds.localServer.broadcast(Event.Presence, onlineCounter.state());
});

ds.primitives.events.on(Event.UserLeave, () => {
  onlineCounter.decrement();
  ds.localServer.broadcast(Event.Presence, onlineCounter.state());
});

ds.primitives.events.on(Event.ChatSend, ({ data }) => {
  ds.localServer.broadcast(Event.ChatMessage, { text: data.text, timestamp: Date.now() });
});

http.listen(3000, () => console.log('Task board on :3000'));
```

### Client (React)

```tsx
import { DatasoleClient, CrdtStore } from 'datasole/client';
import { PNCounter } from 'datasole';
import { Event, RpcMethod, StateKey, type AppContract, type Board } from './shared/contract';
import { useEffect, useRef, useState } from 'react';

function TaskBoard({ username }: { username: string }) {
  const ds = useRef(
    new DatasoleClient<AppContract>({
      url: 'ws://localhost:3000',
      auth: { token: username },
    }),
  );
  const [board, setBoard] = useState<Board>({ tasks: [], columns: [] });
  const [online, setOnline] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');

  useEffect(() => {
    const client = ds.current;
    client.connect();

    client.subscribeState(StateKey.Board, setBoard);

    const store = new CrdtStore('client-' + username);
    store.register('online', 'pn-counter');
    client.emit(Event.UserJoin, {});
    client.on(Event.Presence, ({ data: state }) => {
      store.mergeRemoteState('online', state);
      setOnline(store.get<PNCounter>('online')!.value());
    });

    client.on(Event.ChatMessage, ({ data: msg }) => {
      setMessages((prev) => [...prev.slice(-49), msg.text]);
    });

    return () => {
      client.emit(Event.UserLeave, {});
      client.disconnect();
    };
  }, [username]);

  const addTask = async () => {
    if (!newTask.trim()) return;
    await ds.current.rpc(RpcMethod.AddTask, { title: newTask });
    setNewTask('');
  };

  const moveTask = (taskId: string, column: string) => {
    void ds.current.rpc(RpcMethod.MoveTask, { taskId, column });
  };

  return (
    <div>
      <header>
        <h1>Task Board</h1>
        <span>{online} online</span>
      </header>

      <div style={{ display: 'flex', gap: '1rem' }}>
        {board.columns.map((col) => (
          <div key={col} style={{ flex: 1 }}>
            <h2>{col}</h2>
            {board.tasks
              .filter((t) => t.column === col)
              .map((task) => (
                <div key={task.id} style={{ padding: '0.5rem', border: '1px solid #ccc' }}>
                  <p>{task.title}</p>
                  {board.columns
                    .filter((c) => c !== col)
                    .map((target) => (
                      <button key={target} onClick={() => moveTask(task.id, target)}>
                        → {target}
                      </button>
                    ))}
                </div>
              ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="New task..."
        />
        <button onClick={addTask}>Add</button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h3>Chat</h3>
        {messages.map((m, i) => (
          <p key={i}>{m}</p>
        ))}
      </div>
    </div>
  );
}
```

This single page uses **five datasole patterns simultaneously**:

1. **RPC** — `addTask`, `moveTask`
2. **Server→client live state** — the board, synced via JSON Patch
3. **Bidirectional events** — chat messages
4. **CRDT** — online user count, conflict-free across tabs
5. **Session persistence** — user's board view survives reconnection

![Tutorial 10: Task board](/screenshots/tutorial-10-taskboard.png)

---

## What to Read Next

| You want to...                     | Read                                |
| ---------------------------------- | ----------------------------------- |
| Understand the binary protocol     | [Architecture](architecture.md)     |
| See every client method            | [Client API](client.md)             |
| See every server method            | [Server API](server.md)             |
| Swap to Redis or Postgres          | [State Backends](state-backends.md) |
| Set up Prometheus/OpenTelemetry    | [Metrics](metrics.md)               |
| Understand why decisions were made | [ADRs](decisions.md)                |
| Contribute                         | [Contributing](contributing.md)     |

---
title: Tutorials
order: 0
description: Learn datasole step by step — from a 10-line hello world to a production real-time application.
---

# Tutorials

Each tutorial builds on the one before it. Start at the top, and by the end you'll have used every major feature. Every example is a **complete, runnable** server + client pair.

Each tutorial includes screenshots from the automated e2e test suite, captured against a real server running the production bundle in headless Chromium.

---

## 1. Hello World — Your First Connection

**What you'll learn:** Install datasole, connect a client to a server, confirm the WebSocket works.

**Time:** 2 minutes

### Server — `server.ts`

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();
const http = createServer();
ds.attach(http);
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

### Server — add RPC handler

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();

// Register a handler: client sends two numbers, server returns the sum
ds.rpc.register<{ a: number; b: number }, { sum: number }>('add', async (params) => {
  return { sum: params.a + params.b };
});

const http = createServer();
ds.attach(http);
http.listen(3000);
```

### Client — call the RPC

```html
<script src="https://unpkg.com/datasole/dist/client/datasole.iife.min.js"></script>
<script>
  const ds = new Datasole.DatasoleClient({ url: 'ws://localhost:3000' });
  ds.connect();

  // Wait for connection, then call the RPC
  setTimeout(async () => {
    const result = await ds.rpc('add', { a: 17, b: 25 });
    console.log('17 + 25 =', result.sum); // 42
  }, 500);
</script>
```

### Same thing in TypeScript + React

```tsx
import { DatasoleClient } from 'datasole/client';
import { useEffect, useRef, useState } from 'react';

function Calculator() {
  const ds = useRef(new DatasoleClient({ url: 'ws://localhost:3000' }));
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    ds.current.connect();
    return () => {
      ds.current.disconnect();
    };
  }, []);

  const add = async (a: number, b: number) => {
    const res = await ds.current.rpc<{ sum: number }>('add', { a, b });
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

### Server — broadcast a price every second

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();
const http = createServer();
ds.attach(http);
http.listen(3000);

// Simulate a stock price feed
setInterval(() => {
  ds.broadcast('price', {
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
import { onMounted, onUnmounted, ref } from 'vue';

const client = new DatasoleClient({ url: 'ws://localhost:3000' });
const price = ref<string>('—');

onMounted(() => {
  client.connect();
  client.on<{ symbol: string; price: number }>('price', ({ data }) => {
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

### Server — a dashboard that updates every second

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();
const http = createServer();
ds.attach(http);
http.listen(3000);

let visitors = 0;

setInterval(async () => {
  visitors += Math.floor(Math.random() * 5);
  await ds.setState('dashboard', {
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
import { useEffect, useRef, useState } from 'react';

interface Dashboard {
  visitors: number;
  activeNow: number;
  serverUptime: number;
  lastUpdated: string;
}

function LiveDashboard() {
  const ds = useRef(new DatasoleClient({ url: 'ws://localhost:3000' }));
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    ds.current.connect();
    ds.current.subscribeState<Dashboard>('dashboard', setData);
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
import { onMounted, onUnmounted, reactive } from 'vue';

const client = new DatasoleClient({ url: 'ws://localhost:3000' });
const dashboard = reactive({
  visitors: 0,
  activeNow: 0,
  serverUptime: 0,
  lastUpdated: '',
});

onMounted(() => {
  client.connect();
  client.subscribeState('dashboard', (s) => Object.assign(dashboard, s));
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

### Server — authenticated chat with user tracking

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const app = express();
app.use(express.static('public'));

const ds = new DatasoleServer({
  authHandler: async (req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const name = url.searchParams.get('token');
    if (!name) return { authenticated: false };
    return { authenticated: true, userId: name, metadata: { displayName: name } };
  },
});

const http = createServer(app);
ds.attach(http);

// Listen for chat messages from clients
ds.events.on<{ text: string }>('chat:message', ({ data }) => {
  // ctx.connection gives you the sender's identity
  // Broadcast to all connected clients
  ds.broadcast('chat:message', {
    from: 'server', // In full impl, this comes from ctx
    text: data.text,
    timestamp: Date.now(),
  });
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

  // Receive messages
  ds.on('chat:message', ({ data: msg }) => {
    const div = document.createElement('div');
    div.textContent = `[${msg.from}] ${msg.text}`;
    document.getElementById('messages').appendChild(div);
  });

  // Send messages
  document.getElementById('send').onclick = () => {
    const input = document.getElementById('input');
    ds.emit('chat:message', { text: input.value });
    input.value = '';
  };
</script>
```

### React version

```tsx
import { DatasoleClient } from 'datasole/client';
import { useEffect, useRef, useState } from 'react';

interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
}

function ChatRoom({ username }: { username: string }) {
  const ds = useRef(
    new DatasoleClient({
      url: 'ws://localhost:3000',
      auth: { token: username },
    }),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    ds.current.connect();
    ds.current.on<ChatMessage>('chat:message', ({ data: msg }) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => {
      ds.current.disconnect();
    };
  }, []);

  const send = () => {
    ds.current.emit('chat:message', { text: input });
    setInput('');
  };

  return (
    <div>
      <div>
        {messages.map((m, i) => (
          <p key={i}>
            [{m.from}] {m.text}
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

### Server — host a shared CRDT counter

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { PNCounter } from 'datasole';

const ds = new DatasoleServer();
const http = createServer();
ds.attach(http);
http.listen(3000);

// Server-side CRDT state
const counter = new PNCounter('server');

// When a client sends a CRDT operation, apply it and broadcast the merged state
ds.events.on('crdt:op', ({ data: op }) => {
  counter.apply(op);
  ds.broadcast('crdt:state', counter.state());
});

// Expose current state so new clients can fetch it on connect
ds.rpc.register('crdt:getState', async () => counter.state());
```

### Client — increment from anywhere, state converges

```tsx
import { DatasoleClient, CrdtStore } from 'datasole/client';
import { PNCounter } from 'datasole';
import { useEffect, useRef, useState } from 'react';

function SharedCounter() {
  const ds = useRef(new DatasoleClient({ url: 'ws://localhost:3000' }));
  const store = useRef(new CrdtStore('client-' + Math.random().toString(36).slice(2)));
  const [count, setCount] = useState(0);

  useEffect(() => {
    const counter = store.current.register('votes', 'pn-counter');
    ds.current.connect();

    // Apply server state updates
    ds.current.on('crdt:state', ({ data: state }) => {
      store.current.mergeRemoteState('votes', state);
      setCount(counter.value());
    });

    // Fetch initial state on connect
    ds.current.rpc('crdt:getState').then((state) => {
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
    ds.current.emit('crdt:op', op); // Send to server
    setCount(counter.value()); // Optimistic local update
  };

  const decrement = () => {
    const counter = store.current.get<PNCounter>('votes')!;
    const op = counter.decrement();
    ds.current.emit('crdt:op', op);
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

### Server — three channels, three strategies

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();
const http = createServer();
ds.attach(http);
http.listen(3000);

// Immediate: every update pushes instantly (e.g., price alerts)
const alerts = ds.createSyncChannel({
  key: 'alerts',
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'immediate' },
});

// Batched: accumulate updates, flush every 200ms (e.g., dashboard metrics)
const metrics = ds.createSyncChannel({
  key: 'metrics',
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'batched', batchIntervalMs: 200 },
});

// Debounced: wait for 500ms of inactivity before flushing (e.g., search results)
const search = ds.createSyncChannel({
  key: 'search-results',
  direction: 'server-to-client',
  mode: 'json-patch',
  flush: { flushStrategy: 'debounced', debounceMs: 500 },
});

// Simulate high-frequency metric updates
setInterval(() => {
  metrics.enqueue([
    {
      op: 'replace',
      path: '/cpu',
      value: Math.random() * 100,
    },
  ]);
}, 50); // 20 updates/sec, but client sees batched flushes every 200ms
```

The same server can mix immediate, batched, and debounced channels on different keys — each tuned for its use case.

---

## 8. Session Persistence — Surviving Reconnections

**What you'll learn:** Store per-user state that survives disconnections. When a user reconnects, their session is automatically restored from the persistence backend.

**Time:** 5 minutes

**Building on:** Tutorials 4–5

### Server — persist user progress

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const app = express();
const ds = new DatasoleServer({
  authHandler: async (req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const userId = url.searchParams.get('token');
    return userId ? { authenticated: true, userId } : { authenticated: false };
  },
  session: {
    flushThreshold: 5, // Persist after 5 mutations
    flushIntervalMs: 3000, // Or every 3 seconds
  },
});

const http = createServer(app);
ds.attach(http);

// RPC: save user progress (stored in session, auto-flushed to backend)
ds.rpc.register<{ level: number; score: number }, { ok: boolean }>(
  'saveProgress',
  async (params, ctx) => {
    ds.sessions.set(ctx.connection.userId!, 'level', params.level);
    ds.sessions.set(ctx.connection.userId!, 'score', params.score);
    return { ok: true };
  },
);

// RPC: get user progress (restored from persistence on reconnect)
ds.rpc.register<void, { level: number; score: number }>('getProgress', async (_params, ctx) => {
  const level = ds.sessions.get<number>(ctx.connection.userId!, 'level') ?? 1;
  const score = ds.sessions.get<number>(ctx.connection.userId!, 'score') ?? 0;
  return { level, score };
});

// Listen for session changes (e.g., for a leaderboard)
ds.sessions.onChange((userId, key, value, version) => {
  console.log(`${userId} changed ${key} to ${value} (v${version})`);
});

http.listen(3000);
```

### Client — reconnect and resume

```tsx
import { DatasoleClient } from 'datasole/client';
import { useEffect, useRef, useState } from 'react';

function Game({ userId }: { userId: string }) {
  const ds = useRef(
    new DatasoleClient({
      url: 'ws://localhost:3000',
      auth: { token: userId },
    }),
  );
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);

  useEffect(() => {
    ds.current.connect();

    // Restore progress on (re)connect
    ds.current.rpc<{ level: number; score: number }>('getProgress').then((p) => {
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
    await ds.current.rpc('saveProgress', { level: newLevel, score: newScore });
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

### Server — production configuration

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer, RedisBackend, PrometheusExporter } from 'datasole/server';

const app = express();

const redisBackend = new RedisBackend({ url: 'redis://localhost:6379', prefix: 'ds:' });
await redisBackend.connect();

const ds = new DatasoleServer({
  // Pluggable auth
  authHandler: async (req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) return { authenticated: false };
    return { authenticated: true, userId: token, roles: ['user'] };
  },

  // Thread-pool executor: 4 worker threads handle connection logic
  executor: { model: 'thread-pool', poolSize: 4 },

  // Redis for state persistence (enables multi-process pub/sub)
  stateBackend: redisBackend,

  // Rate limiting: 200 requests/minute per connection
  rateLimit: {
    defaultRule: { windowMs: 60_000, maxRequests: 200 },
    rules: {
      'heavy-rpc': { windowMs: 60_000, maxRequests: 10 },
    },
  },

  // Session persistence: flush every 10 mutations or 5 seconds
  session: { flushThreshold: 10, flushIntervalMs: 5000 },

  // Prometheus metrics
  metricsExporter: new PrometheusExporter('datasole'),
});

const http = createServer(app);
ds.attach(http);

// Expose Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  const exporter = new PrometheusExporter('datasole');
  const text = await exporter.export(ds.metrics.snapshot());
  res.type('text/plain').send(text);
});

// Register your RPC handlers, state, events...
ds.rpc.register('ping', async () => ({ pong: Date.now() }));

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

### Server

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';
import { PNCounter } from 'datasole';

const app = express();
app.use(express.static('public'));

const ds = new DatasoleServer({
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
ds.attach(http);

// ------ Live State: the board ------
interface Task {
  id: string;
  title: string;
  column: string;
  assignee?: string;
}
interface Board {
  tasks: Task[];
  columns: string[];
}

const board: Board = {
  columns: ['todo', 'in-progress', 'done'],
  tasks: [],
};

// Push the full board every time it changes
async function syncBoard() {
  await ds.setState('board', board);
}
syncBoard();

// ------ RPC: add task ------
ds.rpc.register<{ title: string }, { id: string }>('addTask', async (params) => {
  const id = `task-${Date.now()}`;
  board.tasks.push({ id, title: params.title, column: 'todo' });
  await syncBoard();
  return { id };
});

// ------ RPC: move task ------
ds.rpc.register<{ taskId: string; column: string }, { ok: boolean }>('moveTask', async (params) => {
  const task = board.tasks.find((t) => t.id === params.taskId);
  if (task) task.column = params.column;
  await syncBoard();
  return { ok: !!task };
});

// ------ CRDT: online user count ------
const onlineCounter = new PNCounter('server');

ds.events.on('user:join', () => {
  onlineCounter.increment();
  ds.broadcast('presence', onlineCounter.state());
});

ds.events.on('user:leave', () => {
  onlineCounter.decrement();
  ds.broadcast('presence', onlineCounter.state());
});

// ------ Events: chat ------
ds.events.on<{ text: string }>('chat', ({ data }) => {
  ds.broadcast('chat', { text: data.text, timestamp: Date.now() });
});

http.listen(3000, () => console.log('Task board on :3000'));
```

### Client (React)

```tsx
import { DatasoleClient, CrdtStore } from 'datasole/client';
import { PNCounter } from 'datasole';
import { useEffect, useRef, useState } from 'react';

interface Task {
  id: string;
  title: string;
  column: string;
}
interface Board {
  tasks: Task[];
  columns: string[];
}

function TaskBoard({ username }: { username: string }) {
  const ds = useRef(
    new DatasoleClient({
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

    // Live board state
    client.subscribeState<Board>('board', setBoard);

    // Presence via CRDT
    const store = new CrdtStore('client-' + username);
    store.register('online', 'pn-counter');
    client.emit('user:join', {});
    client.on('presence', ({ data: state }) => {
      store.mergeRemoteState('online', state);
      setOnline(store.get<PNCounter>('online')!.value());
    });

    // Chat
    client.on<{ text: string }>('chat', ({ data: msg }) => {
      setMessages((prev) => [...prev.slice(-49), msg.text]);
    });

    return () => {
      client.emit('user:leave', {});
      client.disconnect();
    };
  }, [username]);

  const addTask = async () => {
    if (!newTask.trim()) return;
    await ds.current.rpc('addTask', { title: newTask });
    setNewTask('');
  };

  const moveTask = (taskId: string, column: string) => {
    ds.current.rpc('moveTask', { taskId, column });
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

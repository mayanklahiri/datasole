---
title: State Backends
order: 5
description: StateBackend interface, pluggable implementations, and session persistence.
---

# State Backends

> **Quick start:** See [Tutorial 4 (Live State)](tutorials.md#4-live-state--a-server-synced-dashboard) for the simplest way to use state, and [Tutorial 9 (Production)](tutorials.md#9-production--thread-pool-rate-limiting-redis-metrics) for Redis configuration.

## Interface

All state backends implement:

```typescript
interface StateBackend {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  subscribe(key: string, handler: (key: string, value: unknown) => void): () => void;
  publish(key: string, value: unknown): Promise<void>;
}
```

## Built-in Backends

### MemoryBackend (default)

In-memory Map + EventEmitter. Zero dependencies. Suitable for single-process deployments and development.

```typescript
import { DatasoleServer, MemoryBackend } from 'datasole/server';

const ds = new DatasoleServer({
  stateBackend: new MemoryBackend(),  // This is the default
});
```

### RedisBackend

Requires `ioredis` peer dependency. Uses Redis pub/sub for cross-process state notifications. Required for pm2 cluster deployments.

```typescript
import { DatasoleServer, RedisBackend } from 'datasole/server';

const ds = new DatasoleServer({
  stateBackend: new RedisBackend({
    url: 'redis://localhost:6379',
    prefix: 'ds:',
  }),
});
```

### PostgresBackend

Requires `pg` peer dependency. Persists state to Postgres with LISTEN/NOTIFY for pub/sub. Use for durable persistence.

```typescript
import { DatasoleServer, PostgresBackend } from 'datasole/server';

const ds = new DatasoleServer({
  stateBackend: new PostgresBackend({
    connectionString: 'postgres://user:pass@localhost:5432/mydb',
    tableName: 'datasole_state',
  }),
});
```

## Session Persistence

The `SessionManager` sits on top of any state backend to provide per-user state that survives disconnections:

```typescript
const ds = new DatasoleServer({
  stateBackend: new RedisBackend({ url: 'redis://localhost:6379' }),
  session: {
    flushThreshold: 10,      // Persist after 10 mutations
    flushIntervalMs: 5000,   // Or every 5 seconds
  },
});

// Per-user read/write
ds.setSessionValue('user-123', 'theme', 'dark');
const theme = ds.getSessionValue<string>('user-123', 'theme');

// Change streams
ds.onSessionChange((userId, key, value, version) => {
  console.log(`${userId} changed ${key}`);
});
```

> **Tutorial:** [Session Persistence — Surviving Reconnections](tutorials.md#8-session-persistence--surviving-reconnections)

## Custom Backends

Implement the `StateBackend` interface and pass to `DatasoleServer`:

```typescript
class MyCustomBackend implements StateBackend {
  async get<T>(key: string): Promise<T | undefined> { /* ... */ }
  async set<T>(key: string, value: T): Promise<void> { /* ... */ }
  async delete(key: string): Promise<boolean> { /* ... */ }
  subscribe(key: string, handler: (key: string, value: unknown) => void): () => void { /* ... */ }
  async publish(key: string, value: unknown): Promise<void> { /* ... */ }
}

const ds = new DatasoleServer({ stateBackend: new MyCustomBackend() });
```

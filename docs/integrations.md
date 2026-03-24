---
title: Integrations
order: 0.7
description: Guides for integrating datasole with popular frontend and backend frameworks.
---

# Framework integrations

datasole works with any framework that speaks HTTP/WebSocket. This page shows concrete integration patterns for the most popular choices.

## Frontend frameworks

### React

The most common pattern: create a `DatasoleClient` ref, connect in `useEffect`, and subscribe to state or events.

```tsx
import { DatasoleClient } from 'datasole/client';
import { useEffect, useRef, useState } from 'react';

function useDatasole(url: string) {
  const ds = useRef(new DatasoleClient({ url }));
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const client = ds.current;
    client.connect();
    setConnected(true);
    return () => {
      client.disconnect();
      setConnected(false);
    };
  }, [url]);

  return { client: ds.current, connected };
}

// Usage in a component
function Dashboard() {
  const { client } = useDatasole('ws://localhost:3000');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    client.subscribeState('dashboard', setData);
  }, [client]);

  if (!data) return <p>Loading...</p>;
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

For larger apps, create a React context to share a single `DatasoleClient` across the component tree:

```tsx
import { createContext, useContext, useRef, useEffect } from 'react';
import { DatasoleClient } from 'datasole/client';

const DatasoleContext = createContext<DatasoleClient | null>(null);

export function DatasoleProvider({ url, children }: { url: string; children: React.ReactNode }) {
  const client = useRef(new DatasoleClient({ url }));

  useEffect(() => {
    client.current.connect();
    return () => {
      client.current.disconnect();
    };
  }, [url]);

  return <DatasoleContext.Provider value={client.current}>{children}</DatasoleContext.Provider>;
}

export function useDatasoleClient() {
  const client = useContext(DatasoleContext);
  if (!client) throw new Error('Wrap your app in <DatasoleProvider>');
  return client;
}
```

### Vue 3

datasole data feeds directly into Vue's reactivity system — **no Vuex, no Pinia, no state store needed.** Build composables that return reactive refs; bind them in your SFC template and they update automatically when the server pushes data.

**Quick start — server state as a reactive ref:**

```vue
<script setup lang="ts">
import { useDatasoleState } from './composables/useDatasole';

interface Dashboard {
  visitors: number;
  activeNow: number;
}

// One line. This ref auto-updates whenever the server calls setState('dashboard', ...).
const dashboard = useDatasoleState<Dashboard>('dashboard');
</script>

<template>
  <div v-if="dashboard">
    <p>Visitors: {{ dashboard.visitors }}</p>
    <p>Active: {{ dashboard.activeNow }}</p>
  </div>
  <p v-else>Connecting...</p>
</template>
```

**Server events as a reactive ref:**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useDatasoleEvent } from './composables/useDatasole';

interface Metrics {
  cpuUsage: number;
  memoryMB: number;
  totalMemoryGB: number;
}

const metrics = useDatasoleEvent<Metrics>('system-metrics');

// Computed properties compose naturally with datasole refs
const memoryPct = computed(() =>
  metrics.value
    ? Math.round((metrics.value.memoryMB / (metrics.value.totalMemoryGB * 1024)) * 100)
    : 0,
);
</script>

<template>
  <p v-if="metrics">Memory: {{ metrics.memoryMB }} MB ({{ memoryPct }}%)</p>
</template>
```

**The composable layer** — call `useDatasole()` once at the app root to provide the client to all descendants via `inject()`:

```typescript
// composables/useDatasole.ts
import {
  shallowRef,
  ref,
  watch,
  provide,
  inject,
  onMounted,
  onUnmounted,
  type InjectionKey,
  type Ref,
  type ShallowRef,
} from 'vue';
import { DatasoleClient } from 'datasole/client';
import type { ConnectionState } from 'datasole/client';

const DS_KEY: InjectionKey<ShallowRef<DatasoleClient | null>> = Symbol('datasole');

/** Call once at app root. Creates, connects, and provides the client. */
export function useDatasole() {
  const ds = shallowRef<DatasoleClient | null>(null);
  provide(DS_KEY, ds);

  onMounted(() => {
    const client = new DatasoleClient({ url: `ws://${window.location.host}` });
    ds.value = client;
    client.connect();
  });

  onUnmounted(() => {
    ds.value?.disconnect();
    ds.value = null;
  });
}

/** Server event → reactive ref. Auto-subscribes, auto-cleans up. */
export function useDatasoleEvent<T>(eventName: string): Ref<T | null> {
  const ds = inject(DS_KEY)!;
  const data = ref<T | null>(null) as Ref<T | null>;
  let cleanup: (() => void) | null = null;

  watch(
    ds,
    (client) => {
      cleanup?.();
      cleanup = null;
      if (!client) return;
      const handler = (ev: { data: T }) => {
        data.value = ev.data;
      };
      client.on(eventName, handler);
      cleanup = () => client.off(eventName, handler);
    },
    { immediate: true },
  );

  onUnmounted(() => cleanup?.());
  return data;
}

/** Server state → reactive ref. Synced via JSON Patch. */
export function useDatasoleState<T>(key: string): Ref<T | null> {
  const ds = inject(DS_KEY)!;
  const data = ref<T | null>(null) as Ref<T | null>;
  let cleanup: (() => void) | null = null;

  watch(
    ds,
    (client) => {
      cleanup?.();
      cleanup = null;
      if (!client) return;
      const sub = client.subscribeState(key, (val: T) => {
        data.value = val;
      });
      cleanup = () => sub.unsubscribe();
    },
    { immediate: true },
  );

  onUnmounted(() => cleanup?.());
  return data;
}

/** Raw client ref for imperative calls (emit, rpc). */
export function useDatasoleClient(): ShallowRef<DatasoleClient | null> {
  return inject(DS_KEY)!;
}
```

The internal `watch` on the client `shallowRef` handles the async lifecycle — the subscription activates when the client connects and cleans up when the component unmounts. No manual `onMounted`/`onUnmounted` boilerplate needed in leaf components.

### Next.js (App Router)

datasole uses WebSockets, which are client-only. Mark your datasole components with `"use client"` and connect in `useEffect`.

```tsx
// app/providers/datasole.tsx
'use client';

import { DatasoleClient } from 'datasole/client';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

const Ctx = createContext<DatasoleClient | null>(null);

export function DatasoleProvider({ children }: { children: ReactNode }) {
  const client = useRef<DatasoleClient | null>(null);

  if (!client.current) {
    client.current = new DatasoleClient({
      url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
      useWorker: false,
    });
  }

  useEffect(() => {
    client.current!.connect();
    return () => {
      client.current!.disconnect();
    };
  }, []);

  return <Ctx.Provider value={client.current}>{children}</Ctx.Provider>;
}

export function useDatasole() {
  const client = useContext(Ctx);
  if (!client) throw new Error('Missing DatasoleProvider');
  return client;
}
```

```tsx
// app/layout.tsx
import { DatasoleProvider } from './providers/datasole';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DatasoleProvider>{children}</DatasoleProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useDatasole } from '../providers/datasole';

export default function DashboardPage() {
  const client = useDatasole();
  const [metrics, setMetrics] = useState<Record<string, number>>({});

  useEffect(() => {
    client.subscribeState('metrics', setMetrics);
  }, [client]);

  return (
    <div>
      <h1>Live Dashboard</h1>
      {Object.entries(metrics).map(([key, value]) => (
        <p key={key}>
          {key}: {value}
        </p>
      ))}
    </div>
  );
}
```

::: warning
Do not import `datasole/server` in Next.js client components. The server package uses Node.js APIs (`ws`, `worker_threads`) that are not available in the browser. Server-side datasole code should live in a separate Node.js process, not in Next.js API routes.
:::

**Required `next.config.ts`:**

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['datasole'],
};

export default nextConfig;
```

::: warning
Turbopack (the default bundler in Next.js 15+) does not resolve datasole's `exports` subpaths correctly for local/linked packages. Use the webpack bundler:

```bash
next dev --webpack
next build --webpack
```

:::

## Backend frameworks

### Express

Express is the most common Node.js backend. datasole attaches to the underlying `http.Server`, so it works alongside Express routes.

```typescript
import express from 'express';
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const app = express();
app.use(express.json());

// Standard Express routes
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// datasole attaches to the same HTTP server
const ds = new DatasoleServer({
  authHandler: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return { authenticated: false };
    return { authenticated: true, userId: token };
  },
});

ds.rpc.register('getData', async () => ({ items: [] }));

const httpServer = createServer(app);
ds.attach(httpServer);

httpServer.listen(3000, () => console.log('Express + datasole on :3000'));
```

datasole handles WebSocket upgrades on `/__ds` (configurable via the `path` option). All other routes are handled by Express as usual.

### NestJS

In NestJS, get the underlying HTTP server from the Nest application instance and attach datasole to it.

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DatasoleServer } from 'datasole/server';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpServer = app.getHttpServer();

  const ds = new DatasoleServer({
    authHandler: async (req) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return { authenticated: false };
      return { authenticated: true, userId: token };
    },
  });

  // Register RPC handlers, events, state, etc.
  ds.rpc.register('getItems', async () => ({ items: [] }));

  ds.attach(httpServer);

  await app.listen(3000);
  console.log('NestJS + datasole on :3000');
}

bootstrap();
```

If you prefer NestJS's module system, wrap the `DatasoleServer` in a provider:

```typescript
// datasole.module.ts
import { Module, Global, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DatasoleServer } from 'datasole/server';

@Global()
@Module({
  providers: [
    {
      provide: DatasoleServer,
      useFactory: () =>
        new DatasoleServer({
          authHandler: async (req) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) return { authenticated: false };
            return { authenticated: true, userId: token };
          },
        }),
    },
  ],
  exports: [DatasoleServer],
})
export class DatasoleModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly ds: DatasoleServer,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit() {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
    this.ds.attach(httpServer);
  }

  async onModuleDestroy() {
    await this.ds.close();
  }
}
```

Then inject `DatasoleServer` into any service:

```typescript
// items.service.ts
import { Injectable } from '@nestjs/common';
import { DatasoleServer } from 'datasole/server';

@Injectable()
export class ItemsService {
  constructor(private readonly ds: DatasoleServer) {
    this.ds.rpc.register('getItems', async () => this.findAll());
    this.ds.rpc.register('createItem', async (params: { name: string }) => this.create(params));
  }

  findAll() {
    return [];
  }
  create(params: { name: string }) {
    return { id: Date.now(), ...params };
  }
}
```

### Native Node.js HTTP

No framework needed. datasole attaches directly to `http.createServer()`.

```typescript
import { createServer } from 'http';
import { DatasoleServer } from 'datasole/server';

const ds = new DatasoleServer();

ds.rpc.register('ping', async () => ({ pong: Date.now() }));

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

ds.attach(httpServer);
httpServer.listen(3000, () => console.log('Listening on :3000'));
```

This is the minimal setup — no Express, no framework overhead. The `http.createServer` callback handles regular HTTP requests; datasole handles WebSocket upgrades on the same port.

### AdonisJS

AdonisJS v6 uses its own HTTP server. Get the underlying Node.js `http.Server` instance and attach datasole.

```typescript
// start/datasole.ts
import { DatasoleServer } from 'datasole/server';
import app from '@adonisjs/core/services/app';
import server from '@adonisjs/core/services/server';

const ds = new DatasoleServer({
  authHandler: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return { authenticated: false };
    return { authenticated: true, userId: token };
  },
});

ds.rpc.register('getUser', async (params: { id: string }) => {
  // Use AdonisJS services via the IoC container
  const UserService = await app.container.make('UserService');
  return UserService.find(params.id);
});

// Attach after the HTTP server is ready
server.ready(() => {
  const httpServer = server.getNodeServer();
  if (httpServer) {
    ds.attach(httpServer);
  }
});

export { ds };
```

```typescript
// providers/datasole_provider.ts
import type { ApplicationService } from '@adonisjs/core/types';

export default class DatasoleProvider {
  constructor(protected app: ApplicationService) {}

  async shutdown() {
    const { ds } = await import('#start/datasole');
    await ds.close();
  }
}
```

Register the provider in `adonisrc.ts`:

```typescript
// adonisrc.ts
export default defineConfig({
  providers: [
    // ...other providers
    () => import('./providers/datasole_provider.js'),
  ],
});
```

### Vanilla JavaScript / jQuery (IIFE)

For non-bundled environments, use the IIFE build via a `<script>` tag. The client is exposed as `window.Datasole`.

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="/static/datasole.iife.min.js"></script>
  </head>
  <body>
    <div id="status">Connecting...</div>
    <div id="data"></div>
    <button id="rpc-btn">Call RPC</button>
    <div id="rpc-result"></div>

    <script>
      var ds = new Datasole.DatasoleClient({
        url: 'ws://' + window.location.host,
        // useWorker: true (default) — server must serve /datasole-worker.iife.min.js
      });

      ds.connect();
      document.getElementById('status').textContent = 'Connected';

      ds.subscribeState('dashboard', function (state) {
        document.getElementById('data').textContent = JSON.stringify(state);
      });

      document.getElementById('rpc-btn').addEventListener('click', function () {
        ds.rpc('getData', { search: 'test' }).then(function (result) {
          document.getElementById('rpc-result').textContent = JSON.stringify(result);
        });
      });
    </script>
  </body>
</html>
```

Copy the IIFE bundle from `node_modules/datasole/dist/client/datasole.iife.min.js` to your static assets directory. The global namespace is `Datasole` — use `new Datasole.DatasoleClient(opts)`.

::: tip
With jQuery, the same pattern applies — just use `$('#status').text(...)` instead of `document.getElementById(...)`.
:::

## General patterns

### Sharing types between client and server

datasole's TypeScript generics propagate types from server handlers to client call sites. Define shared types in a common file:

```typescript
// shared/types.ts
export interface AddParams {
  a: number;
  b: number;
}
export interface AddResult {
  sum: number;
}

// server
import type { AddParams, AddResult } from '../shared/types';
ds.rpc.register<AddParams, AddResult>('add', async (params) => {
  return { sum: params.a + params.b };
});

// client
import type { AddResult } from '../shared/types';
const result = await client.rpc<AddResult>('add', { a: 1, b: 2 });
// result.sum is typed as number
```

### Authentication

All integrations follow the same auth pattern: inspect the incoming HTTP upgrade request and return an `AuthResult`.

```typescript
const ds = new DatasoleServer({
  authHandler: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return { authenticated: false };
    }

    // Verify JWT, look up user, check permissions
    const user = await verifyToken(token);

    return {
      authenticated: true,
      userId: user.id,
      roles: user.roles,
      metadata: { displayName: user.name },
    };
  },
});
```

The auth result is available in RPC handlers and event callbacks via the connection context.

## Common pitfalls

### WebSocket path

datasole listens for WebSocket upgrades on `/__ds` by default. If you have a reverse proxy (nginx, Cloudflare, Vercel), make sure it forwards WebSocket upgrades for this path. You can change it:

```typescript
const ds = new DatasoleServer({ path: '/my-ws-path' });
const client = new DatasoleClient({ url: 'ws://localhost:3000/my-ws-path' });
```

### Server-side rendering (SSR)

`datasole/client` uses browser APIs (`WebSocket`, `Worker`). In SSR environments (Next.js, Nuxt, SvelteKit), only import and use the client in client-side code:

- **Next.js**: Mark components with `"use client"`
- **Nuxt**: Use `<ClientOnly>` wrapper or `onMounted`
- **SvelteKit**: Use `browser` check from `$app/environment`

### React Native

React Native doesn't support Web Workers. Disable the worker transport:

```typescript
const ds = new DatasoleClient({ url: 'ws://localhost:3000', useWorker: false });
```

### CORS and SharedArrayBuffer

SharedArrayBuffer (for zero-copy transfer) requires specific HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers, datasole falls back to `postMessage` with `Transferable` — still fast, just not zero-copy. The client handles this automatically.

### Next.js: separate server process

datasole's server uses `ws`, `worker_threads`, and other Node.js APIs that cannot run in Next.js Edge Runtime or API routes. The datasole server must be a **separate Node.js process** (Express, NestJS, or plain `http.createServer`). The Next.js client connects to it via WebSocket using `NEXT_PUBLIC_WS_URL`.

```bash
# Terminal 1: datasole server
node server.mjs          # Express + DatasoleServer on :3000

# Terminal 2: Next.js app
next dev --webpack        # Next.js on :3001, connects to ws://localhost:3000
```

### Next.js: Turbopack

Turbopack does not correctly resolve `exports` subpath imports (`datasole/client`) for linked or local packages. Use the webpack bundler with `--webpack` flag for both `next dev` and `next build` until Turbopack supports this.

### Reconnection

datasole automatically reconnects on disconnect with exponential backoff. No configuration needed for basic reconnection. The client emits `disconnect` and `reconnect` events you can listen to for UI feedback.

### Port conflicts

If a previous datasole server process is still running, starting a new one on the same port fails with `EADDRINUSE`. Kill the old process first or use a different port.

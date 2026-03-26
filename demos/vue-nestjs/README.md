# Vue 3 + NestJS Demo

Vue 3 SFC frontend with Vite 8, NestJS 11 backend — connected via datasole WebSocket with Web Worker transport and Pako compression.

## The Vue SFC Experience

This demo showcases how datasole's reactive data model integrates natively with Vue's reactivity system — **no Vuex, no Pinia, no state store at all.** The server is the store.

Three composables replace an entire state layer:

```vue
<script setup lang="ts">
// Server event → reactive ref. Updates arrive off-thread via Web Worker.
const metrics = useDatasoleEvent<Metrics>('system-metrics');

// Server state → reactive ref. Synced via JSON Patch over the wire.
const messages = useDatasoleState<ChatMessage[]>('chat:messages');

// Raw client for imperative calls (emit, rpc).
const ds = useDatasoleClient();
</script>

<template>
  <!-- Bind directly in your template — they're just refs -->
  <p>{{ metrics?.connections }} connected</p>
  <div v-for="msg in messages" :key="msg.id">{{ msg.text }}</div>
  <button @click="ds?.rpc('randomNumber', { min: 1, max: 100 })">Roll</button>
</template>
```

Computed properties compose naturally:

```typescript
const memoryPct = computed(() =>
  Math.round((metrics.value!.memoryMB / (metrics.value!.totalMemoryGB * 1024)) * 100),
);
```

Everything works because datasole updates `ref.value` from the Web Worker thread — Vue's reactivity system picks it up instantly and re-renders only what changed. The main thread stays free for smooth 60 fps animations.

## What It Does

Three panels demonstrate datasole's core data-flow patterns:

| Panel          | Pattern                       | Composable Used                                     |
| -------------- | ----------------------------- | --------------------------------------------------- |
| Server Metrics | Server → client broadcast     | `useDatasoleEvent<Metrics>('system-metrics')`       |
| Chat Room      | Client ↔ server state sync    | `useDatasoleState<ChatMessage[]>('chat:messages')`  |
| RPC Random     | Client → server request/reply | `useDatasoleClient()` → `ds.rpc('randomNumber', …)` |

## Quickstart

```bash
# from repo root — build datasole first
npm run build

# install & run dev
cd demos/vue-nestjs
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174) (Vite dev server proxies WebSocket to NestJS on 4002).

## Production

```bash
npm run build
npm start
```

Then open [http://localhost:4002](http://localhost:4002).

## Stack

| Layer   | Technology                   |
| ------- | ---------------------------- |
| Server  | NestJS 11 + `DatasoleServer` |
| Client  | Vue 3 SFC + Vite 8           |
| Bundler | Vite 8                       |
| Types   | TypeScript 5.9 (strict)      |

## Ports

- **Dev**: Vite on `5174`, NestJS on `4002` (proxied via Vite)
- **Prod**: NestJS on `4002` serves built client via `@nestjs/serve-static`

Override backend port with `PORT` env var.

## Server-Side Integration

NestJS integration follows the standard module/service pattern:

### `app.module.ts`

```typescript
@Module({
  imports: hasClientBuild ? [ServeStaticModule.forRoot({ rootPath: clientDist })] : [],
  providers: [DatasoleService],
  exports: [DatasoleService],
})
export class AppModule {}
```

### `datasole.service.ts`

```typescript
@Injectable()
export class DatasoleService implements OnModuleDestroy {
  readonly ds = new DatasoleServer();

  async init(): Promise<void> {
    // Register event handlers, RPC methods, state, and metrics broadcast
    this.ds.primitives.events.on('chat:send', (payload) => {
      /* ... */
    });
    this.ds.rpc.register('randomNumber', async ({ min, max }) => {
      /* ... */
    });
    await this.ds.localServer.setState('chat:messages', this.chatHistory);
  }

  onModuleDestroy(): void {
    this.ds.close();
  }
}
```

### `main.ts`

```typescript
import 'reflect-metadata';

const app = await NestFactory.create<NestExpressApplication>(AppModule);

// Attach datasole to NestJS's underlying HTTP server
const datasoleService = app.get(DatasoleService);
await datasoleService.init();
datasoleService.ds.transport.attach(app.getHttpServer());

await app.listen(4002);
```

Key points:

- `DatasoleServer` defaults to `thread-pool` concurrency with 4 Node.js `worker_threads`
- `reflect-metadata` must be imported **before** any NestJS code
- `app.getHttpServer()` returns the raw Node.js `http.Server` — this is what `ds.transport.attach()` expects
- Datasole runtime assets are auto-served under `/__ds`
- `@nestjs/serve-static` serves the Vite-built client from `dist/client/` in production
- `OnModuleDestroy` ensures graceful cleanup of the datasole server and metrics interval

## Client-Side Integration

### 1. Initialize at the app root

`useDatasole()` creates the client, connects, and provides it to all descendants via Vue's `provide`/`inject`:

```vue
<!-- App.vue -->
<script setup lang="ts">
import { useDatasole } from './composables/useDatasole';
useDatasole();
</script>
```

### 2. Consume data in any SFC

Child components import composables — no prop drilling, no context wrapper components:

```typescript
const metrics = useDatasoleEvent<Metrics>('system-metrics'); // broadcast → ref
const messages = useDatasoleState<ChatMsg[]>('chat:messages'); // server state → ref
const ds = useDatasoleClient(); // raw client for emit/rpc
const conn = useConnectionState(); // 'connected' | 'disconnected' | ...
```

### 3. How it works

- `useDatasole()` creates and provides the `DatasoleClient` via `provide()`/`inject()` — called once at the root
- `useDatasoleEvent` watches the client ref and registers/unregisters event listeners automatically
- `useDatasoleState` subscribes via `client.subscribeState()` — cleanup calls `sub.unsubscribe()` automatically via `onUnmounted`
- All composables return reactive `Ref`s — bind them in `<template>` and Vue handles the rest

### 4. Deriving values

Use Vue's `computed` for any derivation from server data — standard Vue idiom, no store getters:

```typescript
const uptimeDisplay = computed(() => {
  const s = Math.floor(metrics.value.uptime / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
});

const totalMessages = computed(() => metrics.value.messagesIn + metrics.value.messagesOut);
```

### 5. Animations

Vue's `<TransitionGroup>` works directly with the reactive data:

```vue
<TransitionGroup name="msg" tag="div">
  <div v-for="msg in messages" :key="msg.id" class="chat-msg">
    {{ msg.text }}
  </div>
</TransitionGroup>
```

## Vite Dev Proxy

In `vite.config.ts`, datasole path traffic is proxied to the NestJS backend:

```typescript
proxy: {
  '/__ds': { target: 'http://localhost:4002', ws: true },
  '/__ds/datasole-worker.iife.min.js': { target: 'http://localhost:4002' },
  '/datasole-worker.iife.min.js': { target: 'http://localhost:4002' },
}
```

- `/__ds` — WebSocket + runtime asset path

## Testing

This demo is tested as part of the parent project's e2e suite:

```bash
# from repo root
npm run test:e2e:demos
```

The Playwright e2e test:

1. Runs `npm install` in this directory (if `node_modules/` is absent)
2. Builds production assets (`npm run build`)
3. Starts the server in production mode (`npm start`)
4. Navigates to `http://localhost:4002`
5. Verifies real-time metric updates arrive within 5 seconds
6. Captures screenshots for visual regression

## Framework Quirks

- `reflect-metadata` must be imported before any NestJS code — this is a NestJS/decorator requirement
- `tsconfig.server.json` enables `experimentalDecorators` and `emitDecoratorMetadata` (required by NestJS decorators)
- `@nestjs/serve-static` serves the Vite-built client from `dist/client/` in production
- Datasole attaches directly to the raw `http.Server` via `app.getHttpServer()` — no NestJS WebSocket gateway needed
- Vue composable pins `workerUrl: '/datasole-worker.iife.min.js'` to match Nest static middleware behavior
- Vue's `<script setup lang="ts">` is the recommended SFC syntax — all components in this demo use it

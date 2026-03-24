---
title: Configuration
order: 2.5
description: Consolidated client and server configuration reference.
---

# Configuration Reference

Use this page as the single configuration map for both `DatasoleServer` and `DatasoleClient`.

## Server options

All fields are optional in `new DatasoleServer(options)`.

| Option               | Type                       | Default                                                  | Notes                                              |
| -------------------- | -------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `path`               | `string`                   | `'/__ds'`                                                | WebSocket/runtime asset base path                  |
| `authHandler`        | `AuthHandlerFn`            | allow-all                                                | Upgrade authentication hook                        |
| `stateBackend`       | `StateBackend`             | `new MemoryBackend()`                                    | Shared backend for all server primitives           |
| `backendConfig`      | `BackendConfig`            | `undefined`                                              | Declarative backend config                         |
| `metricsExporter`    | `MetricsExporter`          | `undefined`                                              | Prometheus/OpenTelemetry/custom exporter           |
| `perMessageDeflate`  | `boolean`                  | `false`                                                  | Usually keep disabled; datasole already compresses |
| `executor`           | `Partial<ExecutorOptions>` | `{ model: 'async' }`                                     | Async/thread/thread-pool execution                 |
| `rateLimit`          | `RateLimitConfig`          | `{ defaultRule: { windowMs: 60000, maxRequests: 100 } }` | Per-connection frame limiting                      |
| `session`            | `SessionOptions`           | `{ flushThreshold: 10, flushIntervalMs: 5000 }`          | Session persistence tuning                         |
| `maxConnections`     | `number`                   | `10000`                                                  | Hard cap for concurrent WS clients                 |
| `maxCrdtKeys`        | `number`                   | `1000`                                                   | Cap for tracked CRDT keys                          |
| `maxEventNameLength` | `number`                   | `256`                                                    | Input guardrail for event names                    |

See full server examples in [Server API](server.md#configuration-reference).

## Client options

All fields are optional except `url` in `new DatasoleClient(options)`.

| Option                 | Type              | Default                               | Notes                                     |
| ---------------------- | ----------------- | ------------------------------------- | ----------------------------------------- |
| `url`                  | `string`          | required                              | Base host (`ws://` or `http://` accepted) |
| `path`                 | `string`          | `'/__ds'`                             | WS/runtime asset path                     |
| `auth`                 | `AuthCredentials` | `{}`                                  | `auth.token` becomes `?token=...` query   |
| `useWorker`            | `boolean`         | `true`                                | Keep true for browser apps                |
| `workerUrl`            | `string`          | `${path}/datasole-worker.iife.min.js` | Auto-served by server at `path`           |
| `useSharedArrayBuffer` | `boolean`         | `false`                               | Requires COOP/COEP                        |
| `reconnect`            | `boolean`         | `true`                                | Enable automatic reconnect                |
| `reconnectInterval`    | `number`          | `1000`                                | Backoff base interval (ms)                |
| `maxReconnectAttempts` | `number`          | `10`                                  | Reconnect attempt cap                     |

See full client examples in [Client API](client.md#constructor).

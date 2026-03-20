---
title: Metrics
order: 6
description: Metrics collector API and exporter configuration.
---

# Metrics

> **Quick start:** See [Tutorial 9 (Production)](tutorials.md#9-production--thread-pool-rate-limiting-redis-metrics) for wiring Prometheus metrics in a production server.

## MetricsCollector

Accumulates internal counters: connections, messages in/out, bytes in/out, RPC calls/errors, state patches, uptime.

```typescript
const snapshot = ds.getMetrics().snapshot();
// {
//   connections: 42,
//   messagesIn: 1234,
//   messagesOut: 5678,
//   bytesIn: 102400,
//   bytesOut: 409600,
//   rpcCalls: 890,
//   rpcErrors: 3,
//   statePatches: 456,
//   uptime: 3600000,
// }
```

## Exporters

### PrometheusExporter

Outputs Prometheus text exposition format. Expose as an HTTP endpoint:

```typescript
import express from 'express';
import { DatasoleServer, PrometheusExporter } from 'datasole/server';

const ds = new DatasoleServer({
  metricsExporter: new PrometheusExporter('datasole'),
});

const app = express();
app.get('/metrics', async (_req, res) => {
  const exporter = new PrometheusExporter('datasole');
  const text = await exporter.export(ds.getMetrics().snapshot());
  res.type('text/plain').send(text);
});
```

Output:

```
datasole_connections 42
datasole_messagesIn 1234
datasole_messagesOut 5678
datasole_bytesIn 102400
datasole_bytesOut 409600
datasole_rpcCalls 890
datasole_rpcErrors 3
datasole_statePatches 456
datasole_uptime 3600000
```

### OpenTelemetryExporter

Bridges to the OpenTelemetry Metrics SDK. Requires `@opentelemetry/api` peer dependency. You must call `initialize()` before the first export to load the OpenTelemetry API dynamically.

```typescript
import { OpenTelemetryExporter } from 'datasole/server';

const exporter = new OpenTelemetryExporter();
await exporter.initialize();

const ds = new DatasoleServer({
  metricsExporter: exporter,
});
```

## Custom Exporters

Implement the `MetricsExporter` interface:

```typescript
interface MetricsExporter {
  export(snapshot: MetricsSnapshot): Promise<string>;
}

class DatadogExporter implements MetricsExporter {
  async export(snapshot: MetricsSnapshot): Promise<string> {
    // Format for Datadog, StatsD, etc.
    return '';
  }
}
```

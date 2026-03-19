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
//   uptimeMs: 3600000,
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
datasole_messages_in_total 1234
datasole_messages_out_total 5678
datasole_bytes_in_total 102400
datasole_bytes_out_total 409600
datasole_rpc_calls_total 890
datasole_rpc_errors_total 3
```

### OpenTelemetryExporter

Bridges to the OpenTelemetry Metrics SDK. Requires `@opentelemetry/api` peer dependency.

```typescript
import { OpenTelemetryExporter } from 'datasole/server';

const ds = new DatasoleServer({
  metricsExporter: new OpenTelemetryExporter(),
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

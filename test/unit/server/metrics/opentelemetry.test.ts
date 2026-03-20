import { describe, it, expect } from 'vitest';

import { OpenTelemetryExporter } from '../../../../src/server/metrics/exporters/opentelemetry';

describe('OpenTelemetryExporter', () => {
  it('constructs with default meter name', () => {
    const exporter = new OpenTelemetryExporter();
    expect(exporter).toBeDefined();
  });

  it('export throws before initialize', async () => {
    const exporter = new OpenTelemetryExporter();
    await expect(
      exporter.export({
        connections: 0,
        messagesIn: 0,
        messagesOut: 0,
        bytesIn: 0,
        bytesOut: 0,
        rpcCalls: 0,
        rpcErrors: 0,
        statePatches: 0,
        uptime: 0,
      }),
    ).rejects.toThrow('not initialized');
  });
});

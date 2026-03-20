import { describe, it, expect } from 'vitest';

import { PrometheusExporter } from '../../../../src/server/metrics/exporters/prometheus';
import type { MetricsSnapshot } from '../../../../src/server/metrics/types';

describe('PrometheusExporter', () => {
  const fullSnapshot: MetricsSnapshot = {
    connections: 10,
    messagesIn: 200,
    messagesOut: 150,
    bytesIn: 4096,
    bytesOut: 2048,
    rpcCalls: 50,
    rpcErrors: 3,
    statePatches: 12,
    uptime: 60000,
  };

  it('uses default prefix "datasole"', async () => {
    const exporter = new PrometheusExporter();
    const output = await exporter.export({ connections: 1 } as MetricsSnapshot);
    expect(output).toContain('datasole_connections 1');
  });

  it('uses a custom prefix', async () => {
    const exporter = new PrometheusExporter('myapp');
    const output = await exporter.export({ connections: 7 } as MetricsSnapshot);
    expect(output).toContain('myapp_connections 7');
    expect(output).not.toContain('datasole');
  });

  it('formats each line as prefix_key value', async () => {
    const exporter = new PrometheusExporter();
    const output = await exporter.export(fullSnapshot);
    const lines = output.split('\n');

    for (const line of lines) {
      expect(line).toMatch(/^datasole_\w+ \d+$/);
    }
  });

  it('returns empty string for empty snapshot', async () => {
    const exporter = new PrometheusExporter();
    const output = await exporter.export({} as MetricsSnapshot);
    expect(output).toBe('');
  });

  it('includes all MetricsSnapshot fields', async () => {
    const exporter = new PrometheusExporter();
    const output = await exporter.export(fullSnapshot);
    const lines = output.split('\n');

    expect(lines).toHaveLength(Object.keys(fullSnapshot).length);

    expect(output).toContain('datasole_connections 10');
    expect(output).toContain('datasole_messagesIn 200');
    expect(output).toContain('datasole_messagesOut 150');
    expect(output).toContain('datasole_bytesIn 4096');
    expect(output).toContain('datasole_bytesOut 2048');
    expect(output).toContain('datasole_rpcCalls 50');
    expect(output).toContain('datasole_rpcErrors 3');
    expect(output).toContain('datasole_statePatches 12');
    expect(output).toContain('datasole_uptime 60000');
  });

  it('joins lines with newline, no trailing newline', async () => {
    const exporter = new PrometheusExporter();
    const output = await exporter.export(fullSnapshot);
    expect(output).not.toMatch(/\n$/);
    expect(output.split('\n').length).toBe(Object.keys(fullSnapshot).length);
  });
});

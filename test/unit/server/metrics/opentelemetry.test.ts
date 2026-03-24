import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCounter, mockMeter, mockGetMeter } = vi.hoisted(() => {
  const mockCounter = { add: vi.fn() };
  const mockMeter = { createUpDownCounter: vi.fn(() => mockCounter) };
  const mockGetMeter = vi.fn(() => mockMeter);
  return { mockCounter, mockMeter, mockGetMeter };
});

vi.mock('@opentelemetry/api', () => ({
  metrics: { getMeter: mockGetMeter },
}));

import { OpenTelemetryExporter } from '../../../../src/server/metrics/exporters/opentelemetry';
import type { MetricsSnapshot } from '../../../../src/server/metrics/types';

function makeSnapshot(overrides: Partial<MetricsSnapshot> = {}): MetricsSnapshot {
  return {
    connections: 10,
    messagesIn: 100,
    messagesOut: 200,
    bytesIn: 5000,
    bytesOut: 8000,
    rpcCalls: 50,
    rpcErrors: 2,
    statePatches: 30,
    uptime: 3600,
    ...overrides,
  };
}

describe('OpenTelemetryExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructor defaults meterName to "datasole"', () => {
    const exporter = new OpenTelemetryExporter();
    expect(exporter).toBeDefined();
  });

  it('constructor accepts custom meterName', () => {
    const exporter = new OpenTelemetryExporter('custom-meter');
    expect(exporter).toBeDefined();
  });

  describe('initialize()', () => {
    it('imports @opentelemetry/api and gets meter with default name', async () => {
      const exporter = new OpenTelemetryExporter();
      await exporter.initialize();
      expect(mockGetMeter).toHaveBeenCalledWith('datasole');
    });

    it('uses custom meterName when provided', async () => {
      const exporter = new OpenTelemetryExporter('my-app');
      await exporter.initialize();
      expect(mockGetMeter).toHaveBeenCalledWith('my-app');
    });
  });

  describe('export()', () => {
    it('throws when called before initialize()', async () => {
      const exporter = new OpenTelemetryExporter();
      await expect(exporter.export(makeSnapshot())).rejects.toThrow(
        'OpenTelemetryExporter not initialized',
      );
    });

    it('creates UpDownCounters for each numeric field and calls add()', async () => {
      const exporter = new OpenTelemetryExporter();
      await exporter.initialize();

      const snapshot = makeSnapshot();
      await exporter.export(snapshot);

      const numericKeys = Object.entries(snapshot).filter(([, v]) => typeof v === 'number');
      expect(mockMeter.createUpDownCounter).toHaveBeenCalledTimes(numericKeys.length);

      for (const [key] of numericKeys) {
        expect(mockMeter.createUpDownCounter).toHaveBeenCalledWith(`datasole.${key}`, {
          description: `Datasole metric: ${key}`,
        });
      }

      expect(mockCounter.add).toHaveBeenCalledTimes(numericKeys.length);
    });

    it('returns JSON string of the snapshot', async () => {
      const exporter = new OpenTelemetryExporter();
      await exporter.initialize();

      const snapshot = makeSnapshot();
      const result = await exporter.export(snapshot);
      expect(result).toBe(JSON.stringify(snapshot));
    });

    it('reuses existing counters on subsequent exports', async () => {
      const exporter = new OpenTelemetryExporter();
      await exporter.initialize();

      const snapshot = makeSnapshot();
      await exporter.export(snapshot);
      const firstCallCount = mockMeter.createUpDownCounter.mock.calls.length;

      await exporter.export(snapshot);
      expect(mockMeter.createUpDownCounter).toHaveBeenCalledTimes(firstCallCount);
    });

    it('skips non-numeric fields', async () => {
      const exporter = new OpenTelemetryExporter();
      await exporter.initialize();

      const snapshot = { ...makeSnapshot(), label: 'test' } as MetricsSnapshot;
      await exporter.export(snapshot);

      for (const call of mockMeter.createUpDownCounter.mock.calls) {
        expect((call as unknown[])[0]).not.toBe('datasole.label');
      }
    });
  });

  describe('initialize() failure', () => {
    it('throws descriptive error when @opentelemetry/api import fails', async () => {
      vi.doMock('@opentelemetry/api', () => {
        throw new Error('Cannot find module');
      });

      const { OpenTelemetryExporter: FreshExporter } =
        await import('../../../../src/server/metrics/exporters/opentelemetry');
      const exporter = new FreshExporter();
      await expect(exporter.initialize()).rejects.toThrow(
        'OpenTelemetryExporter requires "@opentelemetry/api"',
      );

      vi.doUnmock('@opentelemetry/api');
    });
  });
});

/**
 * OpenTelemetry metrics exporter: bridges MetricsSnapshot to OTLP counter observations.
 */
import type { MetricsExporter, MetricsSnapshot } from '../types';

interface OtelCounter {
  add(value: number): void;
}

interface OtelMeter {
  createUpDownCounter(name: string, options?: { description?: string }): OtelCounter;
}

export class OpenTelemetryExporter implements MetricsExporter {
  private meter: OtelMeter | null = null;
  private counters = new Map<string, OtelCounter>();
  private readonly meterName: string;

  constructor(meterName = 'datasole') {
    this.meterName = meterName;
  }

  async initialize(): Promise<void> {
    try {
      const otel = await import('@opentelemetry/api');
      this.meter = otel.metrics.getMeter(this.meterName) as unknown as OtelMeter;
    } catch {
      throw new Error(
        'OpenTelemetryExporter requires "@opentelemetry/api". ' +
          'Install it: npm install @opentelemetry/api',
      );
    }
  }

  async export(snapshot: MetricsSnapshot): Promise<string> {
    if (!this.meter) {
      throw new Error('OpenTelemetryExporter not initialized. Call initialize() first.');
    }

    for (const [key, value] of Object.entries(snapshot)) {
      if (typeof value !== 'number') continue;
      let counter = this.counters.get(key);
      if (!counter) {
        counter = this.meter.createUpDownCounter(`datasole.${key}`, {
          description: `Datasole metric: ${key}`,
        });
        this.counters.set(key, counter);
      }
      counter.add(value);
    }

    return JSON.stringify(snapshot);
  }
}

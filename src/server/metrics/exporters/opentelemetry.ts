import type { MetricsExporter, MetricsSnapshot } from '../types';

export class OpenTelemetryExporter implements MetricsExporter {
  async export(_snapshot: MetricsSnapshot): Promise<string> {
    // TODO: bridge to OTel Metrics SDK
    throw new Error('Not implemented: install @opentelemetry/api peer dependency');
  }
}

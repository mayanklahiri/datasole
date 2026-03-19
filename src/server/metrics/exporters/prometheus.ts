import type { MetricsExporter, MetricsSnapshot } from '../types';

export class PrometheusExporter implements MetricsExporter {
  private prefix: string;

  constructor(prefix = 'datasole') {
    this.prefix = prefix;
  }

  async export(snapshot: MetricsSnapshot): Promise<string> {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(snapshot)) {
      lines.push(`${this.prefix}_${key} ${value}`);
    }
    return lines.join('\n');
  }
}

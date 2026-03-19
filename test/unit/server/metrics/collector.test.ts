import { describe, it, expect } from 'vitest';

import { MetricsCollector } from '../../../../src/server/metrics';

describe('MetricsCollector', () => {
  it('should start with zero counters', () => {
    const collector = new MetricsCollector();
    const snapshot = collector.snapshot();
    expect(snapshot.connections).toBe(0);
    expect(snapshot.messagesIn).toBe(0);
  });

  it('should increment counters', () => {
    const collector = new MetricsCollector();
    collector.increment('connections', 5);
    expect(collector.snapshot().connections).toBe(5);
  });
});

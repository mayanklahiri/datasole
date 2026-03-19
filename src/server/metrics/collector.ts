import type { MetricsSnapshot } from './types';

export class MetricsCollector {
  private startTime = Date.now();
  private counters = {
    connections: 0,
    messagesIn: 0,
    messagesOut: 0,
    bytesIn: 0,
    bytesOut: 0,
    rpcCalls: 0,
    rpcErrors: 0,
    statePatches: 0,
  };

  increment(counter: keyof typeof this.counters, value = 1): void {
    this.counters[counter] += value;
  }

  decrement(counter: keyof typeof this.counters, value = 1): void {
    this.counters[counter] = Math.max(0, this.counters[counter] - value);
  }

  snapshot(): MetricsSnapshot {
    return {
      ...this.counters,
      uptime: Date.now() - this.startTime,
    };
  }

  reset(): void {
    for (const key of Object.keys(this.counters) as (keyof typeof this.counters)[]) {
      this.counters[key] = 0;
    }
  }
}

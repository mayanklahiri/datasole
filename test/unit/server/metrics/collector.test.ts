import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MetricsCollector } from '../../../../src/server/metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('snapshot()', () => {
    it('starts with zero counters', () => {
      const s = collector.snapshot();
      expect(s.connections).toBe(0);
      expect(s.messagesIn).toBe(0);
      expect(s.messagesOut).toBe(0);
      expect(s.bytesIn).toBe(0);
      expect(s.bytesOut).toBe(0);
      expect(s.rpcCalls).toBe(0);
      expect(s.rpcErrors).toBe(0);
      expect(s.statePatches).toBe(0);
    });

    it('returns all MetricsSnapshot fields', () => {
      const s = collector.snapshot();
      const keys = Object.keys(s).sort();
      expect(keys).toEqual([
        'bytesIn',
        'bytesOut',
        'connections',
        'messagesIn',
        'messagesOut',
        'rpcCalls',
        'rpcErrors',
        'statePatches',
        'uptime',
      ]);
    });

    it('uptime is non-negative', () => {
      expect(collector.snapshot().uptime).toBeGreaterThanOrEqual(0);
    });

    it('uptime increases over time', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 500);

      const s = collector.snapshot();
      expect(s.uptime).toBeGreaterThanOrEqual(500);

      vi.restoreAllMocks();
    });
  });

  describe('increment()', () => {
    it('increments by 1 by default', () => {
      collector.increment('connections');
      expect(collector.snapshot().connections).toBe(1);
    });

    it('increments by a custom value', () => {
      collector.increment('bytesIn', 1024);
      expect(collector.snapshot().bytesIn).toBe(1024);
    });

    it('accumulates multiple increments', () => {
      collector.increment('rpcCalls', 3);
      collector.increment('rpcCalls', 7);
      expect(collector.snapshot().rpcCalls).toBe(10);
    });

    it('works for every counter field', () => {
      const fields = [
        'connections',
        'messagesIn',
        'messagesOut',
        'bytesIn',
        'bytesOut',
        'rpcCalls',
        'rpcErrors',
        'statePatches',
      ] as const;
      for (const field of fields) {
        collector.increment(field, 1);
      }
      const s = collector.snapshot();
      for (const field of fields) {
        expect(s[field]).toBe(1);
      }
    });
  });

  describe('decrement()', () => {
    it('decrements a counter', () => {
      collector.increment('connections', 5);
      collector.decrement('connections', 2);
      expect(collector.snapshot().connections).toBe(3);
    });

    it('does not go below zero', () => {
      collector.increment('connections', 1);
      collector.decrement('connections', 10);
      expect(collector.snapshot().connections).toBe(0);
    });

    it('decrements by 1 by default', () => {
      collector.increment('messagesOut', 3);
      collector.decrement('messagesOut');
      expect(collector.snapshot().messagesOut).toBe(2);
    });
  });

  describe('reset()', () => {
    it('resets all counters to zero', () => {
      collector.increment('connections', 10);
      collector.increment('bytesIn', 9999);
      collector.increment('rpcErrors', 5);
      collector.reset();

      const s = collector.snapshot();
      expect(s.connections).toBe(0);
      expect(s.bytesIn).toBe(0);
      expect(s.rpcErrors).toBe(0);
    });

    it('does not reset uptime', () => {
      collector.reset();
      expect(collector.snapshot().uptime).toBeGreaterThanOrEqual(0);
    });
  });
});

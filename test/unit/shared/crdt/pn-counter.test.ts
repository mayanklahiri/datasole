import { describe, it, expect } from 'vitest';

import { PNCounter } from '../../../../src/shared/crdt';
import type { CrdtOperation } from '../../../../src/shared/crdt';

describe('PNCounter', () => {
  it('should start at zero', () => {
    const counter = new PNCounter('node-1');
    expect(counter.value()).toBe(0);
  });

  it('should increment', () => {
    const counter = new PNCounter('node-1');
    counter.increment(5);
    expect(counter.value()).toBe(5);
  });

  it('increments by 1 when no amount given', () => {
    const counter = new PNCounter('node-1');
    counter.increment();
    expect(counter.value()).toBe(1);
  });

  it('should decrement', () => {
    const counter = new PNCounter('node-1');
    counter.increment(10);
    counter.decrement(3);
    expect(counter.value()).toBe(7);
  });

  it('decrements by 1 when no amount given', () => {
    const counter = new PNCounter('node-1');
    counter.increment(5);
    counter.decrement();
    expect(counter.value()).toBe(4);
  });

  it('should apply remote increment operations', () => {
    const counter = new PNCounter('node-1');
    counter.apply({
      type: 'pn-counter',
      nodeId: 'node-2',
      timestamp: Date.now(),
      op: 'increment',
      value: 42,
    });
    expect(counter.value()).toBe(42);
  });

  it('should apply remote decrement operations', () => {
    const counter = new PNCounter('node-1');
    counter.increment(10);
    counter.apply({
      type: 'pn-counter',
      nodeId: 'node-2',
      timestamp: Date.now(),
      op: 'decrement',
      value: 3,
    });
    expect(counter.value()).toBe(7);
  });

  it('apply defaults to amount 1 when value is undefined', () => {
    const counter = new PNCounter('node-1');
    counter.apply({
      type: 'pn-counter',
      nodeId: 'node-2',
      timestamp: Date.now(),
      op: 'increment',
      value: undefined as unknown as number,
    });
    expect(counter.value()).toBe(1);
  });

  it('apply ignores unknown op types', () => {
    const counter = new PNCounter('node-1');
    counter.increment(5);
    counter.apply({
      type: 'pn-counter',
      nodeId: 'node-2',
      timestamp: Date.now(),
      op: 'unknown' as CrdtOperation['op'],
      value: 99,
    });
    expect(counter.value()).toBe(5);
  });

  describe('vector()', () => {
    it('returns increment and decrement vectors', () => {
      const counter = new PNCounter('node-1');
      counter.increment(5);
      counter.decrement(2);
      const v = counter.vector();
      expect(v.increments).toEqual({ 'node-1': 5 });
      expect(v.decrements).toEqual({ 'node-1': 2 });
    });
  });

  describe('state()', () => {
    it('returns full CrdtState with value and vector metadata', () => {
      const counter = new PNCounter('node-1');
      counter.increment(10);
      counter.decrement(3);
      const s = counter.state();
      expect(s.type).toBe('pn-counter');
      expect(s.value).toBe(7);
      expect(s.metadata).toBeDefined();
      const meta = s.metadata as unknown as {
        vector: { increments: Record<string, number>; decrements: Record<string, number> };
      };
      expect(meta.vector.increments).toEqual({ 'node-1': 10 });
      expect(meta.vector.decrements).toEqual({ 'node-1': 3 });
    });
  });

  describe('merge()', () => {
    it('merges remote state taking max of each counter', () => {
      const c1 = new PNCounter('node-1');
      c1.increment(5);

      const c2 = new PNCounter('node-2');
      c2.increment(10);
      c2.decrement(2);

      c1.merge(c2.state());
      expect(c1.value()).toBe(13); // 5 + 10 - 2
    });

    it('takes max on overlapping nodes', () => {
      const c1 = new PNCounter('node-1');
      c1.increment(5);

      const c2 = new PNCounter('node-1');
      c2.increment(3);

      c1.merge(c2.state());
      expect(c1.value()).toBe(5); // max(5,3) = 5
    });

    it('handles merge with no vector metadata', () => {
      const counter = new PNCounter('node-1');
      counter.increment(5);
      counter.merge({ type: 'pn-counter', value: 0, metadata: {} as never });
      expect(counter.value()).toBe(5);
    });

    it('handles merge with undefined metadata', () => {
      const counter = new PNCounter('node-1');
      counter.increment(5);
      counter.merge({ type: 'pn-counter', value: 0, metadata: undefined as never });
      expect(counter.value()).toBe(5);
    });

    it('merges multiple remote nodes', () => {
      const c1 = new PNCounter('node-1');
      c1.increment(3);

      const c2 = new PNCounter('node-2');
      c2.increment(7);
      c2.apply({
        type: 'pn-counter',
        nodeId: 'node-3',
        timestamp: Date.now(),
        op: 'increment',
        value: 4,
      });
      c2.apply({
        type: 'pn-counter',
        nodeId: 'node-3',
        timestamp: Date.now(),
        op: 'decrement',
        value: 1,
      });

      c1.merge(c2.state());
      // node-1: inc=3, node-2: inc=7, node-3: inc=4, dec=1
      expect(c1.value()).toBe(13); // 3 + 7 + 4 - 1
    });
  });
});

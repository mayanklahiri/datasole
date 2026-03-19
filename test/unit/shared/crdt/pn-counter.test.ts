import { describe, it, expect } from 'vitest';

import { PNCounter } from '../../../../src/shared/crdt';

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

  it('should decrement', () => {
    const counter = new PNCounter('node-1');
    counter.increment(10);
    counter.decrement(3);
    expect(counter.value()).toBe(7);
  });

  it('should apply remote operations', () => {
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
});
